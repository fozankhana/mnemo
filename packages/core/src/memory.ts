import type { SqliteDatabase } from "./sqlite.js";
import type { EmbeddingProvider, Memory, Scope, SearchHit } from "./types.js";
import { ConsentError } from "./types.js";
import type { ConsentEngine } from "./consent.js";
import type { AuditLog } from "./audit.js";
import { newId } from "./ids.js";
import { decodeEmbedding, encodeEmbedding, knn } from "./vector.js";

/** Internal sentinel client id for actions the vault owner performs directly. */
export const OWNER_CLIENT_ID = "(owner)";

function toMemory(r: Record<string, unknown>): Memory {
  return {
    id: String(r.id),
    content: String(r.content),
    scope: String(r.scope),
    sourceClient: r.source_client == null ? null : String(r.source_client),
    metadata: r.metadata == null ? null : (JSON.parse(String(r.metadata)) as Record<string, unknown>),
    createdAt: Number(r.created_at),
  };
}

function toScope(r: Record<string, unknown>): Scope {
  return {
    name: String(r.name),
    description: r.description == null ? null : String(r.description),
    createdAt: Number(r.created_at),
  };
}

function truncate(s: string, n = 80): string {
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

export interface WriteInput {
  content: string;
  scope?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchInput {
  query: string;
  k?: number;
  scope?: string;
}

/**
 * The memory store. Every client-facing method consults the {@link ConsentEngine}
 * first and writes an {@link AuditLog} entry — allowed or denied — before doing
 * any work. Owner methods bypass consent (the owner controls the vault) but are
 * still audited.
 */
export class MemoryStore {
  constructor(
    private readonly db: SqliteDatabase,
    private readonly embeddings: EmbeddingProvider,
    private readonly consent: ConsentEngine,
    private readonly audit: AuditLog,
  ) {}

  ensureScope(name: string, description?: string | null): void {
    const existing = this.db.prepare(`SELECT name FROM scopes WHERE name = ?`).get(name);
    if (!existing) {
      this.db
        .prepare(`INSERT INTO scopes (name, description, created_at) VALUES (?, ?, ?)`)
        .run(name, description ?? null, Date.now());
    } else if (description != null) {
      this.db.prepare(`UPDATE scopes SET description = ? WHERE name = ?`).run(description, name);
    }
  }

  private async insert(clientId: string, input: WriteInput): Promise<Memory> {
    const scope = (input.scope ?? "general").trim() || "general";
    this.ensureScope(scope);
    const vec = await this.embeddings.embed(input.content);
    const id = newId("mem");
    const now = Date.now();
    const metaJson = input.metadata ? JSON.stringify(input.metadata) : null;
    this.db
      .prepare(
        `INSERT INTO memories (id, content, scope, source_client, metadata, embedding, dim, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.content, scope, clientId, metaJson, encodeEmbedding(vec), vec.length, now);
    this.audit.record({
      clientId,
      action: "write",
      scope,
      memoryId: id,
      allowed: true,
      detail: `len=${input.content.length}`,
    });
    return {
      id,
      content: input.content,
      scope,
      sourceClient: clientId,
      metadata: input.metadata ?? null,
      createdAt: now,
    };
  }

  /** Consent-gated write on behalf of an external client (e.g. an AI tool). */
  async write(clientId: string, input: WriteInput): Promise<Memory> {
    const scope = (input.scope ?? "general").trim() || "general";
    if (!this.consent.can(clientId, scope, "write")) {
      this.audit.record({ clientId, action: "write", scope, allowed: false, detail: "no write grant" });
      throw new ConsentError(clientId, scope, "write");
    }
    return this.insert(clientId, input);
  }

  /** Owner write — bypasses consent, still audited. */
  ownerWrite(input: WriteInput): Promise<Memory> {
    return this.insert(OWNER_CLIENT_ID, input);
  }

  /** Consent-gated semantic search. Only scopes the client may read are searched. */
  async search(clientId: string, input: SearchInput): Promise<SearchHit[]> {
    const k = Math.min(Math.max(input.k ?? 5, 1), 50);
    let scopes: string[];
    if (input.scope) {
      if (!this.consent.can(clientId, input.scope, "read")) {
        this.audit.record({
          clientId,
          action: "search",
          scope: input.scope,
          allowed: false,
          detail: "no read grant",
        });
        throw new ConsentError(clientId, input.scope, "read");
      }
      scopes = [input.scope];
    } else {
      scopes = this.consent.readableScopes(clientId);
    }

    if (scopes.length === 0) {
      this.audit.record({ clientId, action: "search", allowed: false, detail: "no readable scopes" });
      return [];
    }

    const placeholders = scopes.map(() => "?").join(",");
    const rows = this.db
      .prepare(`SELECT * FROM memories WHERE scope IN (${placeholders})`)
      .all(...scopes);
    const qvec = await this.embeddings.embed(input.query);
    const candidates = rows.map((r) => ({
      memory: toMemory(r),
      vec: decodeEmbedding(r.embedding as Uint8Array),
    }));
    const hits = knn(qvec, candidates, (c) => c.vec, k)
      .filter((s) => s.score > 0)
      .map((s) => ({ ...s.item.memory, score: s.score }));

    this.audit.record({
      clientId,
      action: "search",
      allowed: true,
      detail: `q="${truncate(input.query)}";scopes=${scopes.join("|")};hits=${hits.length}`,
    });
    return hits;
  }

  /** Owner search across all scopes (or one) — no consent gate, still audited. */
  async ownerSearch(input: SearchInput): Promise<SearchHit[]> {
    const k = Math.min(Math.max(input.k ?? 10, 1), 50);
    const rows = input.scope
      ? this.db.prepare(`SELECT * FROM memories WHERE scope = ?`).all(input.scope)
      : this.db.prepare(`SELECT * FROM memories`).all();
    const qvec = await this.embeddings.embed(input.query);
    const candidates = rows.map((r) => ({
      memory: toMemory(r),
      vec: decodeEmbedding(r.embedding as Uint8Array),
    }));
    const hits = knn(qvec, candidates, (c) => c.vec, k)
      .filter((s) => s.score > 0)
      .map((s) => ({ ...s.item.memory, score: s.score }));
    this.audit.record({
      clientId: OWNER_CLIENT_ID,
      action: "search",
      scope: input.scope ?? null,
      allowed: true,
      detail: `owner;hits=${hits.length}`,
    });
    return hits;
  }

  // --- Owner / admin reads (no consent gate) ---

  listMemories(opts: { scope?: string; limit?: number } = {}): Memory[] {
    const limit = Math.min(Math.max(opts.limit ?? 200, 1), 2000);
    const rows = opts.scope
      ? this.db
          .prepare(`SELECT * FROM memories WHERE scope = ? ORDER BY created_at DESC LIMIT ?`)
          .all(opts.scope, limit)
      : this.db.prepare(`SELECT * FROM memories ORDER BY created_at DESC LIMIT ?`).all(limit);
    return rows.map(toMemory);
  }

  getMemory(id: string): Memory | null {
    const r = this.db.prepare(`SELECT * FROM memories WHERE id = ?`).get(id);
    return r ? toMemory(r) : null;
  }

  deleteMemory(id: string): boolean {
    const res = this.db.prepare(`DELETE FROM memories WHERE id = ?`).run(id);
    return Number(res.changes) > 0;
  }

  listScopesDetailed(): Scope[] {
    return this.db.prepare(`SELECT * FROM scopes ORDER BY name`).all().map(toScope);
  }

  count(): number {
    const r = this.db.prepare(`SELECT COUNT(*) AS n FROM memories`).get() as { n?: number };
    return Number(r?.n ?? 0);
  }
}

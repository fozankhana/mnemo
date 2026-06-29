import { openVaultDb } from "./db.js";
import type { SqliteDatabase } from "./sqlite.js";
import { AuditLog } from "./audit.js";
import { ConsentEngine } from "./consent.js";
import { MemoryStore, OWNER_CLIENT_ID, type SearchInput, type WriteInput } from "./memory.js";
import { createEmbeddingProvider, type EmbeddingProviderName } from "./embeddings/index.js";
import type {
  AuditEntry,
  ClientInfo,
  EmbeddingProvider,
  Grant,
  Memory,
  Scope,
  SearchHit,
} from "./types.js";

export interface VaultOptions {
  /** Embedding backend by name, or a custom provider instance. Default: `lexical`. */
  embeddings?: EmbeddingProviderName | EmbeddingProvider;
}

/**
 * A scoped handle for one external client (e.g. "claude-desktop"). Every call is
 * consent-checked and audited under this client's id.
 */
export class ClientSession {
  constructor(
    private readonly vault: Vault,
    readonly clientId: string,
  ) {}

  write(input: WriteInput): Promise<Memory> {
    return this.vault.memories.write(this.clientId, input);
  }

  search(input: SearchInput): Promise<SearchHit[]> {
    return this.vault.memories.search(this.clientId, input);
  }

  /** Scopes this client is allowed to read (with descriptions). */
  listScopes(): Scope[] {
    const names = new Set(this.vault.consent.readableScopes(this.clientId));
    this.vault.audit.record({
      clientId: this.clientId,
      action: "list_scopes",
      allowed: true,
      detail: `n=${names.size}`,
    });
    return this.vault.memories.listScopesDetailed().filter((s) => names.has(s.name));
  }
}

export interface VaultStats {
  memories: number;
  scopes: number;
  clients: number;
  pendingClients: number;
  auditEntries: number;
  embeddingProvider: string;
}

/**
 * The owner's full-access control plane. Backs the dashboard and CLI. Not
 * consent-gated (the owner owns the vault), but every action is audited.
 */
export class AdminApi {
  constructor(private readonly vault: Vault) {}

  // memories
  listMemories(opts: { scope?: string; limit?: number } = {}): Memory[] {
    const out = this.vault.memories.listMemories(opts);
    this.vault.audit.record({
      clientId: OWNER_CLIENT_ID,
      action: "list_memories",
      scope: opts.scope ?? null,
      allowed: true,
      detail: `n=${out.length}`,
    });
    return out;
  }
  getMemory(id: string): Memory | null {
    return this.vault.memories.getMemory(id);
  }
  addMemory(input: WriteInput): Promise<Memory> {
    return this.vault.memories.ownerWrite(input);
  }
  deleteMemory(id: string): boolean {
    return this.vault.memories.deleteMemory(id);
  }
  /** Owner search (ungated) across all scopes, for the dashboard/CLI. */
  search(input: SearchInput): Promise<SearchHit[]> {
    return this.vault.memories.ownerSearch(input);
  }

  // scopes
  listScopes(): Scope[] {
    return this.vault.memories.listScopesDetailed();
  }
  createScope(name: string, description?: string): void {
    this.vault.memories.ensureScope(name, description ?? null);
  }

  // consent
  listClients(): ClientInfo[] {
    return this.vault.consent.listClients();
  }
  listGrants(clientId?: string): Grant[] {
    return this.vault.consent.listGrants(clientId);
  }
  grant(clientId: string, scope: string, modes: { canRead?: boolean; canWrite?: boolean }): void {
    this.vault.consent.grant(clientId, scope, modes);
    this.vault.audit.record({
      clientId: OWNER_CLIENT_ID,
      action: "grant",
      scope,
      allowed: true,
      detail: `for=${clientId};read=${modes.canRead ? 1 : 0};write=${modes.canWrite ? 1 : 0}`,
    });
  }
  revoke(clientId: string, scope: string): void {
    this.vault.consent.revoke(clientId, scope);
    this.vault.audit.record({
      clientId: OWNER_CLIENT_ID,
      action: "revoke",
      scope,
      allowed: true,
      detail: `for=${clientId}`,
    });
  }

  // audit + export
  audit(opts: { limit?: number; offset?: number; clientId?: string } = {}): AuditEntry[] {
    return this.vault.audit.list(opts);
  }

  export(): {
    exportedAt: number;
    memories: Memory[];
    scopes: Scope[];
    clients: ClientInfo[];
    grants: Grant[];
    audit: AuditEntry[];
  } {
    const data = {
      exportedAt: Date.now(),
      memories: this.vault.memories.listMemories({ limit: 2000 }),
      scopes: this.vault.memories.listScopesDetailed(),
      clients: this.vault.consent.listClients(),
      grants: this.vault.consent.listGrants(),
      audit: this.vault.audit.list({ limit: 1000 }),
    };
    this.vault.audit.record({
      clientId: OWNER_CLIENT_ID,
      action: "export",
      allowed: true,
      detail: `memories=${data.memories.length}`,
    });
    return data;
  }

  stats(): VaultStats {
    const clients = this.vault.consent.listClients();
    return {
      memories: this.vault.memories.count(),
      scopes: this.vault.memories.listScopesDetailed().length,
      clients: clients.length,
      pendingClients: clients.filter((c) => c.status === "pending").length,
      auditEntries: this.vault.audit.count(),
      embeddingProvider: this.vault.embeddings.id,
    };
  }
}

/**
 * The Mnemo vault. Open once per process; hands out consent-gated
 * {@link ClientSession}s for AI tools and an owner {@link AdminApi} for the
 * dashboard/CLI.
 */
export class Vault {
  readonly db: SqliteDatabase;
  readonly embeddings: EmbeddingProvider;
  readonly consent: ConsentEngine;
  readonly audit: AuditLog;
  readonly memories: MemoryStore;

  private constructor(db: SqliteDatabase, embeddings: EmbeddingProvider) {
    this.db = db;
    this.embeddings = embeddings;
    this.audit = new AuditLog(db);
    this.consent = new ConsentEngine(db);
    this.memories = new MemoryStore(db, embeddings, this.consent, this.audit);
  }

  static open(path: string, opts: VaultOptions = {}): Vault {
    const db = openVaultDb(path);
    const embeddings =
      typeof opts.embeddings === "object"
        ? opts.embeddings
        : createEmbeddingProvider(opts.embeddings ?? "lexical");
    return new Vault(db, embeddings);
  }

  /** Get a consent-gated session for an external client. */
  client(clientId: string, label?: string | null): ClientSession {
    this.consent.ensureClient(clientId, label);
    return new ClientSession(this, clientId);
  }

  /** The owner's full-access control plane. */
  get admin(): AdminApi {
    return new AdminApi(this);
  }

  close(): void {
    this.db.close();
  }
}

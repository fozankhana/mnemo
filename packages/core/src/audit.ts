import type { SqliteDatabase } from "./sqlite.js";
import type { AuditAction, AuditEntry } from "./types.js";

function toAuditEntry(r: Record<string, unknown>): AuditEntry {
  return {
    id: Number(r.id),
    ts: Number(r.ts),
    clientId: r.client_id == null ? null : String(r.client_id),
    action: String(r.action) as AuditAction,
    scope: r.scope == null ? null : String(r.scope),
    memoryId: r.memory_id == null ? null : String(r.memory_id),
    allowed: Number(r.allowed) === 1,
    detail: r.detail == null ? null : String(r.detail),
  };
}

export interface AuditInput {
  clientId: string | null;
  action: AuditAction;
  scope?: string | null;
  memoryId?: string | null;
  allowed: boolean;
  detail?: string | null;
}

/** Append-only record of every access. The audit log is never mutated. */
export class AuditLog {
  constructor(private readonly db: SqliteDatabase) {}

  record(e: AuditInput): void {
    this.db
      .prepare(
        `INSERT INTO audit (ts, client_id, action, scope, memory_id, allowed, detail)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        Date.now(),
        e.clientId,
        e.action,
        e.scope ?? null,
        e.memoryId ?? null,
        e.allowed ? 1 : 0,
        e.detail ?? null,
      );
  }

  list(opts: { limit?: number; offset?: number; clientId?: string } = {}): AuditEntry[] {
    const limit = Math.min(Math.max(opts.limit ?? 100, 1), 1000);
    const offset = Math.max(opts.offset ?? 0, 0);
    const rows = opts.clientId
      ? this.db
          .prepare(`SELECT * FROM audit WHERE client_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`)
          .all(opts.clientId, limit, offset)
      : this.db.prepare(`SELECT * FROM audit ORDER BY id DESC LIMIT ? OFFSET ?`).all(limit, offset);
    return rows.map(toAuditEntry);
  }

  count(): number {
    const r = this.db.prepare(`SELECT COUNT(*) AS n FROM audit`).get() as { n?: number };
    return Number(r?.n ?? 0);
  }
}

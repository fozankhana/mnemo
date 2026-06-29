import type { SqliteDatabase } from "./sqlite.js";
import type { ClientInfo, Grant } from "./types.js";

function toGrant(r: Record<string, unknown>): Grant {
  return {
    clientId: String(r.client_id),
    scope: String(r.scope),
    canRead: Number(r.can_read) === 1,
    canWrite: Number(r.can_write) === 1,
    grantedAt: Number(r.granted_at),
    revokedAt: r.revoked_at == null ? null : Number(r.revoked_at),
  };
}

/**
 * Consent engine: the gatekeeper between AI tools and the vault.
 *
 * Model is **default-deny**. A client can do nothing until the owner grants it
 * read and/or write on specific scopes (or the `*` wildcard). Revoking flips
 * `revoked_at` so the grant is preserved for the audit trail but no longer
 * effective.
 */
export class ConsentEngine {
  constructor(private readonly db: SqliteDatabase) {}

  /** Upsert a client record so it shows up in the dashboard (even if denied). */
  ensureClient(clientId: string, label?: string | null): void {
    const now = Date.now();
    const existing = this.db.prepare(`SELECT id FROM clients WHERE id = ?`).get(clientId);
    if (existing) {
      this.db
        .prepare(`UPDATE clients SET last_seen = ?, label = COALESCE(?, label) WHERE id = ?`)
        .run(now, label ?? null, clientId);
    } else {
      this.db
        .prepare(`INSERT INTO clients (id, label, first_seen, last_seen) VALUES (?, ?, ?, ?)`)
        .run(clientId, label ?? null, now, now);
    }
  }

  /** Active (non-revoked) grants for a client. */
  grantsFor(clientId: string): Grant[] {
    return this.db
      .prepare(`SELECT * FROM grants WHERE client_id = ? AND revoked_at IS NULL`)
      .all(clientId)
      .map(toGrant);
  }

  /** Can `clientId` perform `mode` on `scope`? Honors the `*` wildcard grant. */
  can(clientId: string, scope: string, mode: "read" | "write"): boolean {
    for (const g of this.grantsFor(clientId)) {
      if (g.scope === "*" || g.scope === scope) {
        if (mode === "read" && g.canRead) return true;
        if (mode === "write" && g.canWrite) return true;
      }
    }
    return false;
  }

  /** Scope names the client may read (expands `*` against existing scopes). */
  readableScopes(clientId: string): string[] {
    const grants = this.grantsFor(clientId).filter((g) => g.canRead);
    if (grants.some((g) => g.scope === "*")) return this.allScopeNames();
    return grants.map((g) => g.scope);
  }

  grant(
    clientId: string,
    scope: string,
    modes: { canRead?: boolean; canWrite?: boolean },
  ): void {
    this.ensureClient(clientId);
    this.db
      .prepare(
        `INSERT INTO grants (client_id, scope, can_read, can_write, granted_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, NULL)
         ON CONFLICT(client_id, scope) DO UPDATE SET
           can_read = excluded.can_read,
           can_write = excluded.can_write,
           granted_at = excluded.granted_at,
           revoked_at = NULL`,
      )
      .run(clientId, scope, modes.canRead ? 1 : 0, modes.canWrite ? 1 : 0, Date.now());
  }

  revoke(clientId: string, scope: string): boolean {
    const result = this.db
      .prepare(
        `UPDATE grants SET revoked_at = ? WHERE client_id = ? AND scope = ? AND revoked_at IS NULL`,
      )
      .run(Date.now(), clientId, scope);
    return Number(result.changes) > 0;
  }

  listClients(): ClientInfo[] {
    return this.db
      .prepare(`SELECT * FROM clients ORDER BY last_seen DESC`)
      .all()
      .map((r) => {
        const id = String(r.id);
        return {
          id,
          label: r.label == null ? null : String(r.label),
          firstSeen: Number(r.first_seen),
          lastSeen: r.last_seen == null ? null : Number(r.last_seen),
          status: this.grantsFor(id).length > 0 ? "active" : "pending",
        };
      });
  }

  listGrants(clientId?: string): Grant[] {
    return clientId
      ? this.db
          .prepare(`SELECT * FROM grants WHERE client_id = ? ORDER BY scope`)
          .all(clientId)
          .map(toGrant)
      : this.db.prepare(`SELECT * FROM grants ORDER BY client_id, scope`).all().map(toGrant);
  }

  allScopeNames(): string[] {
    return this.db
      .prepare(`SELECT name FROM scopes ORDER BY name`)
      .all()
      .map((r) => String(r.name));
  }
}

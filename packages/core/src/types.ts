/** Domain types shared across the Mnemo core. */

export interface Memory {
  id: string;
  content: string;
  scope: string;
  sourceClient: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
}

export interface SearchHit extends Memory {
  /** Cosine similarity in [0, 1]; higher is closer. */
  score: number;
}

export interface Scope {
  name: string;
  description: string | null;
  createdAt: number;
}

/** A grant lets a client read and/or write a scope. `scope === "*"` is a wildcard. */
export interface Grant {
  clientId: string;
  scope: string;
  canRead: boolean;
  canWrite: boolean;
  grantedAt: number;
  revokedAt: number | null;
}

export interface ClientInfo {
  id: string;
  label: string | null;
  firstSeen: number;
  lastSeen: number | null;
  /** Derived: does the client hold at least one active grant? */
  status: "active" | "pending";
}

export type AuditAction =
  | "write"
  | "search"
  | "list_scopes"
  | "list_memories"
  | "get"
  | "grant"
  | "revoke"
  | "export"
  | "register_client";

export interface AuditEntry {
  id: number;
  ts: number;
  clientId: string | null;
  action: AuditAction;
  scope: string | null;
  memoryId: string | null;
  allowed: boolean;
  detail: string | null;
}

/** Pluggable embedding backend. Default is local + dependency-free (see lexical.ts). */
export interface EmbeddingProvider {
  readonly id: string;
  readonly dim: number;
  embed(text: string): Promise<Float32Array> | Float32Array;
}

/** Thrown when a client attempts an action it has not been granted. */
export class ConsentError extends Error {
  readonly clientId: string;
  readonly scope: string;
  readonly mode: "read" | "write";
  constructor(clientId: string, scope: string, mode: "read" | "write") {
    super(
      `Consent denied: client "${clientId}" has no ${mode} grant for scope "${scope}". ` +
        `Approve it in the Mnemo dashboard.`,
    );
    this.name = "ConsentError";
    this.clientId = clientId;
    this.scope = scope;
    this.mode = mode;
  }
}

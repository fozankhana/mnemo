/** Public API for @mnemo/core. */
export { Vault, ClientSession, AdminApi } from "./vault.js";
export type { VaultOptions, VaultStats } from "./vault.js";
export { MemoryStore, OWNER_CLIENT_ID } from "./memory.js";
export type { WriteInput, SearchInput } from "./memory.js";
export { ConsentEngine } from "./consent.js";
export { AuditLog } from "./audit.js";
export type { AuditInput } from "./audit.js";
export {
  createEmbeddingProvider,
  LexicalEmbeddingProvider,
  type EmbeddingProviderName,
} from "./embeddings/index.js";
export { cosineSimilarity, knn, encodeEmbedding, decodeEmbedding } from "./vector.js";
export { openVaultDb } from "./db.js";
export { newId } from "./ids.js";
export { ConsentError } from "./types.js";
export type {
  Memory,
  SearchHit,
  Scope,
  Grant,
  ClientInfo,
  AuditAction,
  AuditEntry,
  EmbeddingProvider,
} from "./types.js";

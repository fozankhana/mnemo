/** SQLite schema for the Mnemo vault. All timestamps are epoch milliseconds. */
export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS scopes (
  name        TEXT PRIMARY KEY,
  description TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
  id            TEXT PRIMARY KEY,
  content       TEXT NOT NULL,
  scope         TEXT NOT NULL,
  source_client TEXT,
  metadata      TEXT,            -- JSON object or NULL
  embedding     BLOB NOT NULL,   -- Float32 little-endian
  dim           INTEGER NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);

CREATE TABLE IF NOT EXISTS clients (
  id         TEXT PRIMARY KEY,
  label      TEXT,
  first_seen INTEGER NOT NULL,
  last_seen  INTEGER
);

CREATE TABLE IF NOT EXISTS grants (
  client_id  TEXT NOT NULL,
  scope      TEXT NOT NULL,      -- scope name, or "*" wildcard
  can_read   INTEGER NOT NULL DEFAULT 0,
  can_write  INTEGER NOT NULL DEFAULT 0,
  granted_at INTEGER NOT NULL,
  revoked_at INTEGER,
  PRIMARY KEY (client_id, scope)
);

CREATE TABLE IF NOT EXISTS audit (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,
  client_id TEXT,
  action    TEXT NOT NULL,
  scope     TEXT,
  memory_id TEXT,
  allowed   INTEGER NOT NULL,
  detail    TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit(ts);
CREATE INDEX IF NOT EXISTS idx_audit_client ON audit(client_id);
`;

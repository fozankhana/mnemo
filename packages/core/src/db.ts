import { openSqlite, type SqliteDatabase } from "./sqlite.js";
import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema.js";

/**
 * Open the vault database, apply pragmas, and ensure the schema exists.
 * Idempotent: safe to call on an existing vault.
 */
export function openVaultDb(path: string): SqliteDatabase {
  const db = openSqlite(path);
  // WAL improves concurrent read (dashboard) vs write (MCP) access; NORMAL is a
  // safe durability tradeoff for a local single-user store.
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA_SQL);

  const row = db
    .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
    .get() as { value?: string } | undefined;
  if (!row) {
    db.prepare("INSERT INTO meta (key, value) VALUES ('schema_version', ?)").run(
      String(SCHEMA_VERSION),
    );
  }
  return db;
}

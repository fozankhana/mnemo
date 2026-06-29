/**
 * Minimal typed surface over Node's built-in `node:sqlite` module.
 *
 * Mnemo deliberately uses the built-in SQLite (Node >= 22.5, stable on 24+)
 * instead of a native addon like better-sqlite3. This keeps `npx mnemo` a
 * zero-build, zero-native-dependency install on every platform — the demo gate
 * that matters most. We only declare the slice of the API we actually use,
 * because the bundled `@types/node` may not yet ship node:sqlite typings.
 */
// @ts-ignore - node:sqlite typings may be absent depending on @types/node version
import { DatabaseSync as NodeDatabaseSync } from "node:sqlite";

export interface RunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

export interface SqliteStatement {
  run(...params: unknown[]): RunResult;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

export interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
}

type DbCtor = new (path: string, options?: Record<string, unknown>) => SqliteDatabase;

/** Open (or create) a SQLite database file at `path`. */
export function openSqlite(path: string): SqliteDatabase {
  const Ctor = NodeDatabaseSync as unknown as DbCtor;
  return new Ctor(path);
}

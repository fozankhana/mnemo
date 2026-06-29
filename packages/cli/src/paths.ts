import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { EmbeddingProviderName } from "@mnemo/core";

/** Vault data directory: $MNEMO_HOME or ~/.mnemo (created if missing). */
export function dataDir(): string {
  const fromEnv = process.env.MNEMO_HOME?.trim();
  const dir = fromEnv && fromEnv.length > 0 ? fromEnv : path.join(os.homedir(), ".mnemo");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dbPath(): string {
  return path.join(dataDir(), "mnemo.db");
}

export function defaultPort(): number {
  const p = Number(process.env.MNEMO_PORT);
  return Number.isFinite(p) && p > 0 ? p : 4319;
}

export function embeddingsName(): EmbeddingProviderName {
  const e = process.env.MNEMO_EMBEDDINGS?.trim();
  return e === "fastembed" ? "fastembed" : "lexical";
}

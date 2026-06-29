import { randomUUID } from "node:crypto";

/** Compact, prefixed, collision-resistant id. e.g. `mem_3f9a2b...`. */
export function newId(prefix = "mem"): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

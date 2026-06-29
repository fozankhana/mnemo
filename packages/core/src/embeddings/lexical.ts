import type { EmbeddingProvider } from "../types.js";

const DIM = 256;

/** FNV-1a hash → 32-bit unsigned. Stable across runs and platforms. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Local, dependency-free embedding. Hashes word tokens (and short character
 * trigrams for fuzzy overlap) into a fixed 256-dim L2-normalized vector. Cosine
 * similarity then approximates lexical/keyword overlap.
 *
 * This is the safe default: instant, offline, deterministic, zero install — so
 * `npx mnemo` works everywhere. For true semantic recall, a `fastembed` (ONNX)
 * provider plugs into the same interface (see ./index.ts).
 */
export class LexicalEmbeddingProvider implements EmbeddingProvider {
  readonly id = "lexical-v1";
  readonly dim = DIM;

  embed(text: string): Float32Array {
    const v = new Float32Array(DIM);
    const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
    const bump = (key: string, w: number): void => {
      const i = fnv1a(key) % DIM;
      v[i] = (v[i] as number) + w;
    };
    for (const word of words) {
      bump(`w:${word}`, 1);
      if (word.length >= 4) {
        for (let i = 0; i + 3 <= word.length; i++) {
          bump(`t:${word.slice(i, i + 3)}`, 0.5);
        }
      }
    }
    let norm = 0;
    for (let i = 0; i < DIM; i++) {
      const x = v[i] as number;
      norm += x * x;
    }
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < DIM; i++) v[i] = (v[i] as number) / norm;
    }
    return v;
  }
}

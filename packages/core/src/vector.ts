/** Vector helpers: blob (de)serialization and brute-force cosine KNN.
 *
 * v0.1 stores embeddings as Float32 BLOBs and ranks in JS. This is exact and
 * dependency-free — ideal at personal-vault scale (thousands of memories). The
 * `knn` seam can be swapped for an ANN index (e.g. sqlite-vec) in v0.2 without
 * changing callers.
 */

/** Pack a Float32Array into a standalone byte buffer for SQLite storage. */
export function encodeEmbedding(v: Float32Array): Uint8Array {
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength).slice();
}

/** Unpack a stored BLOB back into a Float32Array (copied for safe alignment). */
export function decodeEmbedding(bytes: Uint8Array): Float32Array {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Float32Array(copy.buffer);
}

/** Cosine similarity in [-1, 1]; returns 0 if either vector is zero-length. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] as number;
    const y = b[i] as number;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface Scored<T> {
  item: T;
  score: number;
}

/** Return the top-`k` items by cosine similarity to `query`. */
export function knn<T>(
  query: Float32Array,
  items: T[],
  getVec: (item: T) => Float32Array,
  k: number,
): Scored<T>[] {
  const scored = items.map((item) => ({ item, score: cosineSimilarity(query, getVec(item)) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(0, k));
}

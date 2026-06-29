import { test } from "node:test";
import assert from "node:assert/strict";
import { LexicalEmbeddingProvider, cosineSimilarity } from "../dist/index.js";

test("lexical embeddings are deterministic and L2-normalized", () => {
  const p = new LexicalEmbeddingProvider();
  const a = p.embed("mountain hiking trip");
  const b = p.embed("mountain hiking trip");
  assert.deepEqual(Array.from(a), Array.from(b));

  let norm = 0;
  for (const x of a) norm += x * x;
  assert.ok(Math.abs(Math.sqrt(norm) - 1) < 1e-6, "vector should be unit length");
});

test("related text scores higher than unrelated text", () => {
  const p = new LexicalEmbeddingProvider();
  const q = p.embed("mountain hiking trip");
  const related = p.embed("I love hiking in the mountains");
  const unrelated = p.embed("quarterly tax accounting spreadsheet");
  assert.ok(
    cosineSimilarity(q, related) > cosineSimilarity(q, unrelated),
    "semantic overlap must rank above noise",
  );
});

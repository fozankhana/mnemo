import type { EmbeddingProvider } from "../types.js";
import { LexicalEmbeddingProvider } from "./lexical.js";

export { LexicalEmbeddingProvider };

export type EmbeddingProviderName = "lexical" | "fastembed";

/**
 * Resolve an embedding provider by name. `lexical` (default) is local and
 * dependency-free. `fastembed` is the documented v0.2 semantic upgrade: it
 * plugs into the same `EmbeddingProvider` interface but pulls an ONNX model, so
 * it is not bundled in the zero-install core.
 */
export function createEmbeddingProvider(
  name: EmbeddingProviderName = "lexical",
): EmbeddingProvider {
  switch (name) {
    case "lexical":
      return new LexicalEmbeddingProvider();
    case "fastembed":
      throw new Error(
        "The 'fastembed' embedding provider is an optional upgrade and is not " +
          "bundled in v0.1. Use MNEMO_EMBEDDINGS=lexical (default).",
      );
    default:
      return new LexicalEmbeddingProvider();
  }
}

import { describe, expect, it } from "vitest";

import { createEmbeddingProvider } from "./embeddings.js";
import type { IndexedChunk, SearchIndex } from "./index-store.js";
import { searchIndex } from "./search.js";
import { embedText } from "./vector.js";

const embeddings = createEmbeddingProvider({ provider: "local" });

describe("searchIndex", () => {
  it("returns matching chunks in score order", async () => {
    const index = createIndex([
      chunk("src/auth.ts", "export function authenticateUser() { return true; }"),
      chunk("src/billing.ts", "export function createInvoice() { return true; }")
    ]);

    const results = await searchIndex(index, "authenticate user", 1, embeddings);

    expect(results).toHaveLength(1);
    expect(results[0]?.chunk.file).toBe("src/auth.ts");
  });

  it("prioritizes code files over docs when scores are close", async () => {
    const docs = chunk("README.md", "cli command search ranking");
    const code = chunk("src/cli.ts", "cli command search ranking");
    const index = createIndex([docs, code]);

    const results = await searchIndex(index, "cli command search ranking", 2, embeddings);

    expect(results.map((result) => result.chunk.file)).toEqual(["src/cli.ts", "README.md"]);
    expect(Math.abs(results[0]!.score - results[1]!.score)).toBeLessThanOrEqual(0.05);
  });

  it("does not let file priority overcome a clearly better text match", async () => {
    const docs = chunk("README.md", "authentication token validation validation validation");
    const code = chunk("src/unrelated.ts", "invoice total formatter");
    const index = createIndex([code, docs]);

    const results = await searchIndex(index, "authentication token validation", 2, embeddings);

    expect(results[0]?.chunk.file).toBe("README.md");
  });
});

function createIndex(chunks: IndexedChunk[]): SearchIndex {
  return {
    version: 3,
    root: "/repo",
    createdAt: "2026-05-20T00:00:00.000Z",
    embedding: {
      provider: "local",
      model: "local-hash-v1"
    },
    files: chunks.map((chunk) => ({
      path: chunk.file,
      size: chunk.text.length,
      mtimeMs: 1,
      hash: chunk.id,
      chunkIds: [chunk.id]
    })),
    chunks
  };
}

function chunk(file: string, text: string): IndexedChunk {
  return {
    id: `${file}:1-1`,
    file,
    startLine: 1,
    endLine: 1,
    text,
    vector: embedText(`${file}\n${text}`)
  };
}

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createEmbeddingProvider, type EmbeddingProvider } from "./embeddings.js";
import { buildIndex } from "./indexer.js";
import { saveIndex } from "./index-store.js";

const tempRoots: string[] = [];
const embeddings = createEmbeddingProvider({ provider: "local" });

describe("buildIndex", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("reuses unchanged files from an existing index", async () => {
    const root = await createRepo({
      "src/auth.ts": "export function authenticateUser() { return true; }\n",
      "src/billing.ts": "export function createInvoice() { return true; }\n"
    });

    const first = await buildIndex({ root, maxFileBytes: 250_000, embeddings });
    await saveIndex(root, first.index);

    const second = await buildIndex({ root, maxFileBytes: 250_000, embeddings });

    expect(first.changed).toBe(2);
    expect(second.changed).toBe(0);
    expect(second.reused).toBe(2);
    expect(second.index.files).toEqual(first.index.files);
    expect(second.index.chunks).toEqual(first.index.chunks);
  });

  it("reprocesses changed files and drops deleted files", async () => {
    const root = await createRepo({
      "src/auth.ts": "export function authenticateUser() { return true; }\n",
      "src/billing.ts": "export function createInvoice() { return true; }\n"
    });

    const first = await buildIndex({ root, maxFileBytes: 250_000, embeddings });
    await saveIndex(root, first.index);
    await writeFile(path.join(root, "src", "auth.ts"), "export function authorizeUser() { return true; }\n");
    await rm(path.join(root, "src", "billing.ts"));

    const second = await buildIndex({ root, maxFileBytes: 250_000, embeddings });

    expect(second.changed).toBe(1);
    expect(second.reused).toBe(0);
    expect(second.removed).toBe(1);
    expect(second.index.files.map((file) => file.path)).toEqual(["src/auth.ts"]);
    expect(second.index.chunks[0]?.text).toContain("authorizeUser");
  });

  it("reprocesses unchanged files when embedding metadata changes", async () => {
    const root = await createRepo({
      "src/auth.ts": "export function authenticateUser() { return true; }\n"
    });
    const otherEmbeddings = createFakeEmbeddingProvider("openai", "different-model");

    const first = await buildIndex({ root, maxFileBytes: 250_000, embeddings });
    await saveIndex(root, first.index);

    const second = await buildIndex({ root, maxFileBytes: 250_000, embeddings: otherEmbeddings });

    expect(second.changed).toBe(1);
    expect(second.reused).toBe(0);
    expect(second.index.embedding).toEqual({ provider: "openai", model: "different-model" });
    expect(second.index.chunks[0]?.vector).toEqual([1, 0]);
    expect(second.index.chunks[0]?.vector).not.toEqual(first.index.chunks[0]?.vector);
  });
});

async function createRepo(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-ask-indexer-"));
  tempRoots.push(root);

  for (const [file, contents] of Object.entries(files)) {
    const filePath = path.join(root, file);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }

  return root;
}

function createFakeEmbeddingProvider(
  provider: "local" | "openai",
  model: string
): EmbeddingProvider {
  return {
    metadata: {
      provider,
      model
    },
    async embed() {
      return [1, 0];
    },
    async embedBatch(inputs: string[]) {
      return inputs.map(() => [1, 0]);
    }
  };
}

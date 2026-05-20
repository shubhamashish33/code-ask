import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { SearchIndex } from "./index-store.js";
import { indexPath, loadIndex, saveIndex } from "./index-store.js";

const tempRoots: string[] = [];

describe("index store", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("saves and loads an index under .code-ask", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "code-ask-"));
    tempRoots.push(root);
    const index: SearchIndex = {
      version: 1,
      root,
      createdAt: "2026-05-20T00:00:00.000Z",
      files: 1,
      chunks: [
        {
          id: "src/index.ts:1-1",
          file: "src/index.ts",
          startLine: 1,
          endLine: 1,
          text: "console.log('hello')",
          vector: { 1: 1 }
        }
      ]
    };

    const savedTo = await saveIndex(root, index);
    const loaded = await loadIndex(root);

    expect(savedTo).toBe(indexPath(root));
    expect(loaded).toEqual(index);
  });

  it("rejects unsupported index versions", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "code-ask-"));
    tempRoots.push(root);
    await saveIndex(root, {
      version: 1,
      root,
      createdAt: "2026-05-20T00:00:00.000Z",
      files: 0,
      chunks: []
    });

    await writeFile(indexPath(root), JSON.stringify({ version: 2, chunks: [] }), "utf8");

    await expect(loadIndex(root)).rejects.toThrow("Unsupported or corrupt index");
  });
});

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createEmbeddingProvider } from "./embeddings.js";
import { buildIndex } from "./indexer.js";
import { indexPath, saveIndex } from "./index-store.js";
import { formatHumanStatus, formatJsonStatus, getIndexStatus } from "./status.js";

const tempRoots: string[] = [];
const embeddings = createEmbeddingProvider({ provider: "local" });

describe("getIndexStatus", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("reports a missing index", async () => {
    const root = await createRepo({
      "src/index.ts": "export const app = true;\n"
    });

    const status = await getIndexStatus({ root, maxFileBytes: 250_000 });

    expect(status).toEqual({
      status: "missing",
      root,
      indexPath: indexPath(root),
      createdAt: null,
      embedding: null,
      files: 0,
      chunks: 0,
      changes: {
        added: 0,
        modified: 0,
        removed: 0,
        skippedLarge: 0
      }
    });
  });

  it("reports a fresh index", async () => {
    const root = await createRepo({
      "src/index.ts": "export const app = true;\n"
    });
    const first = await buildIndex({ root, maxFileBytes: 250_000, embeddings });
    await saveIndex(root, first.index);

    const status = await getIndexStatus({ root, maxFileBytes: 250_000 });

    expect(status.status).toBe("fresh");
    expect(status.files).toBe(1);
    expect(status.chunks).toBe(1);
    expect(status.embedding).toEqual({ provider: "local", model: "local-hash-v1" });
    expect(status.changes).toEqual({
      added: 0,
      modified: 0,
      removed: 0,
      skippedLarge: 0
    });
  });

  it("reports added, modified, and removed files", async () => {
    const root = await createRepo({
      "src/auth.ts": "export function authenticateUser() { return true; }\n",
      "src/billing.ts": "export function createInvoice() { return true; }\n"
    });
    const first = await buildIndex({ root, maxFileBytes: 250_000, embeddings });
    await saveIndex(root, first.index);
    await writeFile(path.join(root, "src", "auth.ts"), "export function authorizeUser() { return true; }\n");
    await writeFile(path.join(root, "src", "users.ts"), "export const users = [];\n");
    await rm(path.join(root, "src", "billing.ts"));

    const status = await getIndexStatus({ root, maxFileBytes: 250_000 });

    expect(status.status).toBe("stale");
    expect(status.changes).toEqual({
      added: 1,
      modified: 1,
      removed: 1,
      skippedLarge: 0
    });
  });

  it("does not report oversized discovered files as added", async () => {
    const root = await createRepo({
      "src/index.ts": "x\n"
    });
    const first = await buildIndex({ root, maxFileBytes: 250_000, embeddings });
    await saveIndex(root, first.index);
    await writeFile(path.join(root, "src", "large.ts"), "x".repeat(20));

    const status = await getIndexStatus({ root, maxFileBytes: 10 });

    expect(status.status).toBe("fresh");
    expect(status.changes).toEqual({
      added: 0,
      modified: 0,
      removed: 0,
      skippedLarge: 1
    });
  });

  it("reports a corrupt index", async () => {
    const root = await createRepo({
      "src/index.ts": "export const app = true;\n"
    });
    await mkdir(path.dirname(indexPath(root)), { recursive: true });
    await writeFile(indexPath(root), "{not json", "utf8");

    const status = await getIndexStatus({ root, maxFileBytes: 250_000 });

    expect(status.status).toBe("corrupt");
    expect(status.error).toBeDefined();
  });
});

describe("status formatting", () => {
  it("formats human status and JSON status", async () => {
    const status = {
      status: "stale" as const,
      root: "/repo",
      indexPath: "/repo/.code-ask/index.json",
      createdAt: "2026-05-22T00:00:00.000Z",
      embedding: {
        provider: "local" as const,
        model: "local-hash-v1"
      },
      files: 2,
      chunks: 3,
      changes: {
        added: 1,
        modified: 0,
        removed: 0,
        skippedLarge: 1
      }
    };

    expect(formatHumanStatus(status)).toBe(
      'Status: stale\nRoot: /repo\nIndex: /repo/.code-ask/index.json\nCreated: 2026-05-22T00:00:00.000Z\nEmbeddings: local:local-hash-v1\nFiles: 2\nChunks: 3\nChanges: 1 added, 0 modified, 0 removed, 1 skipped-large\nRun "code-ask index" to refresh the index.'
    );
    expect(JSON.parse(formatJsonStatus(status))).toEqual(status);
  });
});

async function createRepo(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-ask-status-"));
  tempRoots.push(root);

  for (const [file, contents] of Object.entries(files)) {
    const filePath = path.join(root, file);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }

  return root;
}

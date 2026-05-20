import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { discoverFiles } from "./discovery.js";

const tempRoots: string[] = [];

describe("discoverFiles", () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  it("respects root .gitignore patterns", async () => {
    const root = await createRepo({
      ".gitignore": "ignored.ts\n",
      "src/kept.ts": "export const kept = true;\n",
      "ignored.ts": "export const ignored = true;\n"
    });

    await expect(discoverFiles(root)).resolves.toEqual(["src/kept.ts"]);
  });

  it("layers optional .codeaskignore on top of .gitignore", async () => {
    const root = await createRepo({
      ".gitignore": "generated/**\n!generated/keep.ts\n",
      ".codeaskignore": "docs/**\n",
      "src/index.ts": "export const app = true;\n",
      "docs/notes.md": "# notes\n",
      "generated/drop.ts": "export const drop = true;\n",
      "generated/keep.ts": "export const keep = true;\n"
    });

    const files = await discoverFiles(root);

    expect(files.slice().sort()).toEqual(["generated/keep.ts", "src/index.ts"]);
  });

  it("works when ignore files are absent", async () => {
    const root = await createRepo({
      "src/index.ts": "export const app = true;\n"
    });

    await expect(discoverFiles(root)).resolves.toEqual(["src/index.ts"]);
  });
});

async function createRepo(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "code-ask-discovery-"));
  tempRoots.push(root);

  for (const [file, contents] of Object.entries(files)) {
    const filePath = path.join(root, file);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
  }

  return root;
}

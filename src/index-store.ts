import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { CodeChunk } from "./chunk.js";
import type { SparseVector } from "./vector.js";

export type IndexedChunk = CodeChunk & {
  vector: SparseVector;
};

export type IndexedFile = {
  path: string;
  size: number;
  mtimeMs: number;
  hash: string;
  chunkIds: string[];
};

export type SearchIndex = {
  version: 2;
  root: string;
  createdAt: string;
  files: IndexedFile[];
  chunks: IndexedChunk[];
};

export function indexPath(root: string): string {
  return path.join(path.resolve(root), ".code-ask", "index.json");
}

export async function saveIndex(root: string, index: SearchIndex): Promise<string> {
  const filePath = indexPath(root);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  return filePath;
}

export async function loadIndex(root: string): Promise<SearchIndex> {
  const filePath = indexPath(root);
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as SearchIndex;

  if (parsed.version !== 2 || !Array.isArray(parsed.files) || !Array.isArray(parsed.chunks)) {
    throw new Error(`Unsupported or corrupt index at ${filePath}`);
  }

  return parsed;
}

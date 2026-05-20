import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { chunkFile } from "./chunk.js";
import { discoverFiles } from "./discovery.js";
import { type IndexedChunk, type IndexedFile, type SearchIndex, loadIndex } from "./index-store.js";
import { embedText } from "./vector.js";

export type BuildIndexOptions = {
  root: string;
  maxFileBytes: number;
};

export type BuildIndexResult = {
  index: SearchIndex;
  changed: number;
  reused: number;
  skipped: number;
  removed: number;
};

export async function buildIndex(options: BuildIndexOptions): Promise<BuildIndexResult> {
  const root = path.resolve(options.root);
  const files = await discoverFiles(root);
  const previous = await loadReusableIndex(root);
  const previousFiles = new Map(previous?.files.map((file) => [file.path, file]) ?? []);
  const previousChunks = new Map(previous?.chunks.map((chunk) => [chunk.id, chunk]) ?? []);
  const currentFileSet = new Set(files);
  const indexedFiles: IndexedFile[] = [];
  const indexedChunks: IndexedChunk[] = [];
  let changed = 0;
  let reused = 0;
  let skipped = 0;

  for (const file of files) {
    const fullPath = path.join(root, file);
    const fileStats = await stat(fullPath);

    if (fileStats.size > options.maxFileBytes) {
      skipped += 1;
      continue;
    }

    const previousFile = previousFiles.get(file);
    if (previousFile && isUnchangedByStats(previousFile, fileStats)) {
      const chunks = chunksForFile(previousFile, previousChunks);

      if (chunks.length === previousFile.chunkIds.length) {
        indexedFiles.push(previousFile);
        indexedChunks.push(...chunks);
        reused += 1;
        continue;
      }
    }

    const contents = await readFile(fullPath, "utf8");
    const hash = hashContents(contents);

    if (previousFile && previousFile.hash === hash) {
      const chunks = chunksForFile(previousFile, previousChunks);

      if (chunks.length === previousFile.chunkIds.length) {
        indexedFiles.push({
          ...previousFile,
          size: fileStats.size,
          mtimeMs: fileStats.mtimeMs,
          hash
        });
        indexedChunks.push(...chunks);
        reused += 1;
        continue;
      }
    }

    const chunks = chunkFile(file, contents).map((chunk) => ({
      ...chunk,
      vector: embedText(`${chunk.file}\n${chunk.text}`)
    }));

    indexedFiles.push({
      path: file,
      size: fileStats.size,
      mtimeMs: fileStats.mtimeMs,
      hash,
      chunkIds: chunks.map((chunk) => chunk.id)
    });
    indexedChunks.push(...chunks);
    changed += 1;
  }

  const index: SearchIndex = {
    version: 2,
    root,
    createdAt: new Date().toISOString(),
    files: indexedFiles,
    chunks: indexedChunks
  };

  return {
    index,
    changed,
    reused,
    skipped,
    removed: countRemovedFiles(previous?.files ?? [], currentFileSet)
  };
}

function isUnchangedByStats(file: IndexedFile, stats: { size: number; mtimeMs: number }): boolean {
  return file.size === stats.size && file.mtimeMs === stats.mtimeMs;
}

function chunksForFile(file: IndexedFile, chunks: Map<string, IndexedChunk>): IndexedChunk[] {
  return file.chunkIds.flatMap((chunkId) => {
    const chunk = chunks.get(chunkId);
    return chunk ? [chunk] : [];
  });
}

function hashContents(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

async function loadReusableIndex(root: string): Promise<SearchIndex | undefined> {
  try {
    return await loadIndex(root);
  } catch {
    return undefined;
  }
}

function countRemovedFiles(previousFiles: IndexedFile[], currentFiles: Set<string>): number {
  return previousFiles.filter((file) => !currentFiles.has(file.path)).length;
}

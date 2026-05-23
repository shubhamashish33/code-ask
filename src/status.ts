import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { discoverFiles } from "./discovery.js";
import { type SearchIndex, indexPath, loadIndex } from "./index-store.js";

export type IndexStatusState = "fresh" | "stale" | "missing" | "corrupt";

export type IndexStatus = {
  status: IndexStatusState;
  root: string;
  indexPath: string;
  createdAt: string | null;
  embedding: SearchIndex["embedding"] | null;
  files: number;
  chunks: number;
  changes: {
    added: number;
    modified: number;
    removed: number;
    skippedLarge: number;
  };
  error?: string;
};

export type GetIndexStatusOptions = {
  root: string;
  maxFileBytes: number;
};

export async function getIndexStatus(options: GetIndexStatusOptions): Promise<IndexStatus> {
  const root = path.resolve(options.root);
  const filePath = indexPath(root);
  let index: SearchIndex;

  try {
    index = await loadIndex(root);
  } catch (error) {
    return emptyStatus({
      status: isNodeError(error) && error.code === "ENOENT" ? "missing" : "corrupt",
      root,
      indexPath: filePath,
      error: isNodeError(error) && error.code === "ENOENT" ? undefined : errorMessage(error)
    });
  }

  const discoveredFiles = await discoverFiles(root);
  const discoveredFileSet = new Set(discoveredFiles);
  const indexedFiles = new Map(index.files.map((file) => [file.path, file]));
  const changes = {
    added: 0,
    modified: 0,
    removed: 0,
    skippedLarge: 0
  };

  for (const file of discoveredFiles) {
    const fileStats = await stat(path.join(root, file));

    if (fileStats.size > options.maxFileBytes) {
      changes.skippedLarge += 1;
      continue;
    }

    const indexedFile = indexedFiles.get(file);
    if (!indexedFile) {
      changes.added += 1;
      continue;
    }

    if (indexedFile.size === fileStats.size && indexedFile.mtimeMs === fileStats.mtimeMs) {
      continue;
    }

    const contents = await readFile(path.join(root, file), "utf8");
    if (indexedFile.hash !== hashContents(contents)) {
      changes.modified += 1;
    }
  }

  for (const indexedFile of index.files) {
    if (!discoveredFileSet.has(indexedFile.path)) {
      changes.removed += 1;
    }
  }

  const status = changes.added > 0 || changes.modified > 0 || changes.removed > 0 ? "stale" : "fresh";

  return {
    status,
    root,
    indexPath: filePath,
    createdAt: index.createdAt,
    embedding: index.embedding,
    files: index.files.length,
    chunks: index.chunks.length,
    changes
  };
}

export function formatHumanStatus(status: IndexStatus): string {
  const lines = [
    `Status: ${status.status}`,
    `Root: ${status.root}`,
    `Index: ${status.indexPath}`
  ];

  if (status.error) {
    lines.push(`Error: ${status.error}`);
  }

  if (status.createdAt) {
    lines.push(`Created: ${status.createdAt}`);
  }

  if (status.embedding) {
    lines.push(`Embeddings: ${status.embedding.provider}:${status.embedding.model}`);
  }

  lines.push(`Files: ${status.files}`);
  lines.push(`Chunks: ${status.chunks}`);
  lines.push(
    `Changes: ${status.changes.added} added, ${status.changes.modified} modified, ${status.changes.removed} removed, ${status.changes.skippedLarge} skipped-large`
  );

  if (status.status !== "fresh") {
    lines.push('Run "code-ask index" to refresh the index.');
  }

  return lines.join("\n");
}

export function formatJsonStatus(status: IndexStatus): string {
  return `${JSON.stringify(status, null, 2)}\n`;
}

function emptyStatus(options: {
  status: "missing" | "corrupt";
  root: string;
  indexPath: string;
  error?: string;
}): IndexStatus {
  return {
    status: options.status,
    root: options.root,
    indexPath: options.indexPath,
    createdAt: null,
    embedding: null,
    files: 0,
    chunks: 0,
    changes: {
      added: 0,
      modified: 0,
      removed: 0,
      skippedLarge: 0
    },
    ...(options.error ? { error: options.error } : {})
  };
}

function hashContents(contents: string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

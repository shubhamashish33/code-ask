#!/usr/bin/env node

import path from "node:path";

import { Command } from "commander";

import { createEmbeddingProvider, type EmbeddingProviderName } from "./embeddings.js";
import { formatHumanResults, formatJsonResults } from "./format.js";
import { type SearchIndex, loadIndex, saveIndex } from "./index-store.js";
import { buildIndex } from "./indexer.js";
import { searchIndex } from "./search.js";

class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

const program = new Command();

program
  .name("code-ask")
  .description("Index a repository and ask semantic questions about the code.")
  .version("0.1.0");

program
  .command("index")
  .description("Build a local semantic index for a repository.")
  .option("-r, --root <path>", "repository root", process.cwd())
  .option("--max-file-bytes <bytes>", "skip files larger than this size", parseInteger, 250_000)
  .option("--embeddings <provider>", "embedding provider: local or openai", parseEmbeddingProvider, "local")
  .option("--embedding-model <model>", "embedding model for remote providers")
  .action(
    async (options: {
      root: string;
      maxFileBytes: number;
      embeddings: EmbeddingProviderName;
      embeddingModel?: string;
    }) => {
    const root = path.resolve(options.root);
    const embeddings = createEmbeddingProvider({
      provider: options.embeddings,
      model: options.embeddingModel
    });
    const result = await buildIndex({ root, maxFileBytes: options.maxFileBytes, embeddings });
    const savedTo = await saveIndex(root, result.index);

    console.log(`Indexed ${result.index.files.length} files into ${result.index.chunks.length} chunks.`);
    console.log(`Changed ${result.changed} files, reused ${result.reused} files.`);
    console.log(`Embeddings ${result.index.embedding.provider}:${result.index.embedding.model}.`);
    if (result.skipped > 0) {
      console.log(`Skipped ${result.skipped} large files.`);
    }
    if (result.removed > 0) {
      console.log(`Removed ${result.removed} deleted files from the index.`);
    }
    console.log(`Wrote ${savedTo}`);
  }
  );

program
  .command("ask")
  .description("Ask a natural-language question about the indexed repository.")
  .argument("<question>", "question to ask")
  .option("-r, --root <path>", "repository root", process.cwd())
  .option("-k, --top-k <count>", "number of chunks to return", parseInteger, 5)
  .option("--json", "print machine-readable JSON")
  .option("--no-snippets", "omit matched source snippets from output")
  .action(
    async (question: string, options: { root: string; topK: number; json?: boolean; snippets: boolean }) => {
    const root = path.resolve(options.root);
    let index: SearchIndex;

    try {
      index = await loadIndex(root);
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        throw new CliError(`No index found for ${root}. Run "code-ask index --root ${root}" first.`);
      }

      throw new CliError(`Could not load index for ${root}: ${errorMessage(error)}`);
    }

    const embeddings = createEmbeddingProvider(index.embedding);
    const results = await searchIndex(index, question, options.topK, embeddings);
    const formatOptions = {
      query: question,
      root,
      includeSnippets: options.snippets
    };

    if (options.json) {
      process.stdout.write(formatJsonResults(results, formatOptions));
    } else {
      console.log(formatHumanResults(results, formatOptions));
    }
  }
  );

try {
  await program.parseAsync();
} catch (error) {
  console.error(`Error: ${errorMessage(error)}`);
  process.exitCode = 1;
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received "${value}"`);
  }

  return parsed;
}

function parseEmbeddingProvider(value: string): EmbeddingProviderName {
  if (value === "local" || value === "openai") {
    return value;
  }

  throw new Error(`Expected embedding provider "local" or "openai", received "${value}"`);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

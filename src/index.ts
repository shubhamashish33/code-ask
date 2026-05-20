#!/usr/bin/env node

import path from "node:path";

import { Command } from "commander";

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
  .action(async (options: { root: string; maxFileBytes: number }) => {
    const root = path.resolve(options.root);
    const result = await buildIndex({ root, maxFileBytes: options.maxFileBytes });
    const savedTo = await saveIndex(root, result.index);

    console.log(`Indexed ${result.index.files.length} files into ${result.index.chunks.length} chunks.`);
    console.log(`Changed ${result.changed} files, reused ${result.reused} files.`);
    if (result.skipped > 0) {
      console.log(`Skipped ${result.skipped} large files.`);
    }
    if (result.removed > 0) {
      console.log(`Removed ${result.removed} deleted files from the index.`);
    }
    console.log(`Wrote ${savedTo}`);
  });

program
  .command("ask")
  .description("Ask a natural-language question about the indexed repository.")
  .argument("<question>", "question to ask")
  .option("-r, --root <path>", "repository root", process.cwd())
  .option("-k, --top-k <count>", "number of chunks to return", parseInteger, 5)
  .action(async (question: string, options: { root: string; topK: number }) => {
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

    const results = searchIndex(index, question, options.topK);

    if (results.length === 0) {
      console.log("No relevant chunks found.");
      return;
    }

    for (const [resultIndex, result] of results.entries()) {
      const { chunk, score } = result;
      console.log(
        `\n${resultIndex + 1}. ${chunk.file}:${chunk.startLine}-${chunk.endLine} (${score.toFixed(3)})`
      );
      console.log(formatSnippet(chunk.text));
    }
  });

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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function formatSnippet(text: string): string {
  const lines = text.split("\n").slice(0, 12);
  return lines.map((line) => `  ${line}`).join("\n");
}

#!/usr/bin/env node

import { Command } from "commander";
import fg from "fast-glob";

const program = new Command();

program
  .name("code-ask")
  .description("Index a repository and ask semantic questions about the code.")
  .version("0.1.0");

program
  .command("index")
  .description("Discover source files and prepare them for semantic indexing.")
  .option("-r, --root <path>", "repository root", process.cwd())
  .action(async (options: { root: string }) => {
    const files = await fg(
      [
        "**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,py,go,rs,java,cs,php,rb,swift,kt,kts,cpp,c,h,hpp}",
        "!node_modules/**",
        "!dist/**",
        "!build/**",
        "!.git/**",
        "!.code-ask/**"
      ],
      {
        cwd: options.root,
        onlyFiles: true,
        dot: true
      }
    );

    console.log(`Discovered ${files.length} files.`);
  });

program
  .command("ask")
  .description("Ask a natural-language question about the indexed repository.")
  .argument("<question>", "question to ask")
  .option("-r, --root <path>", "repository root", process.cwd())
  .action((question: string, options: { root: string }) => {
    console.log(`Question: ${question}`);
    console.log(`Repository: ${options.root}`);
    console.log("Semantic retrieval is not implemented yet.");
  });

await program.parseAsync();

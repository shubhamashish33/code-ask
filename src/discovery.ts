import { readFile } from "node:fs/promises";
import path from "node:path";

import fg from "fast-glob";
import ignore from "ignore";

export const sourcePatterns = [
  "**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,py,go,rs,java,cs,php,rb,swift,kt,kts,cpp,c,h,hpp}",
  "!node_modules/**",
  "!dist/**",
  "!build/**",
  "!coverage/**",
  "!package-lock.json",
  "!npm-shrinkwrap.json",
  "!pnpm-lock.yaml",
  "!yarn.lock",
  "!.git/**",
  "!.code-ask/**"
];

export async function discoverFiles(root: string): Promise<string[]> {
  const absoluteRoot = path.resolve(root);
  const ignored = ignore();
  const ignoreFiles = await Promise.all([
    readIgnoreFile(absoluteRoot, ".gitignore"),
    readIgnoreFile(absoluteRoot, ".codeaskignore")
  ]);

  ignored.add(ignoreFiles.flat());

  const files = await fg(sourcePatterns, {
    cwd: absoluteRoot,
    followSymbolicLinks: false,
    onlyFiles: true,
    dot: true,
    unique: true
  });

  return ignored.filter(files);
}

async function readIgnoreFile(root: string, fileName: string): Promise<string[]> {
  try {
    const contents = await readFile(path.join(root, fileName), "utf8");
    return contents.split(/\r?\n/);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

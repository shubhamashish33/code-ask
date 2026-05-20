import path from "node:path";

import fg from "fast-glob";

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

  return fg(sourcePatterns, {
    cwd: absoluteRoot,
    followSymbolicLinks: false,
    onlyFiles: true,
    dot: true,
    unique: true
  });
}

import type { SearchResult } from "./search.js";

export type FormatOptions = {
  query: string;
  root: string;
  includeSnippets: boolean;
  color?: boolean;
};

export function formatHumanResults(results: SearchResult[], options: FormatOptions): string {
  const color = createColorizer(options.color === true);

  if (results.length === 0) {
    return `No relevant chunks found for ${color.yellow(`"${options.query}"`)}.`;
  }

  const heading = [
    `${color.bold("Query:")} ${color.yellow(`"${options.query}"`)}`,
    `Found ${color.bold(String(results.length))} relevant ${pluralize("chunk", results.length)}.`
  ].join("\n");
  const body = results
    .map((result, index) => {
      const { chunk, score } = result;
      const header = [
        `${color.bold(`${index + 1}.`)} ${color.green(chunk.file)}:${chunk.startLine}-${chunk.endLine}`,
        `   ${color.dim("score")} ${color.cyan(score.toFixed(3))}`
      ].join("\n");

      if (!options.includeSnippets) {
        return header;
      }

      return `${header}\n${formatSnippet(chunk.text, chunk.startLine, options.color)}`;
    })
    .join("\n\n");

  return `${heading}\n\n${body}`;
}

export function formatMarkdownResults(results: SearchResult[], options: FormatOptions): string {
  if (results.length === 0) {
    return `No relevant chunks found for \`${options.query}\`.\n`;
  }

  const sections = [
    `Query: \`${options.query}\``,
    "",
    `Found ${results.length} relevant ${pluralize("chunk", results.length)}.`,
    "",
    ...results.map((result, index) => {
      const { chunk, score } = result;
      const lines = [
        `## ${index + 1}. \`${chunk.file}:${chunk.startLine}-${chunk.endLine}\``,
        "",
        `Score: \`${score.toFixed(3)}\``
      ];

      if (options.includeSnippets) {
        lines.push("", `\`\`\`${languageForFile(chunk.file)}`, snippetText(chunk.text), "```");
      }

      return lines.join("\n");
    })
  ];

  return `${sections.join("\n")}\n`;
}

export function formatJsonResults(results: SearchResult[], options: FormatOptions): string {
  return `${JSON.stringify(
    {
      query: options.query,
      root: options.root,
      count: results.length,
      results: results.map((result, index) => {
        const formatted = {
          rank: index + 1,
          file: result.chunk.file,
          startLine: result.chunk.startLine,
          endLine: result.chunk.endLine,
          score: Number(result.score.toFixed(6))
        };

        return options.includeSnippets
          ? {
              ...formatted,
              snippet: snippetText(result.chunk.text)
            }
          : formatted;
      })
    },
    null,
    2
  )}\n`;
}

function formatSnippet(text: string, startLine: number, color = false): string {
  const colorizer = createColorizer(color);
  const lines = text
    .split("\n")
    .slice(0, 12)
    .map((line, index) => {
      const lineNumber = String(startLine + index).padStart(4, " ");
      return `${colorizer.dim(lineNumber)} ${colorizer.dim("|")} ${line}`;
    });

  if (text.split("\n").length > 12) {
    lines.push(`${colorizer.dim("    ")} ${colorizer.dim("|")} ${colorizer.dim("...")}`);
  }

  return lines
    .join("\n");
}

function snippetText(text: string): string {
  return text.split("\n").slice(0, 12).join("\n");
}

function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

function languageForFile(file: string): string {
  const extension = file.split(".").pop()?.toLowerCase();
  const languages: Record<string, string> = {
    cjs: "js",
    cpp: "cpp",
    cs: "csharp",
    cts: "ts",
    go: "go",
    h: "c",
    hpp: "cpp",
    java: "java",
    js: "js",
    jsx: "jsx",
    json: "json",
    kt: "kotlin",
    kts: "kotlin",
    md: "md",
    mjs: "js",
    mts: "ts",
    php: "php",
    py: "py",
    rb: "rb",
    rs: "rust",
    swift: "swift",
    ts: "ts",
    tsx: "tsx"
  };

  return extension ? languages[extension] ?? "" : "";
}

function createColorizer(enabled: boolean): {
  bold(value: string): string;
  cyan(value: string): string;
  dim(value: string): string;
  green(value: string): string;
  yellow(value: string): string;
} {
  const wrap = (code: number, value: string) => enabled ? `\u001B[${code}m${value}\u001B[0m` : value;

  return {
    bold: (value) => wrap(1, value),
    cyan: (value) => wrap(36, value),
    dim: (value) => wrap(2, value),
    green: (value) => wrap(32, value),
    yellow: (value) => wrap(33, value)
  };
}

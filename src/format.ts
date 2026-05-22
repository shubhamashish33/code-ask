import type { SearchResult } from "./search.js";

export type FormatOptions = {
  query: string;
  root: string;
  includeSnippets: boolean;
};

export function formatHumanResults(results: SearchResult[], options: FormatOptions): string {
  if (results.length === 0) {
    return `No relevant chunks found for "${options.query}".`;
  }

  const heading = `Query: "${options.query}"\nFound ${results.length} relevant ${pluralize("chunk", results.length)}.`;
  const body = results
    .map((result, index) => {
      const { chunk, score } = result;
      const header = [
        `${index + 1}. ${chunk.file}:${chunk.startLine}-${chunk.endLine}`,
        `   score ${score.toFixed(3)}`
      ].join("\n");

      if (!options.includeSnippets) {
        return header;
      }

      return `${header}\n${formatSnippet(chunk.text, chunk.startLine)}`;
    })
    .join("\n\n");

  return `${heading}\n\n${body}`;
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

function formatSnippet(text: string, startLine: number): string {
  const lines = text
    .split("\n")
    .slice(0, 12)
    .map((line, index) => {
      const lineNumber = String(startLine + index).padStart(4, " ");
      return `${lineNumber} | ${line}`;
    });

  if (text.split("\n").length > 12) {
    lines.push("     | ...");
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

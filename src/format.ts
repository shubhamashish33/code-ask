import type { SearchResult } from "./search.js";

export type FormatOptions = {
  query: string;
  root: string;
  includeSnippets: boolean;
};

export function formatHumanResults(results: SearchResult[], options: FormatOptions): string {
  if (results.length === 0) {
    return "No relevant chunks found.";
  }

  return results
    .map((result, index) => {
      const { chunk, score } = result;
      const header = `${index + 1}. ${chunk.file}:${chunk.startLine}-${chunk.endLine} (${score.toFixed(3)})`;

      if (!options.includeSnippets) {
        return header;
      }

      return `${header}\n${formatSnippet(chunk.text)}`;
    })
    .join("\n\n");
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

function formatSnippet(text: string): string {
  return snippetText(text)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function snippetText(text: string): string {
  return text.split("\n").slice(0, 12).join("\n");
}

import { describe, expect, it } from "vitest";

import { formatHumanResults, formatJsonResults, formatMarkdownResults } from "./format.js";
import type { SearchResult } from "./search.js";

const results: SearchResult[] = [
  {
    chunk: {
      id: "src/auth.ts:1-2",
      file: "src/auth.ts",
      startLine: 1,
      endLine: 2,
      text: "export function authMiddleware() {\n  return true;\n}",
      vector: {}
    },
    score: 0.8754321
  }
];

const options = {
  query: "auth middleware",
  root: "/repo",
  includeSnippets: true
};

describe("formatHumanResults", () => {
  it("formats ranked results with snippets", () => {
    expect(formatHumanResults(results, options)).toBe(
      'Query: "auth middleware"\nFound 1 relevant chunk.\n\n1. src/auth.ts:1-2\n   score 0.875\n   1 | export function authMiddleware() {\n   2 |   return true;\n   3 | }'
    );
  });

  it("omits snippets when requested", () => {
    expect(formatHumanResults(results, { ...options, includeSnippets: false })).toBe(
      'Query: "auth middleware"\nFound 1 relevant chunk.\n\n1. src/auth.ts:1-2\n   score 0.875'
    );
  });

  it("formats empty results", () => {
    expect(formatHumanResults([], options)).toBe('No relevant chunks found for "auth middleware".');
  });

  it("formats colored output when requested", () => {
    expect(formatHumanResults(results, { ...options, color: true })).toContain(
      "\u001B[32msrc/auth.ts\u001B[0m"
    );
  });
});

describe("formatJsonResults", () => {
  it("formats machine-readable results", () => {
    expect(JSON.parse(formatJsonResults(results, options))).toEqual({
      query: "auth middleware",
      root: "/repo",
      count: 1,
      results: [
        {
          rank: 1,
          file: "src/auth.ts",
          startLine: 1,
          endLine: 2,
          score: 0.875432,
          snippet: "export function authMiddleware() {\n  return true;\n}"
        }
      ]
    });
  });

  it("omits snippets from JSON when requested", () => {
    expect(JSON.parse(formatJsonResults(results, { ...options, includeSnippets: false }))).toEqual({
      query: "auth middleware",
      root: "/repo",
      count: 1,
      results: [
        {
          rank: 1,
          file: "src/auth.ts",
          startLine: 1,
          endLine: 2,
          score: 0.875432
        }
      ]
    });
  });
});

describe("formatMarkdownResults", () => {
  it("formats shareable Markdown results", () => {
    expect(formatMarkdownResults(results, options)).toBe(
      'Query: `auth middleware`\n\nFound 1 relevant chunk.\n\n## 1. `src/auth.ts:1-2`\n\nScore: `0.875`\n\n```ts\nexport function authMiddleware() {\n  return true;\n}\n```\n'
    );
  });

  it("omits snippets from Markdown when requested", () => {
    expect(formatMarkdownResults(results, { ...options, includeSnippets: false })).toBe(
      "Query: `auth middleware`\n\nFound 1 relevant chunk.\n\n## 1. `src/auth.ts:1-2`\n\nScore: `0.875`\n"
    );
  });

  it("formats empty Markdown results", () => {
    expect(formatMarkdownResults([], options)).toBe("No relevant chunks found for `auth middleware`.\n");
  });
});

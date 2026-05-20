import { describe, expect, it } from "vitest";

import { formatHumanResults, formatJsonResults } from "./format.js";
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
      "1. src/auth.ts:1-2 (0.875)\n  export function authMiddleware() {\n    return true;\n  }"
    );
  });

  it("omits snippets when requested", () => {
    expect(formatHumanResults(results, { ...options, includeSnippets: false })).toBe(
      "1. src/auth.ts:1-2 (0.875)"
    );
  });

  it("formats empty results", () => {
    expect(formatHumanResults([], options)).toBe("No relevant chunks found.");
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

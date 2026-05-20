import { describe, expect, it } from "vitest";

import { chunkFile } from "./chunk.js";

describe("chunkFile", () => {
  it("creates a single chunk with file metadata and line range", () => {
    const chunks = chunkFile("src/example.ts", "const a = 1;\nconst b = 2;\n");

    expect(chunks).toEqual([
      {
        id: "src/example.ts:1-3",
        file: "src/example.ts",
        startLine: 1,
        endLine: 3,
        text: "const a = 1;\nconst b = 2;"
      }
    ]);
  });

  it("splits files after the maximum line window", () => {
    const contents = Array.from({ length: 81 }, (_, index) => `line ${index + 1}`).join("\n");
    const chunks = chunkFile("large.ts", contents);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ id: "large.ts:1-80", startLine: 1, endLine: 80 });
    expect(chunks[1]).toMatchObject({ id: "large.ts:81-81", startLine: 81, endLine: 81 });
  });

  it("does not emit empty chunks", () => {
    expect(chunkFile("empty.ts", "\n\n")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { tokenize } from "./vector.js";

describe("tokenize", () => {
  it("splits identifiers and normalizes casing", () => {
    expect(tokenize("getUserProfile user_id")).toEqual(["get", "user", "profile", "user", "id"]);
  });

  it("stems simple plurals and suffixes", () => {
    expect(tokenize("commands registered indexing files")).toEqual([
      "command",
      "register",
      "index",
      "file"
    ]);
  });

  it("keeps numeric tokens", () => {
    expect(tokenize("HTTP2 parser v12")).toContain("12");
  });
});

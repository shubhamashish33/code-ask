import { afterEach, describe, expect, it, vi } from "vitest";

import { createEmbeddingProvider } from "./embeddings.js";

describe("createEmbeddingProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses local embeddings by default", async () => {
    const provider = createEmbeddingProvider({ provider: "local" });

    await expect(provider.embedBatch(["auth middleware"])).resolves.toHaveLength(1);
    expect(provider.metadata).toEqual({ provider: "local", model: "local-hash-v1" });
  });

  it("requires an API key for OpenAI embeddings", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_AGENT_API_KEY", "");

    expect(() => createEmbeddingProvider({ provider: "openai" })).toThrow(
      "OpenAI embeddings require OPENAI_API_KEY or AI_AGENT_API_KEY."
    );
  });

  it("calls an OpenAI-compatible embeddings endpoint", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_BASE_URL", "https://example.test/v1");
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: [
          { index: 1, embedding: [0, 2] },
          { index: 0, embedding: [3, 0] }
        ]
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createEmbeddingProvider({ provider: "openai", model: "custom-embedding" });
    const vectors = await provider.embedBatch(["first", "second"]);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key"
        }),
        body: JSON.stringify({
          model: "custom-embedding",
          input: ["first", "second"],
          encoding_format: "float"
        })
      })
    );
    expect(vectors).toEqual([
      [1, 0],
      [0, 1]
    ]);
  });
});

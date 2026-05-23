import { afterEach, describe, expect, it, vi } from "vitest";

import {
  answerFromResults,
  createAnswerProvider,
  formatHumanAnswer,
  formatJsonAnswer,
  formatMarkdownAnswer
} from "./answer.js";
import type { SearchResult } from "./search.js";

const results: SearchResult[] = [
  {
    chunk: {
      id: "src/index-store.ts:31-44",
      file: "src/index-store.ts",
      startLine: 31,
      endLine: 44,
      text: "export async function saveIndex() {\n  return writeFile(indexPath(root), json);\n}",
      vector: {}
    },
    score: 0.8254321
  }
];

describe("createAnswerProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("requires an API key", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("AI_AGENT_API_KEY", "");

    expect(() => createAnswerProvider()).toThrow(
      "Answer generation requires OPENAI_API_KEY or AI_AGENT_API_KEY."
    );
  });

  it("calls an OpenAI-compatible Responses endpoint", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_BASE_URL", "https://example.test/v1");
    const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async () =>
      Response.json({
        output_text: "The index is saved with saveIndex [1]."
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createAnswerProvider({ model: "custom-model" });
    const answer = await provider.answer({
      query: "how is the index saved?",
      citations: [
        {
          id: 1,
          file: "src/index-store.ts",
          startLine: 31,
          endLine: 44,
          score: 0.8,
          snippet: "export async function saveIndex() {}"
        }
      ]
    });

    expect(answer).toBe("The index is saved with saveIndex [1].");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key"
        })
      })
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body))).toEqual(
      expect.objectContaining({
        model: "custom-model",
        max_output_tokens: 700
      })
    );
  });

  it("extracts text from Responses output content", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(async () =>
      Response.json({
        output: [
          {
            content: [{ text: "The answer uses fallback extraction [1]." }]
          }
        ]
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createAnswerProvider();

    await expect(
      provider.answer({
        query: "test",
        citations: [
          {
            id: 1,
            file: "src/test.ts",
            startLine: 1,
            endLine: 1,
            score: 1,
            snippet: "test"
          }
        ]
      })
    ).resolves.toBe("The answer uses fallback extraction [1].");
  });

  it("does not leak the API key in request failure errors", async () => {
    vi.stubEnv("OPENAI_API_KEY", "secret-key");
    const fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>(
      async () => new Response("nope", { status: 401, statusText: "Unauthorized" })
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = createAnswerProvider();

    await expect(
      provider.answer({
        query: "private code",
        citations: [
          {
            id: 1,
            file: "src/private.ts",
            startLine: 1,
            endLine: 1,
            score: 1,
            snippet: "secret"
          }
        ]
      })
    ).rejects.not.toThrow("secret-key");
  });
});

describe("answerFromResults", () => {
  it("does not call a provider when there are no search results", async () => {
    await expect(answerFromResults({ query: "missing", results: [] })).resolves.toEqual({
      query: "missing",
      answer: "I could not answer confidently from the indexed snippets.",
      model: null,
      citations: []
    });
  });

  it("generates an answer with citations", async () => {
    const provider = {
      model: "test-model",
      answer: vi.fn(async () => "The index is saved by saveIndex [1].")
    };

    const answer = await answerFromResults({
      query: "how is the index saved?",
      results,
      provider
    });

    expect(provider.answer).toHaveBeenCalledWith({
      query: "how is the index saved?",
      citations: [
        expect.objectContaining({
          id: 1,
          file: "src/index-store.ts",
          startLine: 31,
          endLine: 44,
          snippet: "export async function saveIndex() {\n  return writeFile(indexPath(root), json);\n}"
        })
      ]
    });
    expect(answer).toEqual({
      query: "how is the index saved?",
      answer: "The index is saved by saveIndex [1].",
      model: "test-model",
      citations: [
        expect.objectContaining({
          id: 1,
          file: "src/index-store.ts",
          score: 0.8254321
        })
      ]
    });
  });
});

describe("answer formatting", () => {
  const answer = {
    query: "how is the index saved?",
    answer: "The index is saved by saveIndex [1].",
    model: "test-model",
    citations: [
      {
        id: 1,
        file: "src/index-store.ts",
        startLine: 31,
        endLine: 44,
        score: 0.8254321,
        snippet: "export async function saveIndex() {}"
      }
    ]
  };

  it("formats human answers", () => {
    expect(formatHumanAnswer(answer)).toBe(
      "Answer:\nThe index is saved by saveIndex [1].\n\nCitations:\n[1] src/index-store.ts:31-44 (score 0.825)"
    );
  });

  it("formats Markdown answers with snippets", () => {
    expect(formatMarkdownAnswer(answer, { includeSnippets: true })).toBe(
      "# Answer\n\nThe index is saved by saveIndex [1].\n\n## Citations\n\n- [1] src/index-store.ts:31-44 (score 0.825)\n\n```ts\nexport async function saveIndex() {}\n```\n"
    );
  });

  it("formats JSON answers without snippets", () => {
    expect(JSON.parse(formatJsonAnswer(answer, { includeSnippets: false }))).toEqual({
      query: "how is the index saved?",
      answer: "The index is saved by saveIndex [1].",
      model: "test-model",
      citations: [
        {
          id: 1,
          file: "src/index-store.ts",
          startLine: 31,
          endLine: 44,
          score: 0.825432
        }
      ]
    });
  });
});

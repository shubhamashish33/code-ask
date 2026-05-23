import type { SearchResult } from "./search.js";

export type AnswerProviderOptions = {
  model?: string;
};

export type AnswerProvider = {
  model: string;
  answer(input: AnswerInput): Promise<string>;
};

export type AnswerInput = {
  query: string;
  citations: AnswerCitation[];
};

export type AnswerCitation = {
  id: number;
  file: string;
  startLine: number;
  endLine: number;
  score: number;
  snippet?: string;
};

export type AnswerResult = {
  query: string;
  answer: string;
  model: string | null;
  citations: AnswerCitation[];
};

export type FormatAnswerOptions = {
  includeSnippets: boolean;
};

const defaultAnswerModel = "gpt-5.4-mini";
const insufficientAnswer = "I could not answer confidently from the indexed snippets.";

export function createAnswerProvider(options: AnswerProviderOptions = {}): AnswerProvider {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_AGENT_API_KEY;

  if (!apiKey) {
    throw new Error("Answer generation requires OPENAI_API_KEY or AI_AGENT_API_KEY.");
  }

  return createOpenAiAnswerProvider({
    apiKey,
    baseUrl: process.env.OPENAI_BASE_URL ?? process.env.AI_AGENT_BASE_URL ?? "https://api.openai.com/v1",
    model: options.model ?? process.env.CODE_ASK_ANSWER_MODEL ?? defaultAnswerModel
  });
}

export async function answerFromResults(options: {
  query: string;
  results: SearchResult[];
  provider?: AnswerProvider;
}): Promise<AnswerResult> {
  const citations = citationsFromResults(options.results);

  if (citations.length === 0) {
    return {
      query: options.query,
      answer: insufficientAnswer,
      model: options.provider?.model ?? null,
      citations
    };
  }

  if (!options.provider) {
    throw new Error("Answer generation requires an answer provider when citations are available.");
  }

  const answer = await options.provider.answer({
    query: options.query,
    citations
  });

  return {
    query: options.query,
    answer,
    model: options.provider.model,
    citations
  };
}

export function formatHumanAnswer(result: AnswerResult): string {
  const lines = ["Answer:", result.answer, "", "Citations:"];

  if (result.citations.length === 0) {
    lines.push("None.");
  } else {
    lines.push(...result.citations.map(formatCitationLine));
  }

  return lines.join("\n");
}

export function formatMarkdownAnswer(result: AnswerResult, options: FormatAnswerOptions): string {
  const lines = ["# Answer", "", result.answer, "", "## Citations"];

  if (result.citations.length === 0) {
    lines.push("", "None.");
    return `${lines.join("\n")}\n`;
  }

  for (const citation of result.citations) {
    lines.push("", `- ${formatCitationLine(citation)}`);

    if (options.includeSnippets && citation.snippet) {
      lines.push("", `\`\`\`${languageForFile(citation.file)}`, citation.snippet, "```");
    }
  }

  return `${lines.join("\n")}\n`;
}

export function formatJsonAnswer(result: AnswerResult, options: FormatAnswerOptions): string {
  return `${JSON.stringify(
    {
      query: result.query,
      answer: result.answer,
      model: result.model,
      citations: result.citations.map((citation) => {
        const formatted = {
          id: citation.id,
          file: citation.file,
          startLine: citation.startLine,
          endLine: citation.endLine,
          score: Number(citation.score.toFixed(6))
        };

        return options.includeSnippets && citation.snippet
          ? {
              ...formatted,
              snippet: citation.snippet
            }
          : formatted;
      })
    },
    null,
    2
  )}\n`;
}

function createOpenAiAnswerProvider(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
}): AnswerProvider {
  return {
    model: options.model,
    async answer(input: AnswerInput): Promise<string> {
      const response = await fetch(`${options.baseUrl.replace(/\/$/, "")}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: options.model,
          instructions: answerInstructions(),
          input: answerPrompt(input),
          max_output_tokens: 700
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI answer request failed: ${response.status} ${response.statusText}`);
      }

      return extractResponseText(await response.json());
    }
  };
}

function citationsFromResults(results: SearchResult[]): AnswerCitation[] {
  return results.map((result, index) => ({
    id: index + 1,
    file: result.chunk.file,
    startLine: result.chunk.startLine,
    endLine: result.chunk.endLine,
    score: result.score,
    snippet: snippetText(result.chunk.text)
  }));
}

function answerInstructions(): string {
  return [
    "Answer codebase questions using only the provided indexed snippets.",
    "Keep the answer concise and practical.",
    "Cite file evidence using bracketed citation IDs like [1] or [2].",
    "Do not mention files or behavior that is not supported by the snippets.",
    `If the snippets are insufficient, answer exactly: ${insufficientAnswer}`
  ].join("\n");
}

function answerPrompt(input: AnswerInput): string {
  const snippets = input.citations
    .map(
      (citation) =>
        `[${citation.id}] ${citation.file}:${citation.startLine}-${citation.endLine}\n${citation.snippet ?? ""}`
    )
    .join("\n\n");

  return [`Question: ${input.query}`, "", "Indexed snippets:", snippets].join("\n");
}

function extractResponseText(payload: unknown): string {
  if (isRecord(payload) && typeof payload.output_text === "string") {
    return payload.output_text.trim();
  }

  if (isRecord(payload) && Array.isArray(payload.output)) {
    const text = payload.output
      .flatMap((item) => (isRecord(item) && Array.isArray(item.content) ? item.content : []))
      .flatMap((content) => {
        if (!isRecord(content)) {
          return [];
        }

        if (typeof content.text === "string") {
          return [content.text];
        }

        return [];
      })
      .join("\n")
      .trim();

    if (text) {
      return text;
    }
  }

  throw new Error("OpenAI answer response did not include text output.");
}

function formatCitationLine(citation: AnswerCitation): string {
  return `[${citation.id}] ${citation.file}:${citation.startLine}-${citation.endLine} (score ${citation.score.toFixed(3)})`;
}

function snippetText(text: string): string {
  return text.split("\n").slice(0, 12).join("\n");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

import { embedText, type Vector } from "./vector.js";

export type EmbeddingProviderName = "local" | "openai";

export type EmbeddingProvider = {
  metadata: {
    provider: EmbeddingProviderName;
    model: string;
  };
  embed(input: string): Promise<Vector>;
  embedBatch(inputs: string[]): Promise<Vector[]>;
};

export type EmbeddingProviderOptions = {
  provider: EmbeddingProviderName;
  model?: string;
};

const defaultOpenAiModel = "text-embedding-3-small";

export function createEmbeddingProvider(options: EmbeddingProviderOptions): EmbeddingProvider {
  if (options.provider === "openai") {
    return createOpenAiEmbeddingProvider({
      model: options.model ?? defaultOpenAiModel,
      apiKey: process.env.OPENAI_API_KEY ?? process.env.AI_AGENT_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL ?? process.env.AI_AGENT_BASE_URL ?? "https://api.openai.com/v1"
    });
  }

  return {
    metadata: {
      provider: "local",
      model: "local-hash-v1"
    },
    async embed(input: string) {
      return embedText(input);
    },
    async embedBatch(inputs: string[]) {
      return inputs.map(embedText);
    }
  };
}

function createOpenAiEmbeddingProvider(options: {
  model: string;
  apiKey: string | undefined;
  baseUrl: string;
}): EmbeddingProvider {
  if (!options.apiKey) {
    throw new Error("OpenAI embeddings require OPENAI_API_KEY or AI_AGENT_API_KEY.");
  }

  return {
    metadata: {
      provider: "openai",
      model: options.model
    },
    async embed(input: string) {
      const [embedding] = await this.embedBatch([input]);
      return embedding!;
    },
    async embedBatch(inputs: string[]) {
      if (inputs.length === 0) {
        return [];
      }

      const response = await fetch(`${options.baseUrl.replace(/\/$/, "")}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: options.model,
          input: inputs,
          encoding_format: "float"
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI embeddings request failed: ${response.status} ${response.statusText}`);
      }

      const payload = (await response.json()) as {
        data?: Array<{ index: number; embedding: number[] }>;
      };

      if (!Array.isArray(payload.data)) {
        throw new Error("OpenAI embeddings response did not include data.");
      }

      return payload.data
        .slice()
        .sort((left, right) => left.index - right.index)
        .map((item) => normalizeDenseVector(item.embedding));
    }
  };
}

function normalizeDenseVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

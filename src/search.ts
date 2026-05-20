import type { IndexedChunk, SearchIndex } from "./index-store.js";
import type { EmbeddingProvider } from "./embeddings.js";
import { cosineSimilarity, tokenize } from "./vector.js";

export type SearchResult = {
  chunk: IndexedChunk;
  score: number;
};

export async function searchIndex(
  index: SearchIndex,
  query: string,
  limit: number,
  embeddings: EmbeddingProvider
): Promise<SearchResult[]> {
  const queryVector = await embeddings.embed(query);
  const queryTokens = new Set(tokenize(query));

  return index.chunks
    .map((chunk) => {
      const vectorScore = cosineSimilarity(queryVector, chunk.vector);
      const lexicalScore = lexicalOverlap(queryTokens, chunk.text);
      return {
        chunk,
        score: vectorScore * 0.75 + lexicalScore * 0.25
      };
    })
    .filter((result) => result.score > 0)
    .sort(compareResults)
    .slice(0, limit);
}

function compareResults(left: SearchResult, right: SearchResult): number {
  const scoreDifference = right.score - left.score;

  if (Math.abs(scoreDifference) > 0.05) {
    return scoreDifference;
  }

  const codePriorityDifference = filePriority(right.chunk.file) - filePriority(left.chunk.file);
  if (codePriorityDifference !== 0) {
    return codePriorityDifference;
  }

  return scoreDifference;
}

function filePriority(file: string): number {
  return isCodeFile(file) ? 1 : 0;
}

function isCodeFile(file: string): boolean {
  return /\.(?:ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|cs|php|rb|swift|kt|kts|cpp|c|h|hpp)$/i.test(
    file
  );
}

function lexicalOverlap(queryTokens: Set<string>, text: string): number {
  if (queryTokens.size === 0) {
    return 0;
  }

  const textTokens = new Set(tokenize(text));
  let hits = 0;

  for (const token of queryTokens) {
    if (textTokens.has(token)) {
      hits += 1;
    }
  }

  return hits / queryTokens.size;
}

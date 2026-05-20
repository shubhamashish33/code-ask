const dimensions = 384;
const tokenPattern = /[a-zA-Z_][a-zA-Z0-9_]*|[0-9]+/g;

export type SparseVector = Record<number, number>;

export function tokenize(input: string): string[] {
  const tokens = input.match(tokenPattern) ?? [];
  return tokens.flatMap((token) => splitIdentifier(token).map(stemToken));
}

export function embedText(input: string): SparseVector {
  const vector: SparseVector = {};
  const tokens = tokenize(input);

  for (const token of tokens) {
    const index = hash(token) % dimensions;
    vector[index] = (vector[index] ?? 0) + 1;
  }

  normalize(vector);
  return vector;
}

export function cosineSimilarity(left: SparseVector, right: SparseVector): number {
  let score = 0;

  for (const [key, value] of Object.entries(left)) {
    score += value * (right[Number(key)] ?? 0);
  }

  return score;
}

function splitIdentifier(token: string): string[] {
  const spaced = token
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([a-zA-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();

  return spaced.split(/\s+/).filter(Boolean);
}

function stemToken(token: string): string {
  if (token.length > 5 && token.endsWith("ing")) {
    return token.slice(0, -3);
  }

  if (token.length > 4 && token.endsWith("ed")) {
    return token.slice(0, -2);
  }

  if (token.length > 4 && /(?:ches|shes|sses|xes|zes)$/.test(token)) {
    return token.slice(0, -2);
  }

  if (token.length > 3 && token.endsWith("s")) {
    return token.slice(0, -1);
  }

  return token;
}

function normalize(vector: SparseVector): void {
  const magnitude = Math.sqrt(
    Object.values(vector).reduce((sum, value) => sum + value * value, 0)
  );

  if (magnitude === 0) {
    return;
  }

  for (const key of Object.keys(vector)) {
    vector[Number(key)] /= magnitude;
  }
}

function hash(value: string): number {
  let current = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    current ^= value.charCodeAt(index);
    current = Math.imul(current, 16777619);
  }

  return current >>> 0;
}

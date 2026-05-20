# Semantic Code Search CLI

Semantic Code Search CLI is an npm package for indexing a local repository and asking natural-language questions about the code.

## Planned CLI

```bash
npx code-ask index
npx code-ask ask "where is auth handled?"
```

The `index` command discovers common source files, chunks them, computes a local lightweight vector representation, and writes the index to `.code-ask/index.json`.
Discovery respects `.gitignore`; add `.codeaskignore` at the repository root for search-specific exclusions.

The `ask` command loads that index and returns the most relevant file snippets with line ranges and scores:

```bash
npx code-ask ask "where are CLI commands registered?" --top-k 3
npx code-ask ask "auth middleware" --json
npx code-ask ask "auth middleware" --no-snippets --top-k 10
```

Local hashed vectors are used by default. To build an index with OpenAI embeddings:

```bash
OPENAI_API_KEY=... npx code-ask index --embeddings openai
```

`AI_AGENT_API_KEY` can be used as an API-key alias, and `OPENAI_BASE_URL` or `AI_AGENT_BASE_URL` can point at an OpenAI-compatible embeddings endpoint. The query command uses the embedding provider stored in the index.

## Development

```bash
npm install
npm run dev -- --help
npm run build
```

## Roadmap

- File discovery with sensible ignore defaults
- Chunking and local vector index persisted under `.code-ask`
- Embedding provider adapter for higher-quality semantic search
- Query ranking with file and symbol context
- Optional answer synthesis with citations

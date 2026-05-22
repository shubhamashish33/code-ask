# Code Ask

Code Ask is an npm package for indexing a local repository and asking natural-language questions about the code.

## Usage

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
npx code-ask ask "auth middleware" --markdown
npx code-ask ask "auth middleware" --color
npx code-ask ask "auth middleware" --no-snippets --top-k 10
```

Check whether the saved index is current:

```bash
npx code-ask status
npx code-ask status --json
```

Local hashed vectors are used by default. To build an index with OpenAI embeddings:

```bash
OPENAI_API_KEY=... npx code-ask index --embeddings openai
```

`AI_AGENT_API_KEY` can be used as an API-key alias, and `OPENAI_BASE_URL` or `AI_AGENT_BASE_URL` can point at an OpenAI-compatible embeddings endpoint. The query command uses the embedding provider stored in the index.

## Privacy

Local hashed embeddings are local-only. Source chunks are read from disk, converted to local vectors, and stored in `.code-ask/`; they are not sent to a remote service.

When using `--embeddings openai`, code chunks are sent to the configured embeddings endpoint during indexing, and query text is sent during `ask`. Use this only for repositories where that is acceptable.

## Development

```bash
npm install
npm run dev -- --help
npm run build
```

After global or local installation, run the installed binary as `code-ask`.

## Agent Instructions

Lightweight agent instruction files live in `agent-skills/code-ask/` for Codex, Claude, and Gemini. They are repo-local guidance only; do not install them globally.

## Roadmap

- File discovery with sensible ignore defaults
- Chunking and local vector index persisted under `.code-ask`
- Embedding provider adapter for higher-quality semantic search
- Query ranking with file and symbol context
- Optional answer synthesis with citations

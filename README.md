# Semantic Code Search CLI

Semantic Code Search CLI is an npm package for indexing a local repository and asking natural-language questions about the code.

## Planned CLI

```bash
npx code-ask index
npx code-ask ask "where is auth handled?"
```

## Development

```bash
npm install
npm run dev -- --help
npm run build
```

## Roadmap

- File discovery with sensible ignore defaults
- Chunking by language-aware boundaries
- Embedding provider adapter
- Local vector index persisted under `.code-ask`
- Query ranking with file and symbol context
- Optional answer synthesis with citations

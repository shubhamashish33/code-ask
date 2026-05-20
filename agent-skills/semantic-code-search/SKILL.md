---
name: semantic-code-search
description: Use when agents need semantic code search over a local repository to locate implementations, inspect relevant snippets, or gather structured search results before editing.
---

# Semantic Code Search CLI

Use this repo's `code-ask` CLI for semantic code search when exploring unfamiliar code, locating implementations, or collecting cited snippets before editing.

## Setup

- Prefer the local checkout. Run `npm install` if dependencies are missing.
- Build when needed with `npm run build`.
- Use the built CLI directly with `node dist/index.js ...`, or link locally with `npm link` if you need `code-ask` on PATH.

## Index

Index the project you are working on:

```bash
node dist/index.js index --root /path/to/project
```

Re-run `index` after code changes. Incremental indexing reuses unchanged files.

`.code-ask/` is generated cache. Do not edit or commit it.

Local hashed embeddings are the default. If `OPENAI_API_KEY` is available and higher-quality semantic search is worth the API cost, build the index with:

```bash
node dist/index.js index --root /path/to/project --embeddings openai
```

## Ask

Prefer JSON when another agent or script will consume results:

```bash
node dist/index.js ask "auth middleware" --root /path/to/project --json
```

Use compact output when snippets are noisy:

```bash
node dist/index.js ask "auth middleware" --root /path/to/project --no-snippets --top-k 10
```

Use `--top-k` to widen or narrow the result set. Read returned files before editing; search results are hints, not proof.

# Semantic Code Search CLI Adapter

Use `SKILL.md` in this directory as the source of truth.

Claude-specific guidance:

- Build the CLI with `npm run build` if `dist/index.js` is missing or stale.
- Index the target repo before asking questions: `node dist/index.js index --root <repo>`.
- Use `--json` for structured tool-style reasoning and `--no-snippets --top-k 10` for quick scans.
- Re-index after edits before relying on results.
- Treat `.code-ask/` as disposable generated cache.
- Default to local embeddings. Use `--embeddings openai` only when `OPENAI_API_KEY` is available and remote embeddings are appropriate.

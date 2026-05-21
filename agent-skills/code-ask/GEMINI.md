# Code Ask Adapter

Use `SKILL.md` in this directory as the source of truth.

Gemini-specific guidance:

- Run from this repository checkout; build with `npm run build` when needed.
- Index a project with `node dist/index.js index --root <repo>`.
- Query with `node dist/index.js ask "<question>" --root <repo> --json` when you need structured results.
- Use `--no-snippets` and `--top-k` to control output size.
- Re-index after code changes so results reflect the current tree.
- Do not edit or commit `.code-ask/`.
- Keep local embeddings as the default; use `--embeddings openai` only when `OPENAI_API_KEY` is present.

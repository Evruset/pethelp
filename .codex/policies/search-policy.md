# Search-first policy

Choose discovery mode before opening broad directories.

Continuation mode (the active slice and harness are already named):

1. `git status --short` and the relevant `docs/ai/current-state.md` section.
2. One targeted `rg -n` only when an exact symbol/path is still unknown.
3. Do not query the repo map unless targeted inspection fails.

New-scope mode:

1. `git status --short` and `git diff --name-only`.
2. Use `rg -n` for the exact error, route, symbol, state, label, or business term.
3. Query `.codex/cache/repo-map.sqlite3` through `./scripts/repo-map-query.sh` only when targeted search is insufficient.
4. Read only files returned by those searches.
5. Expand through direct imports, calls, routes, schemas, or tests only when evidence requires it.

Prohibited as an initial discovery step:
- recursive `cat` or reading every file in a directory;
- unbounded `find .` output;
- reading `node_modules`, build output, generated code, logs, archives, or reports;
- asking multiple agents to map the same code surface.

Review must be diff-first:
1. `git diff --stat`;
2. `git diff --name-only`;
3. changed hunks;
4. directly affected contracts and tests;
5. surrounding implementation only when evidence shows a dependency.

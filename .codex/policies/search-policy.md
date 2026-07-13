# Search-first policy

Before opening broad directories, use this sequence:

1. `git status --short` and `git diff --name-only`.
2. Query `.codex/cache/repo-map.sqlite3` through `./scripts/repo-map-query.sh` when available.
3. Use `rg -n` for the exact error, route, symbol, state, label, or business term.
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

---
name: repo-map-search
description: Use the local compact repository map to locate relevant source files, symbols, imports, routes, and nearby tests before reading broad code areas. Use for codebase discovery, bug localization, module ownership, and planning. Reindex only when the map is missing or stale.
---

# Repository Map Search

1. Run `./scripts/repo-map-query.sh "<exact symbol, route, or business term>"`.
2. Use at most 10 returned entries.
3. Open only the top relevant files.
4. Confirm with targeted `rg -n` before expanding scope.
5. Reindex with `./scripts/repo-map-index.sh` only when the index is missing or structural code changes make it stale.
6. Return a compact evidence map; never dump the full index.

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sqlite3
from pathlib import Path


def fts_query(value: str) -> str:
    terms = [x for x in re.findall(r"[\w./:@$-]+", value.lower(), re.UNICODE) if len(x) > 1][:12]
    if not terms:
        raise ValueError("No searchable terms")
    return " OR ".join('"' + term.replace('"', '') + '"' for term in terms)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("query")
    parser.add_argument("--db", required=True)
    parser.add_argument("--top", type=int, default=8)
    parser.add_argument("--tests-only", action="store_true")
    parser.add_argument("--max-chars", type=int, default=5000)
    args = parser.parse_args()

    db = Path(args.db)
    if not db.exists():
        print(f"Repository map not found: {db}\nRun ./scripts/repo-map-index.sh first.")
        raise SystemExit(2)

    connection = sqlite3.connect(db)
    where = "repo_files MATCH ?"
    params: list[object] = [fts_query(args.query)]
    if args.tests_only:
        where += " AND is_test = 1"
    rows = connection.execute(
        f"""
        SELECT path, language, symbols, imports, routes, is_test, bm25(repo_files)
        FROM repo_files
        WHERE {where}
        ORDER BY bm25(repo_files)
        LIMIT ?
        """,
        (*params, max(1, min(args.top, 20))),
    ).fetchall()
    connection.close()

    if not rows:
        print("No relevant repository map entries found.")
        raise SystemExit(1)

    used = 0
    for index, (path, lang, symbols, imports, routes, is_test, score) in enumerate(rows, 1):
        lines = [f"{index}. {path} [{lang}]" + (" [test]" if is_test else "")]
        if symbols:
            lines.append("   symbols: " + ", ".join(symbols.split()[:30]))
        if routes:
            lines.append("   routes: " + routes[:500])
        if imports:
            lines.append("   imports: " + ", ".join(imports.split()[:20]))
        block = "\n".join(lines) + "\n"
        remaining = args.max_chars - used
        if remaining <= 0:
            break
        if len(block) > remaining:
            block = block[:remaining].rstrip() + "\n…\n"
        print(block, end="")
        used += len(block)


if __name__ == "__main__":
    main()

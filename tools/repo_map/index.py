#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sqlite3
from pathlib import Path

SOURCE_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".py", ".dart", ".java", ".kt", ".kts", ".go", ".rs", ".cs",
    ".sql", ".graphql", ".gql",
}
SKIP_DIRS = {
    ".git", ".next", ".nuxt", ".turbo", ".cache", ".idea", ".vscode",
    "node_modules", "dist", "build", "coverage", "vendor", "target", "bin", "obj",
    "playwright-report", "test-results", "allure-results", "allure-report", "logs",
    ".venv", "venv", "Pods", "DerivedData", ".codex", ".roo",
}
MAX_FILE_BYTES = 600_000
MAX_FIELD_CHARS = 6000

DECLARATION_PATTERNS = [
    re.compile(r"^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?(?:class|interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)", re.M),
    re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)", re.M),
    re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=", re.M),
    re.compile(r"^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(", re.M),
    re.compile(r"^\s*class\s+([A-Za-z_]\w*)\s*[:(]", re.M),
    re.compile(r"^\s*(?:public|private|protected|internal|static|sealed|abstract|partial|final|open|data|record|struct|class|interface|enum)\s+(?:class\s+|interface\s+|enum\s+|record\s+|struct\s+)?([A-Za-z_]\w*)", re.M),
]
IMPORT_PATTERNS = [
    re.compile(r"(?:from\s+|require\(|import\s+)(?:[\w*{},\s]+\s+from\s+)?[\"']([^\"']+)[\"']"),
    re.compile(r"^\s*from\s+([\w.]+)\s+import\s+", re.M),
    re.compile(r"^\s*import\s+([\w.]+)", re.M),
    re.compile(r"^\s*using\s+([\w.]+)", re.M),
]
ROUTE_PATTERNS = [
    re.compile(r"@(Get|Post|Put|Patch|Delete|Options|Head)\s*\(([^)]*)\)"),
    re.compile(r"\b(?:app|router)\.(get|post|put|patch|delete|options|head)\s*\(([^,]+)"),
    re.compile(r"@(?:RequestMapping|GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping)\s*\(([^)]*)\)"),
    re.compile(r"\b(?:GET|POST|PUT|PATCH|DELETE)\s+(/[\w{}:./-]+)"),
]
TEST_NAME = re.compile(r"(?:^|[._-])(test|spec|e2e)(?:[._-]|$)", re.I)


def should_skip(path: Path, root: Path) -> bool:
    rel = path.relative_to(root)
    rel_text = rel.as_posix()
    if any(part in SKIP_DIRS for part in rel.parts):
        return True
    return rel_text.startswith("tools/rag/") or rel_text.startswith("tools/repo_map/") or rel_text == "tools/affected_tests.py"


def dedupe(values: list[str], limit: int = 80) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for value in values:
        value = " ".join(value.strip().split())
        if value and value not in seen:
            seen.add(value)
            out.append(value)
        if len(out) >= limit:
            break
    return out


def extract(text: str) -> tuple[list[str], list[str], list[str]]:
    symbols: list[str] = []
    imports: list[str] = []
    routes: list[str] = []
    for pattern in DECLARATION_PATTERNS:
        symbols.extend(pattern.findall(text))
    for pattern in IMPORT_PATTERNS:
        imports.extend(pattern.findall(text))
    for pattern in ROUTE_PATTERNS:
        for match in pattern.findall(text):
            if isinstance(match, tuple):
                routes.append(" ".join(str(x) for x in match if x))
            else:
                routes.append(str(match))
    return dedupe(symbols), dedupe(imports), dedupe(routes)


def language(path: Path) -> str:
    return path.suffix.lower().lstrip(".") or "unknown"


def iter_files(root: Path):
    for path in root.rglob("*"):
        if not path.is_file() or should_skip(path, root):
            continue
        if path.suffix.lower() not in SOURCE_EXTENSIONS:
            continue
        try:
            if path.stat().st_size > MAX_FILE_BYTES:
                continue
        except OSError:
            continue
        yield path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--db", required=True)
    args = parser.parse_args()

    root = Path(args.root).resolve()
    db = Path(args.db).resolve()
    db.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db)
    connection.executescript(
        """
        PRAGMA journal_mode=WAL;
        DROP TABLE IF EXISTS repo_files;
        CREATE VIRTUAL TABLE repo_files USING fts5(
            path UNINDEXED,
            language,
            symbols,
            imports,
            routes,
            summary,
            is_test UNINDEXED,
            mtime UNINDEXED,
            tokenize='unicode61 remove_diacritics 2'
        );
        """
    )

    count = 0
    tests = 0
    for path in iter_files(root):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
            stat = path.stat()
        except OSError:
            continue
        rel = path.relative_to(root).as_posix()
        symbols, imports, routes = extract(text)
        is_test = int(bool(TEST_NAME.search(path.name)) or "__tests__" in path.parts or "tests" in path.parts)
        tests += is_test
        summary_parts = [rel]
        if symbols:
            summary_parts.append("symbols " + ", ".join(symbols[:25]))
        if routes:
            summary_parts.append("routes " + ", ".join(routes[:15]))
        summary = "; ".join(summary_parts)[:MAX_FIELD_CHARS]
        connection.execute(
            "INSERT INTO repo_files VALUES (?,?,?,?,?,?,?,?)",
            (
                rel,
                language(path),
                " ".join(symbols)[:MAX_FIELD_CHARS],
                " ".join(imports)[:MAX_FIELD_CHARS],
                " ".join(routes)[:MAX_FIELD_CHARS],
                summary,
                is_test,
                int(stat.st_mtime),
            ),
        )
        count += 1
    connection.commit()
    connection.close()
    print(f"Indexed {count} source files ({tests} tests) into {db}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

SKIP = {
    "node_modules", ".git", ".next", "dist", "build", "coverage", "vendor",
    ".codex", "playwright-report", "test-results", "allure-results", "target", "bin", "obj",
}
TEST_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".py", ".cs", ".java", ".kt", ".dart", ".go", ".rs"}


def git_changed(root: Path, base: str | None) -> list[str]:
    commands: list[list[str]] = []
    if base:
        commands.append(["git", "diff", "--name-only", f"{base}...HEAD"])
    commands.extend([
        ["git", "diff", "--name-only"],
        ["git", "diff", "--cached", "--name-only"],
    ])
    found: list[str] = []
    for command in commands:
        result = subprocess.run(command, cwd=root, text=True, capture_output=True, check=False)
        if result.returncode == 0:
            found.extend(line.strip() for line in result.stdout.splitlines() if line.strip())
    return list(dict.fromkeys(found))


def is_test_file(path: Path) -> bool:
    name = path.name.lower()
    return (
        any(token in name for token in (".test.", ".spec.", "e2e-spec", "_test.", "test_"))
        or "__tests__" in path.parts
        or "tests" in path.parts
        or "test" in path.parts
    )


def iter_tests(root: Path):
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEST_EXTENSIONS:
            continue
        rel = path.relative_to(root)
        if any(part in SKIP for part in rel.parts):
            continue
        if is_test_file(rel):
            yield path


def package_root(path: Path, root: Path) -> Path:
    current = path.parent
    while True:
        markers = (
            (current / "package.json").exists(),
            (current / "pyproject.toml").exists(),
            (current / "pubspec.yaml").exists(),
            (current / "go.mod").exists(),
            any(current.glob("*.sln")),
        )
        if any(markers):
            return current
        if current == root or current.parent == current:
            return root
        current = current.parent


def normalized_stem(path: Path) -> str:
    value = path.stem.lower()
    for token in (".service", ".controller", ".component", ".module", ".repository", ".resolver"):
        value = value.replace(token, "")
    return value


def score(test: Path, source: Path) -> int:
    value = 0
    stem = normalized_stem(source)
    test_name = test.stem.lower()
    if stem and stem in test_name:
        value += 100
    prefix = 0
    for left, right in zip(source.parts, test.parts):
        if left != right:
            break
        prefix += 1
    value += prefix * 5
    if test.parent == source.parent:
        value += 40
    if source.parent.name and source.parent.name in test.parts:
        value += 20
    return value


def command_hints(root: Path, tests: list[Path]) -> list[str]:
    hints: list[str] = []
    by_package: dict[Path, list[Path]] = {}
    for test in tests:
        package = package_root(test, root)
        by_package.setdefault(package, []).append(test)

    for package, paths in by_package.items():
        rel_package = package.relative_to(root).as_posix() if package != root else "."
        rel_tests = [path.relative_to(package).as_posix() for path in paths[:5]]
        if (package / "package.json").exists():
            try:
                scripts = json.loads((package / "package.json").read_text()).get("scripts", {})
            except Exception:
                scripts = {}
            uses_pnpm = (root / "pnpm-lock.yaml").exists() or (package / "pnpm-lock.yaml").exists()
            if "test" in scripts:
                command = "pnpm test" if uses_pnpm else "npm test --"
                hints.append(f"cd {rel_package} && {command} {' '.join(rel_tests)}")
            if "typecheck" in scripts:
                command = "pnpm typecheck" if uses_pnpm else "npm run typecheck"
                hints.append(f"cd {rel_package} && {command}")
        elif (package / "pyproject.toml").exists():
            hints.append("pytest " + " ".join(str(path.relative_to(root)) for path in paths[:5]))
        elif (package / "pubspec.yaml").exists():
            hints.append("flutter test " + " ".join(str(path.relative_to(root)) for path in paths[:5]))
        elif (package / "go.mod").exists():
            hints.append(f"cd {rel_package} && go test ./...")
    return list(dict.fromkeys(hints))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="*")
    parser.add_argument("--root", default=".")
    parser.add_argument("--base")
    parser.add_argument("--top", type=int, default=12)
    args = parser.parse_args()

    root = Path(args.root).resolve()
    explicit = bool(args.files)
    changed = args.files or git_changed(root, args.base)
    if not explicit:
        ignored = (".codex/", ".agents/", ".vscode/", "docs/ai/", "scripts/", "tools/rag/", "tools/repo_map/")
        changed = [
            value for value in changed
            if value not in {"AGENTS.md", ".gitignore"}
            and not value.startswith(ignored)
        ]
    changed_paths = [root / value for value in changed if (root / value).exists()]
    if not changed_paths:
        print("No changed files found. Pass paths explicitly or create a git diff.")
        raise SystemExit(1)

    tests = list(iter_tests(root))
    ranked: dict[Path, int] = {}
    for source in changed_paths:
        if source in tests:
            ranked[source] = 1000
        for test in tests:
            current = score(test, source)
            if current > 20:
                ranked[test] = max(ranked.get(test, 0), current)

    selected = [
        path for path, _ in sorted(ranked.items(), key=lambda item: (-item[1], str(item[0])))[: max(1, args.top)]
    ]

    print("Changed files:")
    for path in changed_paths[:30]:
        print("-", path.relative_to(root))

    print("\nCandidate affected tests:")
    if not selected:
        print("- No close test file found; use module-level typecheck or targeted integration search.")
    else:
        for path in selected:
            print("-", path.relative_to(root))

    hints = command_hints(root, selected)
    if hints:
        print("\nCandidate commands (review before running):")
        for hint in hints:
            print("-", hint)


if __name__ == "__main__":
    main()

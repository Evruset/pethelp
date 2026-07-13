# AI task

## Reasoning

`low`

Use `medium/high` only when the task contains ambiguity, several modules or meaningful trade-offs.

## Goal

Describe one concrete outcome.

## Allowed scope

- `path/to/file-or-directory`

## Acceptance criteria

- Observable criterion 1.
- Observable criterion 2.
- Regression criterion.

## Do not change

- Unrelated modules.
- Public API unless explicitly listed.
- Applied migrations.
- Dependencies unless explicitly required.
- Existing dirty files outside the allowed scope.

## Verification

- Targeted typecheck/lint/test command.
- Affected integration or Playwright scenario if relevant.
- Full build only if the change crosses modules.

## Response

Return only:
1. changed files;
2. implemented behavior;
3. checks and results;
4. unresolved risks.

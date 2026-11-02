# Prompt recipes

## Default

```text
$adaptive-orchestrator

Goal: <what should work for the user>
Acceptance: <observable result>
Constraints: <what must not change>
```

You may omit technical paths; the orchestrator should start with targeted search
and use the repo map only when narrower discovery is insufficient. The root is
the default implementer; delegation requires a bounded independent workstream.

## Exact small fix

```text
$fast-fix
Goal: <precise change>
Files: <exact files when known>
Acceptance: <observable result>
Do not: <unrelated changes>
Validation: <targeted check>
```

## Explicit parallel feature

```text
$parallel-feature
Independent slices:
- backend: <scope>
- frontend: <scope>
- tests: <scope>
Shared contract: <source>
Maximum agents: 3. Sol only for high-risk review or disagreement.
```

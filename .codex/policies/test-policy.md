# Affected-test policy

Prefer the smallest evidence set that proves the changed behavior:

1. lint or static check for changed files;
2. nearest unit tests;
3. module/workspace typecheck;
4. integration tests for the changed API or state boundary;
5. one affected UI/e2e scenario;
6. full suite only for shared contracts, schema, auth, state-machine, shared packages, or multi-context changes.

Use `./scripts/affected-tests.sh` to propose candidate tests before broad test discovery.
Limit logs with `tail` or test-runner filters and report summaries rather than full output.

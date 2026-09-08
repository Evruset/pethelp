# Tooling debt: Owner Home focused Jest reproduction

Status: `RESOLVED`

Date: 2026-07-14

## Reproduction

- Environment: canonical `docker-compose.local.yml` backend service, Linux `6.10.11-linuxkit`.
- Node: `v22.23.1`; npm: `10.9.8`.
- Command: `npm test -- src/owner-home/owner-home.controller.spec.ts src/owner-home/owner-home.service.spec.ts --runInBand`.
- Exit code: `234` (`npm` internal code `-22`).
- Tests discovered: `0`; tests passed: `0`; Jest did not start.
- Failure stage: npm `run-script` child-process creation, `Error: spawn EINVAL` from `@npmcli/promise-spawn`.
- Container state: `node_modules/.bin/jest` and `node_modules/jest/bin/jest.js` were missing in the mounted backend dependency volume.

## Verdict

`ACCEPTABLE_WITH_ENV_BLOCKER`, not PASS. Earlier implementation harness evidence remains recorded, but this clean reproduction cannot independently validate source behavior until the canonical dependency volume is repaired.

## Resolution gate

Recreate/repair the canonical backend dependency volume through the project-approved environment bootstrap, then run the same focused command and record actual Jest discovery/pass counts. Do not treat npm startup as a test execution.

## Resolution evidence

- Bootstrap: `docker compose -f docker-compose.local.yml up -d --force-recreate backend` (the canonical service command installed dependencies and applied migrations).
- Environment: Compose backend, Node `v22.23.1`, npm `10.9.8`.
- Command: `docker compose -f docker-compose.local.yml exec -T backend npm test -- src/auth/owner-pet-v50.service.spec.ts src/auth/owner-pet.service.spec.ts src/owner-home/owner-home.service.spec.ts src/owner-home/owner-home.controller.spec.ts --runInBand`.
- Exit code: `0`; Jest started; 4 suites discovered and passed; 22 tests discovered and passed.
- Final verdict: `PASS`; the earlier `spawn EINVAL` was dependency-volume state, not source behavior.

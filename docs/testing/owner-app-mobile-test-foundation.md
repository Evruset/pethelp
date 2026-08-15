# Owner App mobile test foundation

## Scope

This checkpoint defines the first-MVP mobile test layers for `apps/owner-app`. It does not replace backend concurrency/idempotency tests and does not add a fake production session path.

## Automated foundation matrix

| Contract | Layer | Current evidence |
| --- | --- | --- |
| API success, malformed response, network/abort and 401/403/409/422/5xx normalization | unit | `src/api/client.test.ts` |
| environment validation and safe public configuration | unit | `src/config/env.test.ts`, `app.config.test.ts` |
| SecureStore serialization/validation | unit | `src/session/secure-session-store.test.ts` |
| bootstrap pending, absent, valid, invalid and expired session | integration/component | `src/session/SessionProvider.test.tsx` |
| logout, exact Owner cache cleanup, failed cleanup and safe re-auth | integration/component | `src/session/SessionProvider.test.tsx` |
| public/authenticated navigation shell and protected-tree removal | integration/component | `src/session/SessionProvider.test.tsx`, `src/tests/root-layout.test.tsx` |
| black-box launch without a session | Maestro smoke | `.maestro/foundation-public-launch.yaml` |

GET retry and mutation behavior must be tested when the owning feature/API adapter introduces retry policy. The foundation currently has no automatic retry and therefore cannot duplicate a mutation.

## Maestro execution

Prerequisites:

1. A signed `test` artifact produced from the exact source commit by the T014 workflow.
2. A clean supported simulator/emulator with Maestro installed.
3. The artifact installed with application ID `ru.vethelp.owner.test`.

Run:

```bash
maestro test apps/owner-app/.maestro/foundation-public-launch.yaml
```

The current black-box smoke deliberately covers the real no-session boundary. Valid/invalid/expired stored-session injection is not exposed through a production UI or debug backdoor; those paths remain covered through the real SecureStore adapter and SessionProvider integration tests until an approved test-artifact mechanism exists.

## MVP device matrix

| Platform | Near-minimum | Current | Required evidence |
| --- | --- | --- | --- |
| iOS | iOS 16.4 simulator/device | current supported iOS simulator/device | OS/device, artifact build ID, git SHA, Maestro result |
| Android | API 29 emulator/device | current supported Android emulator/device | API/device, artifact build ID, git SHA, Maestro result |

At least one near-minimum and one current configuration per platform are required before T015 Done. Record failures as blocking defects linked to SCRUM-639/S06; do not classify backend race or idempotency correctness from mobile UI evidence.

## Evidence status

- Unit/component/integration foundation: locally reproducible and included in Owner App CI.
- Maestro flow: source-controlled and syntax-bounded, but not claimed executed.
- Device matrix: specified, not executed.
- Blocking external input: signed T014 test artifacts plus simulator/device capacity.

# Wave 2 Owner App Web Target Closure

> Architecture correction (2026-08-26): the separate Next.js Owner Web target described by earlier evidence in this file is `SUPERSEDED_BY_PRODUCT_ARCHITECTURE_DECISION`. Canonical production ownership is `apps/owner-app` React Native/Expo for iOS, Android and Web. `apps/owner-web` was removed after its Origin/Host, safe projection, polling and client-IP security concepts were migrated. Historical results below remain implementation history, not the target architecture.

## Architecture-correction closure update — 2026-08-27

The historical audit below is retained as requested, but it no longer describes
the active implementation. `apps/owner-app` is now the sole Owner application
and uses React Native + Expo for iOS, Android and Expo Web. There is no second
production Owner application and no Web-specific Booking state machine.

Expo Web uses the shared screens, domain state and Backend clients with only
platform session/transport adapters. Its same-origin API route has an exact
method/path allowlist and carries the opaque Owner credential only in a
`__Host-` HttpOnly/Secure/SameSite=Lax cookie. Mutations validate exact Origin
and actual Host. The bridge strips bearer credentials from browser-visible
responses and storage, rejects redirects/oversize/non-JSON responses, clears
session transport on authority loss and HMAC-signs the EAS Hosting client-IP
assertion. Backend validates that assertion with a bounded timestamp and falls
back only to the normalized direct socket peer.

Final machine evidence passes: production Expo server export; Owner typecheck,
lint and `30 suites / 191 tests`; bridge `4/4`; Backend client-IP `9/9` and
build; real Chromium→Expo bridge→Backend→PostgreSQL→Clinic confirm/reject and
expiry-worker E2E `1/1`; authoritative pending/terminal readback, refresh,
dynamic deep link and session-loss purge; five responsive viewports without
horizontal overflow; and axe serious/critical zero. The source/V50/browser/
viewport-bound package is `docs/testing/evidence/wave2-owner-expo-web/` and is
labelled `OWNER_EXPO_WEB_RUNTIME`.

iOS and Android Expo bundles and clean prebuild pass. Android full
`assembleDebug` passes (`458` tasks). iOS project discovery passes, but a native
binary build is unavailable because React Native 0.86 requires Xcode `>=16.1`
while this host has Xcode `15.2`; that additional signed/native-build class is
not claimed. The screenshot package has machine V50 visual PASS, without
claiming human Product/UX acceptance.

The requested iOS validation scope is satisfied by shared static tests, an iOS
production Expo/Hermes bundle and clean iOS prebuild. A signed archive or native
binary was neither requested nor simulated; this host's Xcode 15.2 cannot perform
that additional check because React Native 0.86 requires Xcode 16.1 or newer.
Independent machine inspection of the bound screenshots records V50 visual PASS;
it is not represented as human Product/UX acceptance.

### Exit-criteria reconciliation

| # | Requirement | Result | Evidence |
| --- | --- | --- | --- |
| 1–3 | one canonical iOS/Android/Web Owner app; Web build; no second app | PASS | `apps/owner-app`, production server export, `apps/owner-web` absent |
| 4–5 | secure browser credential and canonical auth | PASS | HttpOnly bridge tests `4/4`; real OTP/session E2E |
| 6–7 | shared journey code; no Web Booking state machine | PASS | shared screen/client imports; transport/session `.web.ts` adapters only |
| 8 | QR/deep-link Web route | PASS | Expo Router dynamic booking route, authenticated direct-load/refresh E2E and unauthenticated protected-route guard |
| 9–13 | submit/pending, authoritative deadline, confirm/reject/expire | PASS | real PILOT_V1 E2E `1/1`; PostgreSQL/Clinic actions/expiry worker |
| 14–15 | trusted client IP and session-loss purge | PASS | Backend `9/9`, bridge `4/4`, browser cookie-loss E2E |
| 16–18 | responsive, accessibility and V50 review | PASS | five viewports, overflow zero, axe serious/critical zero, bound machine visual review PASS |
| 19–21 | iOS, Android and Wave 1 regressions | PASS | iOS bundle/prebuild; Android bundle/prebuild/`assembleDebug`; shared Booking/session matrix `8 suites / 72 tests`, route matrix `3/3`, and full Owner `30 suites / 191 tests` |
| 22–24 | master docs, no migration, clean diff | PASS | named master documents corrected; `MIGRATION_CHANGED=NO`; `git diff --check=PASS` |

Final verdict: `WAVE2_ARCHITECTURE_CORRECTION_COMPLETE`. The machine closure
does not claim physical-device, signed-build, UAT, deployment or human Product
acceptance. `BOOKING_CORE_SEMANTICS_CHANGED=NO`, `MIGRATION_CHANGED=NO`. Wave 3
was not started.

## Baseline

Audit baseline: branch `agent/v51-stage-01-architecture`, commit
`e9b7b2fb8a9208fb76e0ba2003246a741f3a1c8b`. The worktree contains unrelated
Wave 1/V50 work which was preserved. This document covers only `apps/owner-web`,
the bounded Owner OTP client-IP delta, and Wave 2 visual tooling/evidence.

## Application architecture and routes

Owner Web is a dedicated Next.js/React application, not React Native Web or
Flutter Web. Browser calls terminate at a same-origin allowlisted BFF. The BFF
uses the existing Backend opaque Owner session and canonical Booking Core.

| Web route | Backend operation | Auth | Contract |
| --- | --- | --- | --- |
| `POST /api/auth/otp/request` | `POST /v1/auth/otp/request` | public | OTP request |
| `POST /api/auth/otp/resend` | `POST /v1/auth/otp/resend` | challenge cookie | OTP resend |
| `POST /api/auth/otp/verify` | `POST /v1/auth/otp/verify` | challenge cookie | session establishment |
| `GET /api/auth/session` | `GET /v1/auth/session` | Owner session | bootstrap |
| `POST /api/auth/logout` | `POST /v1/auth/logout` | Owner session | revoke and local clear |
| `GET /api/owner/pets` | `GET /v1/owner/pets` | Owner session | owned pets |
| `GET /api/owner/clinics` | `GET /v1/owner/clinic-catalog` | Owner session | catalog |
| `GET /api/owner/availability` | canonical catalog availability read | Owner session | availability |
| `POST /api/owner/booking-holds` | `POST /v1/booking-holds` | Owner session | canonical create |
| `GET /api/owner/booking-holds/:id` | `GET /v1/booking-holds/:id` | Owner session | authoritative status |

Redundant Owner session/logout, catalog, booking-create and booking-status BFF
aliases were removed. `UNJUSTIFIED_DUPLICATE_BFF_ROUTES=0` for the audited map.

## Security and session architecture

The opaque credential is stored only in an HttpOnly, Secure-in-production,
SameSite=Lax, Path=/ `__Host-` cookie and is not written to browser storage or
URLs. Backend session validation remains authoritative. Production mutations
require configured canonical `OWNER_WEB_ORIGIN`, matching Origin and Host, and
reject inconsistent forwarded Host. Logout clears local credential transport
even when Backend revoke outcome is ambiguous.

OTP uses the existing Backend request/resend/verify lifecycle. Backend rate-limit
identity now uses the normalized direct TCP peer only; forwarded headers and
Express proxy-derived `request.ip` are ignored. This is intentionally not a
multi-hop proxy model. The 12-case focused matrix covers IPv4, IPv6,
IPv4-mapped IPv6, private peer, spoofed/duplicated/malformed/empty forwarding
headers, untrusted real-IP and missing/malformed socket peer.

`returnTo` is allowlisted to internal Owner paths and rejects external,
protocol-relative, script, encoded and traversal forms. IDs remain hints and the
Backend revalidates Owner, pet, clinic, service, slot and version authority.

## Pets, discovery, availability and booking

Pets, catalog and availability are Backend reads; the BFF has no generic proxy.
Booking create uses canonical `POST /v1/booking-holds`, requires an
Idempotency-Key, and only accepts `PENDING_CONFIRMATION`, `MANUAL` and
authoritative deadline/server time. Status uses canonical authoritative
readback for `PENDING_CONFIRMATION`, `CONFIRMED`, `REJECTED`, `EXPIRED` and safe
`CANCELLED`. Countdown zero triggers readback and never assigns `EXPIRED`
locally.

`BOOKING_CORE_SEMANTICS_CHANGED=NO` and
`BOOKING_CONFIRMATION_DEADLINE_CHANGED=NO`. No migration, payment, MIS,
telemedicine, insurance or emergency feature was added.

## Runtime, responsive and accessibility evidence

Owner Web unit assertions pass 31/31. Production build, TypeScript and lint pass.
The mock-Backend Playwright run recorded 28/30 before route consolidation repair;
the two affected clinic tests then passed 2/2 against a fresh production build.
The suite covers 390/768/1440, 200% text, reduced motion and axe serious/critical
zero in its mock harness.

This is not the mandatory real cross-application gate. No current test proves
Owner Web → BFF → Backend → PostgreSQL → Clinic Queue → confirm/reject/expiry →
Owner Web readback for all three paths. Therefore Owner Mobile and Clinic Queue
regression closure is not freshly established by this Wave 2 audit.

## V50 mapping and visual evidence

The existing package contains 15 runtime PNGs and one current V50 reference.
After the source repair, integrity verification correctly fails with
`SOURCE_HASH_MISMATCH:apps/owner-web/components/Journey.tsx`. More importantly,
the verifier checks hashes and dimensions only; its visual verdicts are authored
by the capture script, and several claimed states are not distinct runtime
states. It cannot establish independent V50 visual certification.

## Rollback and residual gaps

Rollback is Owner Web traffic/application rollback; no database rollback is
required. Remaining closure blockers are:

- strict projected DTOs for catalog/availability/booking instead of partially
  validated raw objects;
- global protected-state purge on post-bootstrap 401/session switch;
- stable idempotency key across ambiguous retries and abortable status reads;
- real-stack confirm, reject and expiry E2E plus focused Wave 1 regression;
- behavior-based security tests replacing assertion-only placeholders;
- fresh, independently evaluated V50 visual evidence with genuine distinct
  urgent, technical and clinic-detail states;
- fresh Security, Architecture, Product/UX and Booking Regression reviews after
  those repairs, all without veto.

## Exit verdict

`WAVE2_COMPLETE=NO`. `OWNER_WEB_IMPLEMENTED=NO` for the requested closure
meaning: a real application exists and builds, but mandatory closure evidence is
absent and independent Security/Architecture reviews vetoed the audited state.

Status: `WAVE2_INCOMPLETE`. Do not start Wave 3.

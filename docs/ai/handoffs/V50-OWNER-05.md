# V50-OWNER-05 handoff

## Result

COMPLETE / READY_FOR_INTEGRATION. Runtime `cc6ba06`; backend authority repairs
`0c7c75d` and `9bb4d2c`. No validator veto remains.

## V50 IDs and user-visible outcome

- `OWN-006`, `#booking-review`: Create Hold submitting/retry/conflict states.
- Bounded `OWN-008`, `#appointment-detail`: server-authoritative pending,
  confirmed, failed, expired, released and stale/offline booking status.
- Owner sees success or expiry only after authoritative backend readback.

## Create Hold contract and transaction

- Canonical `POST /v1/booking-holds`; JWT `sub` is the only owner authority.
- V50 sends pet, slot, expected slot version, service and nullable doctor with
  UUID idempotency/correlation headers. Legacy omission is accepted only for
  default-off rollback compatibility.
- One PostgreSQL transaction/client sets 50 ms lock and 250 ms statement
  limits, binds a payload fingerprint, validates pet and locked slot version,
  service, doctor, freshness, capacity and mode, then writes hold/count/audit,
  versioned outbox and idempotency result before commit.
- No external HTTP occurs while locked. Contention/pool pressure is normalized
  to controlled retry semantics.

## Authority, TTL, outbox and expiration

- Foreign/unknown/archived pets converge safely. Optional service species
  policy and active/public/location-bound doctor authority are enforced.
- PostgreSQL authors `expiresAt`/`serverNow`; countdown is display only.
- Foreign/unknown owner hold reads normalize to 404. DTO excludes counters,
  other owners, MIS/provider IDs, notes, retries, outbox and payment internals.
- Expiration covers active holding states with DB clock and worker-only
  `SKIP LOCKED`; count drift rolls back. Repeat is no-op; confirmed is untouched.

## Flutter states and flags

- Default-off `OWNER_V50_CREATE_HOLD` depends on shell/catalog/review;
  `OWNER_V50_BOOKING_STATUS` additionally depends on Create Hold.
- One operation/correlation key survives double tap, soft retry and ambiguous
  network result. Offline mutation is blocked and Review context is retained.
- POST is followed by GET. Polling is foreground/online/nonterminal only.
- Manual/MIS pending, confirmed, failed, expired, released and stale/offline
  snapshots use server-owned wording and accessible live announcements.

## Changed areas

- Focused Booking Core create/read/expiry DTOs, migration metadata and tests.
- Owner marketplace Review/status/repository/flags, shared route wiring and tests.
- OWNER-05 contract, gap matrix, program/current-state/parity/evidence docs.
- Evidence capture/verifier with deterministic raw-pixel BMP output.

## Tests and concurrency verdict

- Backend build PASS.
- Real PostgreSQL 16 focused suite PASS 4/4, including payload replay/conflict,
  safe read, 100-way concurrency, expiry/idempotence, negative authority and
  count-drift rollback.
- Concurrency: 1 logical success, 99 controlled errors, active hold 1,
  `held_count=1`, one create outbox, one audit, pool waiting baseline/in-use 0.
- Flutter analyze PASS; marketplace PASS 14/14; full Flutter PASS; flagged
  Owner web build PASS.
- Full backend: ABSTAIN before execution because the pre-existing
  `platform-smoke.e2e-spec.ts` uses `Role` as a type and fails ts-jest compile.

## Evidence and parity

- Durable package: `/Users/evrusetskiy/docs/ai/evidence/v50-owner-05-cc6ba06-bmp`.
- 48/48 runtime 24-bit BMP pixel matrices + 8/8 prototype PNGs.
- Package checksum: `d7e36a6b7071b8e607b8beeabd6941ec9185128e50911b80c10c5cef9300339a`.
- Hash/path/state/viewport/package and raw-pixel black-rectangle gates PASS.
- Representative 8/8 and full visual PASS. Transaction/security,
  product/visual and final integration validators PASS with zero vetoes.
- `OWN-006` remains VISUALLY_VERIFIED; bounded `OWN-008` status becomes
  TESTED / VISUALLY_VERIFIED. Counter: `10/30`; final certification PASS.

## Known differences, integration and next slice

- Null `supported_species` means unrestricted legacy compatibility; explicit
  lists enforce species. Freshness threshold is 15 minutes.
- Payment, cancellation, alternative slot, Portal UI and new MIS adapters are
  out of scope.
- Integrate the complete branch normally. Apply both additive migrations
  forward. Flag rollback never deletes existing holds or outbox rows.
- Next slice remains program-owned and is not selected here.

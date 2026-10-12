# W4B-03A-02 machine report

WAVE4B_03A_02_MACHINE_COMPLETE=YES
WAVE4B_03A_02_READY_FOR_PO_REVIEW=YES
HUMAN_ACCEPTANCE=NOT_RECORDED
OCR_SOURCE_BYTE_INTEGRITY=DEFERRED_BLOCKING_VALIDATED_IMPORT

Accepted base5d1b40582a8e5ee22e2dc087fed47a462fec984a. Isolated branch agent/v15-w4b-03a-02-execution-i61r043p. No commit, push, merge or deployment. Original674 dirty entries remain byte-for-byte unchanged (original-preservation.json); task index empty and HEAD remains accepted base.

## Executed gates

| Gate | Actual result | Evidence |
| --- | --- | --- |
| Byte execution/authority/configuration |42 unique PASS /0 unresolvedFAIL |execution-results.json, additional-results.json, upgrade-config-results.json, guard-results.json |
| Populated72→73 upgrades |2PASS |focused-results.json initial upgrade; upgrade-config-results.json stronger source-populated upgrade |
| Existing OCR foundation |25PASS |foundation-results.json |
| Existing Owner review |45PASS |review-results.json |
| Affected storage |27PASS |storage-results.json |
| Fresh migrations/checksums |73/73PASS |fresh-migrations.log, fresh-checksums.log, catalog-verdict.json |
| Backend build |PASS |backend-build-final-pass.log |
| OpenAPI |7assertionsPASS |openapi-assertions.json |
| DB / Security / Architecture |NO VETO / NO VETO / NO VETO |three fresh review documents |
| Original dirty preservation |674 unchanged |original-preservation.json |

Total141 unique executed assertions PASS. Initial TypeScript compilation errors are preserved and superseded; no unresolved test failure. See gate-ledger.json for assertion-level deduplication and dependency/sticky status. Unrelated accepted Wave1–4A/T044 gates reused, not rerun.

## Implemented scope and verdict

Nine implementation/test files: additive171977; byte adapter; byte executor; Owner job integration; provider/worker/module integration; execution and migration tests. Contract20 and current-state document the implementation candidate. Public API/route surface unchanged, no new dependency. All72 historical migrations, accepted Owner review, canonical storage and sharing-production files remain unchanged; hashes in contract-preservation.json.

A newly created queued job may bind an eligible original version in its creation transaction. Byte reads/rehash and adapter invocation run after claim COMMIT outside PG transactions. An opaque trusted receipt binds execution/attempt to expected and consumed digest/count and immutable extraction identity. ACTUAL test consumption gets result binding; production simulation receives metadata-only receipt and no actual binding. Final context/fencing/source locks plus deferred checks enforce atomic result/candidate/receipt/binding/audit/job success. Raw provider JSON cannot mint evidence.

Both PostgreSQL lock-race orders pass without deadlock: negative-first denies publication; finish-first commits immutable proof and later negative event denies future eligibility. Missing receipt/binding, binding insertion and deferred audit COMMIT failures leave no partial results or success audit. Stale worker cannot publish after reclaim. Ordinary old login/GUC cannot claim bound job or assume writer role. Rollback must stop all claimers and retain provenance; destructive DOWN refuses.

Internal resolver requires exact current Owner/Pet/Document/result/candidate and terminal CONFIRM revision/textVersion/text digest, with source bytes and negative events rechecked. Original extraction, decisions and legacy LEGACY_UNVERIFIED/OBSERVED_SEQUENCE_ONLY data remain unchanged. Owner confirmation creates no medical truth, Pet write, validated import or Wave4A sharing eligibility.

## Limits and next prerequisites

Actual consumption is proven only for a gated test consumer. No real OCR extraction/accuracy, production storage isolation, restore/retention, production writer provisioning or rollout is accepted. The dedicated writer is trusted; DB authorization is not cryptographic attestation. Enablement defaults off. No public proof endpoint or Owner UI.

Before a subsequent implementation goal: separately verify production private storage and durability/restore/retention; provision/restrict a distinct writer identity and compatible workers; approve a real adapter consumption boundary and identity/version policy. Before03B validated import, require fresh verified source/execution provenance, separate clinical-validation authority and separate sharing eligibility. No historical OCR retroproof. Validated import remains blocked.

Source/evidence hashes and exact scope: MANIFEST.json and SHA256SUMS. Human acceptance requires a separate Product Owner decision. STOP after this candidate; no commit/push authorized.

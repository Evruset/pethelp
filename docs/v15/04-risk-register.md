# PetHelp v1.5 transition risk register

| Risk | Impact | Control / evidence required | Owner/gate |
|---|---|---|---|
| Wrong canonical baseline | Lost or duplicated work | Base pinned to `main@ba85f22`; draft integration tracked separately | Wave 0 |
| Existing dirty work overwritten | Data loss | Separate clean worktree; no reset/clean | Continuous |
| Runtime scope still selects business semantics | Cross-clinic behavior cannot coexist | Clinic policy resolver; tests with both profiles in one runtime | Wave 1 |
| Missing/unknown profile enables auto-confirm | Unauthorized semantic change | Manual migration default and fail-closed resolver | Wave 1 |
| Duplicate booking under race | Capacity and trust failure | PostgreSQL row lock; capacity=1 concurrent acceptance | Wave 1 veto |
| Idempotency result not payload-bound | Cross-request replay corruption | Existing request fingerprint; same/different-payload tests | Wave 1 veto |
| Partial transaction succeeds | Orphan hold, appointment or outbox | Injected failure and post-rollback DB assertions | Wave 1 veto |
| Clinic policy spoofed by client | Authorization/business-policy bypass | Resolve clinic from authoritative slot relation | Security veto |
| Automatic path skips manual-path validation | Invalid clinic/service/doctor/pet booking | Shared validation and negative matrix | Wave 1 veto |
| Suspended/terminated clinic can still auto-confirm | Booking violates BP-06 safety precondition | Prove existing authoritative active-clinic guard for represented states or block Wave 1; full BP-20/BP-21 lifecycle remains deferred | Wave 1 veto |
| OpenAPI differs from runtime | Client breakage | Generate/assert schema against live behavior | Wave 1 |
| SRS and approved PILOT create contracts conflict | Client breakage or silent governance override | Preserve `/v1/booking-holds` and `BOOKING_STATE_CONFLICT`; require Product/SA-approved route/error compatibility mapping | Human decision before public API change |
| Policy rollback mutates existing appointments | Historical corruption | Apply policy only to new attempts | Wave 1 |
| Draft Clinical Result work duplicated | Merge conflict and split authority | Treat PR #73/#78 lineage as reuse source; defer to Wave 3 | Wave 3 |
| Legacy payments/MIS/telemed/insurance become active | Scope and regulatory expansion | Keep runtime capability gates independent of v1.5 booking policy | Wave 1 veto |
| Unapproved CFG values enter code | Product/financial/legal error | Keep values unset; human decision gate | All waves |
| Confluence/Jira baseline unavailable | Governance mismatch | Mark `NOT_VERIFIED`; reconcile before external workflow mutation | Human gate |

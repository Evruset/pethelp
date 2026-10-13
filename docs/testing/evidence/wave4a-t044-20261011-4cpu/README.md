# Wave4A T044 — evidence and recommendation

Decision: **RECOMMENDED_FOR_HUMAN_APPROVAL**.
Human resource-profile approval: **PENDING explicit owner sign-off**.
Machine result: RESOURCE_PROFILE_PASS_PENDING_HUMAN_APPROVAL. Wave4A PARTIAL.

|Run|PASS/FAIL/skipped|B p95 ms <=2000|D initial successes|
|---|---|---:|---:|
|1|9/0/0|600.59|100/100|
|2|9/0/0|666.48|100/100|
|3|9/0/0|753.18|100/100|

Actual4CPUs,cpuset0-3,8221097984-byte allocation,Node22.23.1,PostgreSQL16.14.
Pool20/connection700ms/lock50ms/statement250ms,B30 contenders/capacity5,D100
unchanged. Diagnostic module/directory unset. All capacity,idempotency,audit,
outbox,deadlock,pool,stuck-transaction/unexpected-error/consistency assertions PASS.
All three raw full Jest logs and machine results are included without edits;
psql outputs are lossless UTF8 JSON wrappers with original byte checksums to
preserve their trailing spaces while satisfying Git whitespace checks.
SHA256SUMS binds them and manifest.json. No new suites run in this reconciliation.
Manifest binds exact base,dirty-source hash and measured source-file hashes.
Raw legacy interpretation says one CPU: structured actual environment fields
and before/after snapshots are authoritative. No raw evidence rewritten.

Historical2026-08-13 B1064.81ms,D100/100; latest current-source1CPU full
B2049.60ms,D65/100,7/2/0. Hash-matched old-source own-schema controls also
fail on1CPU. Four-CPU PASS does not restore original1CPU requirement or
prove environmental-only cause. Separate old diagnosis and PostgreSQL/resource
traces remain local at .artifacts/wave4a-t044-diagnostics/ and
.artifacts/wave4a-t044-resource-control/20261011-4cpu-01/; not accepted functionality.

See commit-plan.md for exact34-file candidate list,optional hook exclusions,
scoped review,commands and final selected-source validation requirement.
Nothing staged/committed/pushed. Source snapshot identifier:
`889379032d8f2cd1b36bb2f3bdaa16f5771c1ce7b1b3bb6f90f586a7f21fff2f`.
Acceptance verification PASS is not owner approval or final Wave4A acceptance.

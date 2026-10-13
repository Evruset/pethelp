# V15-W4B-01 Goal Capsule / Task Brief

Base: 16888e1a191bf410a6aeb8f611f5ce4af98282df (fresh origin verified). Wave4A technically/human accepted; real-device/UAT/Go-Live excluded.

Scope: OCR worker/service/provider/controller, additive migration171974, focused real PostgreSQL tests and backend contract assertions/evidence/current-state. No client, sharing implementation, dependencies, historical migration edit, commit/push or automatic confirmation.

C3/R3; complex context budget. Root HIGH for source/authority/lease architecture, bounded implementation and focused execution; root only writer. Later independent read-only DB and Security reviews cover distinct veto domains. No discovery agent or broad rediscovery.

AC: no direct Pet/legacy OCR writes; old JSON unchanged and explicitly LEGACY_UNVERIFIED; per-document durable queued job, fenced lease/three-attempt recovery/retry; provider outside transactions; atomic raw+candidate+success; exact current Owner/Pet/Document authority; immutable source/results; bounded text-only v1 candidate PENDING_OWNER_REVIEW; no sharing exposure; fresh+legacy migration/checksums, authority/concurrency/failure/provenance/build/affected contract checks PASS, reviews NO VETO.

Decision: explicit Owner enqueue route rather than automatically changing upload semantics. Source identity hashes persisted original document metadata (including storage key) without exposing it; provider receives only document id/type as the existing simulation requires. Results retain available provider identity/version only; no fabricated provenance. Historical data is a labelled view (no copy/backfill or row rewrite). Three attempts is a lifetime job budget, not reset by Owner retry. At-least-once provider execution after crashed leases, exactly-once accepted persisted result via fencing/unique keys. Rollback disables worker and retains schema/provenance; destructive DOWN refused.

Gates: isolated DB migrations/checksums/populated upgrade; real service/Nest HTTP authority and job tests; unchanged sharing source plus affected HTTP contract subset; build/OpenAPI assertions; fresh DB/Security review; original674snapshot preservation. Accepted unrelated Wave1–4A gates sticky.

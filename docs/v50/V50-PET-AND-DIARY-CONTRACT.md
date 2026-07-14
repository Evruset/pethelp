# V50 Pet Profile and Diary contract

Status: `IMPLEMENTING`

Scope: `OWN-009` (`#pets`), `OWN-010` (`#pet-profile`), `OWN-011` (`#diary`).

Decision date: 2026-07-14. Classification: `C3 / R3` because the slice adds durable archive state and sensitive owner-document read projections.

## Decision

Use the existing owner-pet aggregate and owner JWT authority. Add one nullable `pet_schema.pets.archived_at` field as durable archive state, optimistic-concurrency archive/restore commands, a unified owner-scoped Diary read model and allowlisted document metadata. Keep the existing authenticated streaming download endpoint; the current local private storage does not provide an independent signed-URL authority.

The migration is additive and forward-only. Rollback disables default-off UI flags and leaves the nullable column/data intact. A down operation must not drop the column or erase archive decisions.

## Authority and no-leak invariants

- `JwtPayload.sub` is the sole owner authority. Client owner IDs, clinic/location claims and selected-pet preferences never grant access.
- Missing and foreign pets use the same normalized `OWNER_PET_NOT_FOUND` response. Missing, foreign, soft-deleted or mismatched documents use the same `OWNER_PET_DOCUMENT_NOT_FOUND` response.
- A version error is returned only after ownership is established; a foreign identifier never becomes a version oracle.
- Default list/Home selection includes only active pets. Explicit owned archived profile/Diary reads may remain available as read-only history so the owner can restore the pet.
- Profile, photo and document mutations reject an archived pet; restore is the only allowed state-changing pet command while archived.
- Archive never cancels or changes bookings, telemedicine sessions, insurance, documents or clinical history.

## Versioned archive/restore

Archive and restore require the existing `If-Match: "<profileVersion>"` convention. The backend applies owner ID, pet ID, expected version and state transition in one atomic update, increments `profile_version` exactly once and advances `updated_at`.

On conflict, Flutter shows current authoritative data and preserves a safe local draft where applicable. It never automatically resubmits allergies, chronic conditions or medical-warning changes.

When the selected pet is archived, authoritative active-pet readback chooses the next deterministic active pet or no-pet state. The owner-keyed local preference is rewritten or cleared only from that readback.

## Diary read model

`GET /v1/owner/pets/:petId/diary` returns allowlisted events already ordered by the backend. Ordering is `occurredAt DESC`, then a documented stable event-type rank, then stable source ID. Pagination/cursor logic is applied after the unified chronology is formed; Flutter filters the returned order without re-sorting it.

Allowed event families are derived from existing owned data only: visit/clinical summary, telemedicine care, and pet document. The DTO excludes provider payloads, private clinic notes, payment/MIS data and another owner identity.

## Documents and OCR

Diary first returns metadata, never binary content. Explicit open uses the authenticated owner-scoped stream route. DTOs exclude `storage_key`, raw bucket/file paths, raw `file_url`, raw OCR payload, processing error internals and permanent object URLs.

Persisted runtime states map honestly:

- `PROCESSING` → `PROCESSING`;
- `PROCESSED` → `READY`;
- `FAILED` → `FAILED`.

`REVIEW_REQUIRED` remains a reserved presentation state and is never inferred from OCR confidence or content. It may be emitted only after a future explicit persisted review disposition exists. OCR text does not create allergies, diagnoses, warning severity or clinical verification.

Unknown document types remain metadata-only with a safe unavailable/download fallback. Supported images/PDFs are never treated as executable HTML or script.

Explicit PDF open first retrieves bytes from the authenticated owner-scoped stream using the exact expected internal download path. Flutter then opens an `application/pdf` data payload in an external application. It never launches a backend-provided arbitrary URL, HTML/script MIME, storage key or permanent object URL. A rejected/expired stream remains a controlled session/document error and a later explicit open performs a fresh metadata/stream request.

## Medical warnings

The V50 profile may present only explicit existing fields: allergies, chronic conditions and vaccination notes. Each presentation identifies its source as profile data and uses semantic icon/text in addition to color. The client does not infer warnings from raw OCR or promote severity.

## Feature flags and rollback

- `OWNER_V50_PETS` requires the canonical V50 owner shell.
- `OWNER_V50_PET_PROFILE` requires the shell and V50 pets route.
- `OWNER_V50_PET_DIARY` requires the shell, V50 pets/profile journey and an authoritative selected pet.

All are exact-true and default off. An invalid combination renders the complete legacy destination and emits at most one non-PII diagnostic. Disabling flags does not downgrade schema, delete data or change owner authorization.

## Rejected alternatives

- Hard delete/cascade or destructive migration rollback.
- Client-only archive/filter state.
- Client merge/sort of independently limited care arrays.
- Returning internal storage identifiers, raw OCR or permanent URLs.
- Fabricating `REVIEW_REQUIRED` from `PROCESSED`, `FAILED` or confidence values.
- Archive side effects on unrelated booking/telemedicine workflows.

## Validation gates

- Migration on populated schema, repeatability and non-destructive rollback.
- Owned/foreign/missing normalized access matrix and DTO leak assertions.
- Current/stale `If-Match`, concurrent archive/update, exactly-one version increment and selected-archived fallback.
- Stable mixed-source Diary order, tie breaking, pagination, soft-delete exclusion and lifecycle mapping.
- Authenticated stream success and foreign/deleted/missing-file failure without path leakage.
- Feature-flag dependency/rollback tests; focused/full Flutter, web build, required backend focused checks and independent validator.

## Residual product boundary

The prototype contains health-dynamics charts and insurance/reminder concepts for which no authoritative bounded read contract exists. This slice must not fabricate them. Their omission remains a parity gap rather than a client-side estimate.

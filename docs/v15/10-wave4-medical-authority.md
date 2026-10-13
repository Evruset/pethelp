# Wave 4 medical authority reconciliation

Status: `IMPLEMENTATION_IN_PROGRESS`

Base: `3165bed36911f35431b748db9a1e5c8e118cdbde`; Wave 3 human gate approved by Product.

## Task brief

Implement BP-11 operational appointment context, BP-12 explicit appointment/resource sharing, and BP-15 Owner-confirmed OCR. Preserve accepted Waves 1–3. Only ordinary commits/pushes to `agent/v15-transition-wave-01` are authorized; verify local/remote SHA after each accepted checkpoint. Jira/Confluence and Wave 5 remain outside scope.

## Product/SA decisions

- `medical.shared-data.read` is assigned only to `CLINIC_VETERINARIAN` through the capability model. Active exact clinic/location/membership authority and an active resource grant are both required.
- New grants require Appointment `CONFIRMED` with lifecycle `CONFIRMED` or `RESCHEDULE_PROPOSED`, or `COMPLETED`. Cancellation/no-show forbids a new grant. Existing grants are not implicitly revoked by Appointment lifecycle changes.
- `ACTIVE → REVOKED` is Owner-controlled; no invented expiration.
- Owner name has no authoritative schema source and is nullable. Phone comes from `identity_schema.owner_identities.phone_e164`; pet breed from `pet_schema.pets.breed`.
- `PATIENT_ADMIN_REGISTRY` never authorizes medical access or OCR validation.

## References and snapshots

`medical_schema.appointment_data_shares` derives owner/pet/clinic/location from Appointment and its location. Immutable resource rows reference published Result, individual Amendment, or original PASSPORT/HISTORY Document. Validated imports will be added only after the OCR authority foundation. Selecting full current history resolves a finite resource list at creation; future Results, Amendments, Documents and validated imports require a later explicit grant. References retain canonical medical truth in its existing domain.

## Locks and no-leak

Grant creation locks hold then Appointment, matching accepted lifecycle order, and serializes Owner idempotency before insertion. Eligible resources are resolved as a bounded snapshot. Clinic read locks active membership/location/clinic via the Wave 3 authority gate, then the grant `FOR SHARE`, then its exact selected reference. Revoke locks the grant `FOR UPDATE`. A read authorized first may finish; after revoke commits new reads fail. Missing, foreign, unshared and revoked resources return one bounded medical-not-found response. Administrative access never substitutes for clinical capability.

## OCR reconciliation

Legacy `OcrDocumentWorker` writes provider JSON to both `pet_documents.ocr_result` and `pets.medical_history_ocr`; it simulates extraction inside a database transaction. Wave 4B removes direct Pet writes, separates execution/raw/candidates/Owner decisions/validated data, and moves provider execution outside DB transactions. Uploads currently use document `PROCESSED` even without OCR, so OCR gets its own job lifecycle. Legacy JSON is preserved as `LEGACY_UNVERIFIED`; it must not become Owner-confirmed data. The current simulated provider yields bounded text, not a clinical ontology; candidate schema v1 will represent extracted text with explicit provenance and review state.

## Verification and recovery

Each capability checkpoint carries focused real PostgreSQL/runtime tests and a diff review. Final gates include fresh, Wave 3 and populated legacy upgrade; sharing/revocation/tenant races; OCR decisions/retry/provenance; clients/OpenAPI; one consolidated Waves 1–4 regression; fresh DB/Data Authority, Security/Privacy and Independent Reviews.

Migrations start after `171972`. Populated grants/provenance refuse destructive DOWN. Operational rollback retains schema/history and keeps any legacy direct-write OCR worker disabled. Revocation governs future PetHelp reads, not copies already lawfully viewed outside PetHelp.

# V50 Doctor Public Profile Consent Debt

Status: `OPEN / PRODUCTION_ROLLOUT_BLOCKED`

Blocker: `PUBLIC_DOCTOR_PROFILE_CONSENT_CONTRACT_MISSING`

## Current mitigation

- The public projection uses a strict allowlist: doctor ID, display name, normalized public title, clinic and location identity, public availability summary, and source-supported verification wording.
- Publishability requires an active clinic, active public location, active staff record, and an active `VETERINARIAN` assignment.
- The Doctor Discovery feature flag is exact-true, dependency-ordered, and default-off.
- Biography, specialty taxonomy, credentials, photo, languages, rating, reviews, private contacts, HR data, staff codes, provider identifiers, memberships, JWT subject, and internal version fields are forbidden.

This mitigation is sufficient for bounded integration testing while the feature remains default-off. It is not evidence of consent for production publication.

## Ownership and future source

- Data owner: Clinic/Veterinarian profile domain, with the clinic responsible for the public assignment and the veterinarian as the profile subject.
- Required future consent source: an explicit, auditable public-profile consent record tied to the veterinarian, publishing clinic/location, allowlisted field set, grant/revocation timestamps, and consent policy version.
- Legal/product approval owner: VetHelp Product and Legal/Privacy jointly; backend authorization review remains required for the resulting public predicate.

## Activation gate

Production rollout may be activated only after all of the following are approved and implemented in a separate R3 slice:

1. A public-consent contract and authoritative storage model exist.
2. The active-public-veterinarian predicate requires valid, non-revoked consent in addition to the current active clinic/location/staff/role checks.
3. Grant, revocation, audit, owner correction, and rollback behavior are tested.
4. Product and Legal/Privacy approve the published allowlist and consent language.
5. Default-off rollout evidence is replaced by an explicit production activation decision.

Until then:

- Integration readiness may be `PASS` after visual and functional certification.
- Production rollout remains `BLOCKED` with `PUBLIC_DOCTOR_PROFILE_CONSENT_CONTRACT_MISSING`.
- This debt must not be removed or marked closed by UI parity work.

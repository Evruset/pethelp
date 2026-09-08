# V50-CLINIC-04I — Administrative Reference Portal

## Scope

The existing administrative Patient Detail page now displays and edits the
exact-location `administrativeReference`. It remains separate from the official
pet name, clinic-local alias, visit identifiers, medical-record numbers and the
opaque patient UUID. Registry projection/search is unchanged.

## Runtime behavior

- `null` is shown as **Не задан**; read presentation does not depend on the
  mutation flag.
- Editing requires the existing flag, effective
  `patient.admin.local-profile.update`, exact scope, loaded Detail and no
  pending local-profile mutation.
- NFC, trim and repeated ASCII-space collapse happen before client validation.
  Allowed values are 1–40 Unicode code points using letters, decimal digits,
  ASCII space, `-`, `_`, `/` and `.`. The backend alone computes uniqueness.
- SET/replace/explicit CLEAR send strong `If-Match` and a scoped UUID
  idempotency key. Alias and reference share one pending lock and aggregate
  version; success is applied only after strict response parsing.
- Same normalized retry reuses its key. Changed payload, SET/CLEAR transition,
  scope change, success or stale refresh creates a new intent.
- Collision is a field error without patient disclosure. Stale conflict
  refreshes Detail without resubmission. 403 removes both write controls; 404
  clears the snapshot. Policy/network/5xx/malformed success preserve the last
  valid snapshot and safe retry.

## Accessibility and responsive behavior

The dialog has an accessible name, labelled input, described helper/error,
assertive field error, polite pending status, initial input focus, Escape close,
focus return, explicit clear name and keyboard-operable controls. Critical
states use text, not color alone. Focused checks cover 1440×900, 1024×768 and
390×844 without horizontal overflow.

## Coverage mapping

| Proofs | Focused scenario |
|---|---|
| I-01–I-05 | separate presentation, absent state, authority and flag |
| I-06–I-11, I-15–I-17, I-34 | set/replace/clear, scope, versions, UUID and normalization |
| I-12–I-14, I-28–I-30 | double submit, retry key, changed intent, technical/malformed snapshot |
| I-18–I-20 | client validation and Unicode code-point bound |
| I-21–I-22 | bounded collision without leakage |
| I-23–I-27 | stale refresh and authority/no-leak transitions |
| I-31–I-33 | shared pending lock, keyboard/focus, axe and responsive viewports |

## Explicit exclusions

No Registry column or search, comparison-key computation, backend endpoint,
migration, capability, flag, Owner Mobile, Queue, booking, clinical workflow,
bulk integration, QR/barcode, labels, notes, archive, merge or transfer was
added.

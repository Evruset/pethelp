# VetHelp V50 canonical reference

These exact packs are the permanent design, UX, and interaction reference for in-scope Owner and Clinic work.

## Authority order

1. **Current Pilot product contract** decides what features and scenarios are in scope.
2. **V50 reference pack** decides how in-scope Owner and Clinic experiences should look, compose information, and behave.
3. **Current production frontend** is the technical implementation baseline.

Canonical rule:

> V50 PACK = DESIGN / UX / INTERACTION AUTHORITY
> CURRENT PRODUCTION FRONTEND = IMPLEMENTATION BASELINE

Do not port prototype HTML, CSS, or JavaScript literally into production. Translate its visual hierarchy, shell and navigation, information order, density, typography, spacing, component composition, interaction and responsive behavior, and loading/empty/error states into the current production architecture.

## Owner authority

Canonical sources are [owner/index.html](owner/index.html), [owner/UX_UI_GUIDELINE.md](owner/UX_UI_GUIDELINE.md), and [owner/BEHAVIORAL_NOTES.md](owner/BEHAVIORAL_NOTES.md). The production target is `apps/owner-app` (React Native + Expo for iOS, Android, and Web).

Density model:

- Decision Compact: catalog, doctor/service decisions, availability/time, comparison, and booking review.
- Care Normal: Home, Appointments, and Pet.
- Content Relaxed: Pet Diary, documents, and profile.

The Owner experience is a fast decision/care interface, not a CRM or admin dashboard.

## Clinic authority

Canonical sources are [clinic/index.html](clinic/index.html), [clinic/UX_UI_GUIDELINE.md](clinic/UX_UI_GUIDELINE.md), and [clinic/BEHAVIORAL_NOTES.md](clinic/BEHAVIORAL_NOTES.md). The production target is `apps/clinic-portal` (Next.js + React).

The Clinic experience is a desktop-first, action-first operational workspace: dense but readable, using the full useful workspace width, compact rows, and contextual detail. Avoid landing-page composition, gratuitous cards, and giant empty whitespace.

## Prototype scope warning

Prototype presence does not activate product scope. Telemedicine, insurance, emergency, and other future or non-Pilot surfaces remain excluded whenever the current Pilot contract excludes them. Classify every parity target as `IN_CURRENT_PILOT`, `OUT_OF_CURRENT_PILOT`, or `REFERENCE_ONLY` before implementation.

## Required future UI workflow

1. Verify [MANIFEST.json](MANIFEST.json) and the source archive identity.
2. Open the canonical `index.html` in Chromium.
3. Navigate to the relevant prototype state or hash.
4. Read the corresponding UX/UI guideline and behavioral notes.
5. Inspect the production route and component.
6. Produce the mapping: `V50 state → production route → production component → parity gap → REUSE / MODIFY / REPLACE / MISSING`.
7. Implement through the current production architecture.
8. Compare V50 and production side by side at an equivalent viewport.

No future task may claim `V50_PARITY=PASS` without actually opening this canonical reference.

# Vetora: public homepage, iteration 02

Responsive, dependency-free HTML/CSS/JavaScript prototype. Open `Vetora_Prototype_Iteration_02.html` directly, or serve this directory with `npm run dev` and visit http://127.0.0.1:8192/.

The homepage follows the supplied target hierarchy while retaining the original Vetora artwork and controls. Public search, clinic/service/specialist selection, exact service handoff, favorites, region filters, browser history, source links, map, keyboard navigation and complete demonstration login/registration are implemented. Insurance in the reference is replaced by guest favorites to respect the MVP scope freeze.

This is a standalone interaction prototype. It does not connect to production authentication or create bookings. Guest booking opens the official clinic booking/profile page or clinic phone number, without requiring a Vetora login. It states that the selected service/doctor is not automatically transferred and that the provider must confirm availability and price. Login/registration use a clearly identified demo code `000000`; they send no SMS, create no account and persist no personal information. Favorites store only public clinic IDs in this browser.

Data dates, official links, preserved image mappings and the generated image prompt are in [SOURCES.md](SOURCES.md). There is no live scheduling, clinical record, payment, insurance, telemedicine, emergency routing, Push or SMS integration. The “pet card” quick action opens the login/demo explanation.

## Commands

Inspect `package.json`; it deliberately adds no dependencies or lockfile.

- `npm run check`: syntax checks.
- `npm run test:ui`: focused browser scenarios, using an existing Playwright installation resolvable by Node.
- For accessibility checks, set `VETORA_AXE_MODULE` to an existing `@axe-core/playwright` module path. The report explicitly records whether axe ran. Third-party iframe internals are excluded from the app accessibility assessment.
- `npm run export`: rebuild the standalone file with every image, CSS and application script embedded; only the external map/provider links need internet.
- `python3 export.py --output /absolute/path/Vetora_Prototype_Iteration_02.html`: export to a chosen location.

Browser verification defaults to http://127.0.0.1:8192/ and writes screenshots plus JSON evidence outside Git at `/tmp/vetora-iteration02-evidence`. Override `VETORA_BASE_URL` and `VETORA_EVIDENCE_DIR` as needed; a `file:///...html` URL supports the same checks.

See [UX-REVIEW.md](UX-REVIEW.md) for verification and integration limits.

# Vetora public homepage, iteration 02

## Reasoning

`medium`; C2/R1, standard context budget. Standalone prototype; no production contracts change.

## Goal

Recompose the public homepage from the user's `Главная без входа.png`, preserving the logo, dimensional icons, pet hero, clinic photographs and button language of `Vetora_Prototype_Iteration_01.html`.

## Allowed scope

- `prototype-vetora-home/`: accessible responsive standalone web prototype, inherited catalog/assets, official-source metadata, export and focused browser verification.
- This task note and an appended execution note in `docs/ai/current-state.md`.
- New self-contained iteration 02 export in Downloads; preserve iteration 01.

## Acceptance criteria

- Header navigation, city selection, public search, specialist/service/clinic discovery, map, directions and pharmacy links follow the reference hierarchy.
- Search and filters work without authentication, including empty/reset states; selection survives navigation and browser history.
- Clinic and doctor details link to official sources. Guest booking continues to the provider's actual booking page; never invent available slots or successful bookings.
- Login/registration have complete, explicitly identified prototype flows without claiming backend authentication or SMS delivery; never persist personal details or credentials.
- Preserve reusable original artwork. Generate only a missing generic supporting pet image; never generate fake clinic/doctor photographs.
- Keyboard focus, modal dismissal, labels, contrast, reduced motion and 360/390/768/1440 layouts pass focused browser checks.
- Exclude insurance, payments, telemedicine and other frozen MVP capabilities even where the visual reference contains them.

## Do not change

- Dirty Owner App files and existing current-state content; production backend, authentication, booking APIs, dependencies, migrations, Jira and Confluence.
- No commit, push, PR or deployment is authorized.

## Verification

- Node syntax checks; focused Playwright guest search/detail/provider handoff, favorites, auth prototype, history and responsive checks; axe accessibility using the existing local harness.
- `git diff --check`; document actual results and remaining integration boundary.

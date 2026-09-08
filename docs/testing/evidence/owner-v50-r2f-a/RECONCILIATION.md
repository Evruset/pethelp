# OWNER-V50-R2F-A visual reconciliation

## Authority and evidence

- Source: `prototype-v50/index.html`, OWN-018, `#doctor-select`.
- Source SHA-256: `81d5effec9805021f9ad5c74d93519903ec6624895bacfe9282ad185a3c270c9`.
- Viewports: `390x844`, `768x900`, and `1440x900`.
- `prototype-{mobile,tablet,desktop}.png` are direct Chromium renders of the source selector.
- `runtime-{mobile,tablet,desktop}-{content,selected,loading,empty,error}.png` render the production React Native Web component with controlled session/query seams.
- `compare-{mobile,tablet,desktop}-{content,selected,loading,empty,error}.png` place the source and runtime captures side by side at the same viewport. File hashes are recorded in `manifest.json`.

The controlled seams make all five UI states deterministic; they do not replace real-stack/network evidence and do not enable either production feature flag.

## Classified differences

### A. VISUAL_DEFECT — repaired

- Reconciled the title scale, V50 page gutters, equal desktop panel proportions, panel padding/radius/shadow, luminous canvas, and blue accent treatment.
- Replaced horizontal list rows with the responsive V50 portrait-card grid: two columns at 390/768 and four card slots per row at 1440.
- Preserved portrait media geometry with a neutral initial tile, aligned the specialist name/specialization hierarchy, added the authoritative nearest-slot badge, and reconciled selected borders/check treatment.
- Reordered the selection panel to `Выбранный специалист` then the selected public name and reconciled the primary action height/radius/location.
- Loading, empty, and error states now use the same reconciled V50 page/panel shell.

No unexplained major hierarchy, spacing, typography, card, or responsive-composition defect remains in the captured bounded surface.

### B. PRODUCT_SEMANTIC_ADAPTATION

- The runtime begins unselected and requires one explicit selection; the prototype preselects a demo doctor.
- The back label is `К выбору услуги`, because that is the actual journey destination. The prototype's `К карточке клиники` label would misstate runtime navigation.
- Global prototype navigation and its mobile bottom bar are omitted inside the bounded booking task flow.
- Only specialists eligible for the exact clinic/location/service are shown. Prototype referral-only specialty behavior is not copied and no client-side taxonomy is inferred.
- The subtitle retains authoritative service, clinic, and pet context instead of prototype demo facts.
- `Открыть профиль` is omitted: the safe projection has no authoritative public-profile destination. Loading, empty, error, stale, and retry compositions are runtime states absent from the prototype.

### C. V50_DATA_GAP

- Doctor portraits/photo mapping, experience, rating/reviews, biography/animal scope, credentials, profile content, and referral/specialty hierarchy are unavailable in the safe public projection.
- Prototype people, clinic, pet, and time values are demonstration facts and are never copied into runtime truth.
- The portrait slot is retained with an initial derived from the authorized public doctor name; missing facts are not represented by placeholders.

### D. ACCEPTABLE_PLATFORM_ADAPTATION

- React Native Web uses native `Pressable` radio/button semantics, platform focus/pressed states, system font rasterization, safe-area scrolling, and a derived initial instead of a factual portrait.
- Exact pixel antialiasing and browser-native scrollbar behavior may differ while composition and accessibility semantics remain intact.

## Result

`R2F_A_VISUAL_PARITY=PASS` for the bounded specialist-selection surface, with the B/C/D differences above intentionally retained.

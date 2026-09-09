# Owner V50 Home geometry — production reset

Canonical rendered reference: `docs/ux/v50-reference/owner/index.html#home`.

## 1440 × 900

- Product shell: floating horizontal bar, approximately 1120 × 64 px, centered
  with 16 px top inset; identity left, selected navigation in the middle,
  owner/actions right.
- Main canvas: broad 1392 px useful width with 24 px side padding and 16 px
  section rhythm.
- Header: 38 px greeting with compact subtitle and action cluster.
- Search decision hero: two columns near 1.25 / .75, 20 px padding, 16 px gap;
  42 px decision title, 48 px controls, three compact 72 px action rows.
- Immediate-value strip: one horizontal surface below the hero.
- Pet / next-action pair: approximately equal columns, minimum 260 px high.
- Cards: 18–22 px radii, light blue borders, soft 12/34 shadow.

## 390 × 844

- Page padding: 12 px; section gap: 12 px.
- Mobile product header: compact identity/actions; bottom navigation about 68 px.
- Greeting: 29–30 px, two short lines maximum including subtitle.
- Search decision hero: one column, 16 px padding; 30 px title; input and primary
  action stacked; compact action rows beneath.
- Immediate-value context follows the hero; Pet context begins in the next
  scroll beat without desktop-column compression.
- Controls remain at least 44 px; cards retain 18–22 px radii and blue-tinted
  surface hierarchy.

## Current production classification

- KEEP: auth/session boundary, booking entry, Diary entry, resumed booking,
  logout, owner-scoped Pet API and query cache.
- MODIFY: Pet fallback presentation, appointment-authority placeholder, Pilot
  navigation labels and shared Home-only visual tokens.
- REPLACE: left admin-style sidebar, sparse generic header, Pet/appointment-first
  page order, repeated equal-weight cards.
- REMOVE: prior visual PASS assumptions and any copy that implies appointment,
  clinic, price, slot or Pet facts not supplied by an authoritative contract.

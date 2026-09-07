# V50 Owner R2B parity report

Source: `docs/ux/v50-reference/owner/index.html` at `#catalog`, `#clinic`, and
`#booking`. Runtime: React Native Web Owner app with real BFF, authentication,
backend responses, and DoctorShift inventory.

Viewports: `390x844`, `1440x900`. The `implementation/` and `reference/`
directories contain six screenshots each.

| State / major block | Classification | Evidence and limitation |
| --- | --- | --- |
| Catalog owner task, compact result hierarchy, whole-card continuation | MATCH | One clear card action; identity/address/contact are authoritative |
| Catalog search, filtering, availability/price/confirmation comparison | BLOCKED_BY_DATA | Current Catalog has no service-aware query, summary, freshness, or confirmation fields |
| Catalog media, trust, capabilities, recommendation | BLOCKED_BY_DATA | No governed public-content, capability, trust, or ranking projection |
| Clinic identity and retained context | MATCH | Name, address, phone and authoritative IDs persist |
| Service selection and informational price | MATCH | Single selection; RUB is locale-formatted without changing its informational meaning |
| Clinic specialist/equipment/trust sections and service grouping | BLOCKED_BY_DATA | No public specialist/capability/group metadata |
| Availability clinic/service/Pet context | MATCH | All three selected entities are visible before continuation |
| Date navigation, slot grid and selected summary | MATCH | Clinic-local dates and DoctorShift slots; selected ID/version is revalidated |
| V50 booking confirmation explanation | APPROXIMATED | Honest request-confirmation copy is shown, but no authoritative per-clinic confirmation mode/SLA exists |
| Booking doctor and informational price summary | BLOCKED_BY_DATA | Availability response contains neither doctor nor price snapshot/reference |
| Insurance, emergency, Booking Review/Status | OUT_OF_SCOPE | Intentionally excluded from R2B/MVP surface |

## Automated browser result

- Post-auth console errors: `0`
- Page errors: `0`
- Failed required requests: `0`
- Horizontal overflow: `0` at both viewports for all three states
- Visible interactive targets below 44 px: `0`

## Verdict

The implemented states reconcile the V50 decision hierarchy wherever current
authoritative data supports it. Overall visual parity remains `NO`: several
prominent V50 blocks are correctly omitted because required projections do not
exist. `APPROXIMATED` and `BLOCKED_BY_DATA` are not counted as visual PASS.

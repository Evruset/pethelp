# OWNER-V50-R4 data-contract gaps

Canonical Owner V50 cards visually prioritize same-day availability, price,
distance, confidence/rating, specialists, and upcoming appointments. The Owner
runtime must not infer those facts from visual reference content.

| Canonical field | Currently available API field | Gap | Truthful UI fallback | Backend contract work required? |
|---|---|---|---|---|
| Clinic name, address, phone | Owner catalog/detail `name`, `address`, `phone` | None | Render exact values. | No |
| Service name and price | Detail `services[].name`, informational `price` | No final-payment meaning | Render localized informational price only on Service/Review. | No |
| Available date/time | Availability `localDate`, `localTime`, `slotId`, `expectedVersion` | None | Render published slots and revalidate ID/version before continuing. | No |
| Upcoming appointment | No Home bookings-read projection | Presence and absence are both unknown | Neutral “Новая запись” action without an appointment claim. | Yes, to show upcoming state |
| Rating/review count | None | Canonical confidence facts unavailable | Omit rating and review UI. | Yes |
| Distance/travel time | None | No location/distance authority | Omit proximity sorting and facts. | Yes |
| Nearest/same-day slot summary | Not available at catalog level | Requires service-specific availability | Defer time selection until Service → Availability. | Yes, only for catalog summary |
| Clinic photo | None | No clinic media identity | Neutral missing-photo panel. | Yes |
| Capability evidence | Online booking and service list only | No equipment/facility evidence | Show only online-booking availability and service count. | Yes |
| Doctor identity | Not part of clinic-first detail response | No doctor evidence in this flow | Omit doctors. | Yes |

The locally bundled canonical images are decorative Home art only. Clinic and
pet identity states use neutral or data-derived treatments.

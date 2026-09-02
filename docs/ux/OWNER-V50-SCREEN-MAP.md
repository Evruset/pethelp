# Owner V50 → production map

| V50 state | Production route | Production component | Status | Action | Pilot |
|---|---|---|---|---|---|
| Shell/navigation | `/` authenticated | `SessionNavigation`, `OwnerHome` | R1 aligned | MODIFY | IN_CURRENT_PILOT |
| Home `#home` | `/` authenticated | `OwnerHome` | R1 aligned | REPLACE | IN_CURRENT_PILOT |
| Discovery/catalog | Home booking flow | `ClinicCatalogScreen` | Functional, parity pending | MODIFY | IN_CURRENT_PILOT |
| Clinic/service | Home booking flow | `ClinicServiceScreen` | Functional, parity pending | MODIFY | IN_CURRENT_PILOT |
| Availability | Home booking flow | `AvailabilityScreen` | Functional, parity pending | MODIFY | IN_CURRENT_PILOT |
| Booking review/status | Home booking flow | `BookingReviewScreen` | Review exists; status surface pending | MODIFY / MISSING | IN_CURRENT_PILOT |
| Appointments | No dedicated route | — | Missing | MISSING | IN_CURRENT_PILOT |
| Pets | Shared selection flow | `PetJourneyScreen` | Functional selection only | MODIFY | IN_CURRENT_PILOT |
| Pet Diary | Home Diary flow | `PetDiaryScreen` | Functional, parity pending | MODIFY | IN_CURRENT_PILOT |
| Result detail | Diary local detail state | `PetDiaryScreen` | Functional, parity pending | MODIFY | IN_CURRENT_PILOT |
| Profile | No dedicated route | — | Missing | MISSING | IN_CURRENT_PILOT |
| Telemedicine / insurance / emergency | No Pilot route | — | Reference only | MISSING | OUT_OF_CURRENT_PILOT |

R1 changes only the shell and Home. Later rows remain mapping evidence, not authorization to implement them.

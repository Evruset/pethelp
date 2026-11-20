# Public data and visual provenance

Snapshot assembled 2026-11-08 (user timezone Europe/Moscow). Public information is reference data, not live availability. Provider links are external handoffs; no booking was made during verification.

## Visual reference and retained artwork

- User source: `/Users/evrusetskiy/Downloads/Vetora_Prototype_Iteration_01.html`, original export revision `9eb074289f2298d87af7f663be5563bf61e00573`.
- Layout reference: `/Users/evrusetskiy/Downloads/Главная без входа.png`.
- `assets/original-0.png`: original Vetora logo.
- `assets/original-1.png`–`original-13.png` and `original-17.png`: original dimensional interface/category icons, retained without redrawing or recoloring.
- `assets/original-3.webp`: original generic dog-and-cat hero, retained.
- `assets/original-14.jpg`–`original-16.jpg`, `original-18.jpg`–`original-22.jpg`: original clinic photographs. Existing clinic-to-image mappings are retained in `catalog.json`; no clinic photograph is AI-generated. These are inherited source photographs, not new claims about current interiors.
- The original system font stack, navy/cyan brand palette, blue dimensional artwork, rounded corners and gradient primary buttons inform the implementation. The target image supplies the header and section composition.

## Clinics, contact details and prices

- [Белый Клык: official contacts](https://bkvet.ru/contacts/) — Moscow, Митинская 55 к.1; Красная Пресня 6/2; Крылатская 5. Opening hours and network phone checked 2026-11-08. Closed Strogino location is excluded.
- [Белый Клык: official prices](https://bkvet.ru/prices/), [therapy](https://bkvet.ru/veterinarnyye-uslugi/priyem/terapevt/) — inherited 2026-11-05 prices; primary therapy tariff 6,700 RUB rechecked 2026-11-08. Specialist/GP tariffs remain separately named; no generic treatment price is passed off as the price for a specific doctor.
- [Свой Доктор: official price list](https://www.svoydoctor.ru/vladeltsam/tseny/price-list/) — inherited 2026-11-05 snapshot; primary therapy tariff 2,100 RUB rechecked 2026-11-08. This is a network tariff; every relevant view explicitly requires branch confirmation. Exclusions for medicines/consumables and additional studies are surfaced by the price note and provider source.
- The five «Свой Доктор» branch URLs and addresses are in `catalog.json`: Кузьминки, Бирюлёво, Чертаново, Красногорск, Мытищи. Pages fetched 2026-11-08. Coordinates, where available, were read from the official embedded maps, not estimated. Hours for Кузьминки are 09:00–22:00; unverified branch hours read «Уточнить в клинике».
- Public network phone numbers: «Белый Клык» +7 (967) 255-32-90; «Свой Доктор» +7 (495) 661-55-12.

## Public doctor profiles and photographs

Four profiles are taken from the [official Кузьминки branch page](https://www.svoydoctor.ru/vladeltsam/filialy/filial-kuzminki/) (checked 2026-11-08):

| Doctor | Published specialty | Official profile |
| --- | --- | --- |
| Галкина Анна Александровна | Gastroenterology, therapy, ultrasound diagnostics | [Profile](https://www.svoydoctor.ru/vladeltsam/spetsialisty/galkina-anna-aleksandrovna/) |
| Полякова (Стекольщикова) Надежда Александровна | Dermatology, endocrinology | [Profile](https://www.svoydoctor.ru/vladeltsam/spetsialisty/stekolshchikova-nadezhda-aleksandrovna/) |
| Воронина (Андриевская) Анна Александровна | Therapy | [Profile](https://www.svoydoctor.ru/vladeltsam/spetsialisty/andrievskaya-anna-aleksandrovna/) |
| Коптелова Ирина Валерьевна | Cardiology | [Profile](https://www.svoydoctor.ru/vladeltsam/spetsialisty/koptelova-irina-valerevna/) |

Photograph source URLs and retrieval dates are recorded in `doctors.json`. No ratings, years of experience, available slots, personal biography or popularity counts are invented. Specialties without profiles have an explicit empty state and links to the official full directories. «Популярные» sections are editorial navigation; there are no measured popularity claims or generated doctor portraits.

## Pharmacy and map

- [Ветлек official contacts](https://www.vetlek.ru/contacts/) — Открытое шоссе 5 к.6, Нижняя Красносельская 28, Егерская 1. Checked 2026-11-08. The three real locations replace duplicated/sample pharmacies in the reference. No medicine purchase, prescribing or stock availability is implemented.
- The embedded map and search results are supplied live by [Яндекс Карты](https://yandex.ru/maps/). Map availability requires internet. No generated/fake map tiles or fabricated coordinates are used. An ordinary external map link remains available when the iframe cannot load. Yandex search results may contain clinics beyond this small editorial catalog.

## Generated supporting asset

- Final path: `assets/auth-pets-generated.png`.
- Tool: built-in `image_gen` (no CLI/API fallback).
- Use: generic pet photograph behind the login/registration visual; never a clinic/doctor photograph. Original homepage hero is unchanged.
- Prompt:

> Create a premium veterinary website supporting editorial photograph for the login panel. A healthy friendly golden retriever and a small silver tabby cat sitting calmly close together on the right two thirds of the image, natural realistic anatomy, soft expressions looking toward camera, warm daylight, very pale icy sky blue seamless studio background #e9f6fd, airy calm trusted welcoming feeling. Wide landscape 3:2 composition, ample empty pale blue background in left third, subjects fully inside frame with no cropped heads or paws. No humans, no medical equipment, no text, no logos, no watermark. This is a generic pet photograph, never to be used as a real clinic or doctor photograph. Save resulting image as a reusable project asset.

Publicly accessible photographs and source facts are used for this local review prototype. Publication rights for third-party clinic/doctor photographs have not been established; obtain permission or approved assets before production publication.

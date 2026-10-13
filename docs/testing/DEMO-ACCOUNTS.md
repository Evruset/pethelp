# Local synthetic accounts

No passwords, OTPs or access tokens are stored here. Reserved example.test identities are fixtures, never real people.

Select the verified non-destructive reset generation in every terminal, then start `node dev/synthetic-multi-clinic/start.mjs` and select a listed identity:

```sh
export SYNTHETIC_DATABASE_NAME=synthetic_multiclinic_v4_r_4f809ec21a36
node dev/synthetic-multi-clinic/inspect.mjs owner0001@example.test
node dev/synthetic-multi-clinic/inspect.mjs clinic_admin.clinic01@example.test
node dev/synthetic-multi-clinic/inspect.mjs receptionist.clinic01@example.test
```

The CLI rechecks local DB/environment and the exact stored fixture account. Owners receive a standard opaque OwnerAuthService session, explicitly audited LOCAL_FIXTURE_NOT_OTP. Staff use the existing local JWT fixture mechanism with only the stored clinic/location; real DB memberships still authorize every operation. No production HTTP login/backdoor is added. No real OTP/IdP acceptance implied. Browser session only; credentials are not printed or saved.

Veterinarian UI exposes authorized location visits, not invented personal assignments. Raw medical fixture data is not automatically shared.

| Login | Source role | Clinic |
|---|---|---|
| clinic_admin.clinic01@example.test | CLINIC_ADMIN | СИНТЕТИКА · Лапа и сердце |
| receptionist.clinic01@example.test | RECEPTIONIST | СИНТЕТИКА · Лапа и сердце |
| doctor01.clinic01@example.test | VETERINARIAN | СИНТЕТИКА · Лапа и сердце |
| doctor02.clinic01@example.test | VETERINARIAN | СИНТЕТИКА · Лапа и сердце |
| doctor03.clinic01@example.test | VETERINARIAN | СИНТЕТИКА · Лапа и сердце |
| doctor04.clinic01@example.test | VETERINARIAN | СИНТЕТИКА · Лапа и сердце |
| doctor05.clinic01@example.test | VETERINARIAN | СИНТЕТИКА · Лапа и сердце |
| doctor06.clinic01@example.test | VETERINARIAN | СИНТЕТИКА · Лапа и сердце |
| doctor07.clinic01@example.test | VETERINARIAN | СИНТЕТИКА · Лапа и сердце |
| doctor08.clinic01@example.test | VETERINARIAN | СИНТЕТИКА · Лапа и сердце |
| doctor09.clinic01@example.test | VETERINARIAN | СИНТЕТИКА · Лапа и сердце |
| doctor10.clinic01@example.test | VETERINARIAN | СИНТЕТИКА · Лапа и сердце |
| clinic_admin.clinic02@example.test | CLINIC_ADMIN | СИНТЕТИКА · ЗооПрофи |
| receptionist.clinic02@example.test | RECEPTIONIST | СИНТЕТИКА · ЗооПрофи |
| doctor01.clinic02@example.test | VETERINARIAN | СИНТЕТИКА · ЗооПрофи |
| doctor02.clinic02@example.test | VETERINARIAN | СИНТЕТИКА · ЗооПрофи |
| doctor03.clinic02@example.test | VETERINARIAN | СИНТЕТИКА · ЗооПрофи |
| doctor04.clinic02@example.test | VETERINARIAN | СИНТЕТИКА · ЗооПрофи |
| doctor05.clinic02@example.test | VETERINARIAN | СИНТЕТИКА · ЗооПрофи |
| doctor06.clinic02@example.test | VETERINARIAN | СИНТЕТИКА · ЗооПрофи |
| doctor07.clinic02@example.test | VETERINARIAN | СИНТЕТИКА · ЗооПрофи |
| doctor08.clinic02@example.test | VETERINARIAN | СИНТЕТИКА · ЗооПрофи |
| doctor09.clinic02@example.test | VETERINARIAN | СИНТЕТИКА · ЗооПрофи |
| doctor10.clinic02@example.test | VETERINARIAN | СИНТЕТИКА · ЗооПрофи |
| clinic_admin.clinic03@example.test | CLINIC_ADMIN | СИНТЕТИКА · Друг рядом |
| receptionist.clinic03@example.test | RECEPTIONIST | СИНТЕТИКА · Друг рядом |
| doctor01.clinic03@example.test | VETERINARIAN | СИНТЕТИКА · Друг рядом |
| doctor02.clinic03@example.test | VETERINARIAN | СИНТЕТИКА · Друг рядом |
| doctor03.clinic03@example.test | VETERINARIAN | СИНТЕТИКА · Друг рядом |
| doctor04.clinic03@example.test | VETERINARIAN | СИНТЕТИКА · Друг рядом |
| doctor05.clinic03@example.test | VETERINARIAN | СИНТЕТИКА · Друг рядом |
| doctor06.clinic03@example.test | VETERINARIAN | СИНТЕТИКА · Друг рядом |
| doctor07.clinic03@example.test | VETERINARIAN | СИНТЕТИКА · Друг рядом |
| doctor08.clinic03@example.test | VETERINARIAN | СИНТЕТИКА · Друг рядом |
| doctor09.clinic03@example.test | VETERINARIAN | СИНТЕТИКА · Друг рядом |
| doctor10.clinic03@example.test | VETERINARIAN | СИНТЕТИКА · Друг рядом |
| clinic_admin.clinic04@example.test | CLINIC_ADMIN | СИНТЕТИКА · ВетПульс |
| receptionist.clinic04@example.test | RECEPTIONIST | СИНТЕТИКА · ВетПульс |
| doctor01.clinic04@example.test | VETERINARIAN | СИНТЕТИКА · ВетПульс |
| doctor02.clinic04@example.test | VETERINARIAN | СИНТЕТИКА · ВетПульс |
| doctor03.clinic04@example.test | VETERINARIAN | СИНТЕТИКА · ВетПульс |
| doctor04.clinic04@example.test | VETERINARIAN | СИНТЕТИКА · ВетПульс |
| doctor05.clinic04@example.test | VETERINARIAN | СИНТЕТИКА · ВетПульс |
| doctor06.clinic04@example.test | VETERINARIAN | СИНТЕТИКА · ВетПульс |
| doctor07.clinic04@example.test | VETERINARIAN | СИНТЕТИКА · ВетПульс |
| doctor08.clinic04@example.test | VETERINARIAN | СИНТЕТИКА · ВетПульс |
| doctor09.clinic04@example.test | VETERINARIAN | СИНТЕТИКА · ВетПульс |
| doctor10.clinic04@example.test | VETERINARIAN | СИНТЕТИКА · ВетПульс |
| clinic_admin.clinic05@example.test | CLINIC_ADMIN | СИНТЕТИКА · Счастливый хвост |
| receptionist.clinic05@example.test | RECEPTIONIST | СИНТЕТИКА · Счастливый хвост |
| doctor01.clinic05@example.test | VETERINARIAN | СИНТЕТИКА · Счастливый хвост |
| doctor02.clinic05@example.test | VETERINARIAN | СИНТЕТИКА · Счастливый хвост |
| doctor03.clinic05@example.test | VETERINARIAN | СИНТЕТИКА · Счастливый хвост |
| doctor04.clinic05@example.test | VETERINARIAN | СИНТЕТИКА · Счастливый хвост |
| doctor05.clinic05@example.test | VETERINARIAN | СИНТЕТИКА · Счастливый хвост |
| doctor06.clinic05@example.test | VETERINARIAN | СИНТЕТИКА · Счастливый хвост |
| doctor07.clinic05@example.test | VETERINARIAN | СИНТЕТИКА · Счастливый хвост |
| doctor08.clinic05@example.test | VETERINARIAN | СИНТЕТИКА · Счастливый хвост |
| doctor09.clinic05@example.test | VETERINARIAN | СИНТЕТИКА · Счастливый хвост |
| doctor10.clinic05@example.test | VETERINARIAN | СИНТЕТИКА · Счастливый хвост |
| clinic_admin.clinic06@example.test | CLINIC_ADMIN | СИНТЕТИКА · Мягкие лапы |
| receptionist.clinic06@example.test | RECEPTIONIST | СИНТЕТИКА · Мягкие лапы |
| doctor01.clinic06@example.test | VETERINARIAN | СИНТЕТИКА · Мягкие лапы |
| doctor02.clinic06@example.test | VETERINARIAN | СИНТЕТИКА · Мягкие лапы |
| doctor03.clinic06@example.test | VETERINARIAN | СИНТЕТИКА · Мягкие лапы |
| doctor04.clinic06@example.test | VETERINARIAN | СИНТЕТИКА · Мягкие лапы |
| doctor05.clinic06@example.test | VETERINARIAN | СИНТЕТИКА · Мягкие лапы |
| doctor06.clinic06@example.test | VETERINARIAN | СИНТЕТИКА · Мягкие лапы |
| doctor07.clinic06@example.test | VETERINARIAN | СИНТЕТИКА · Мягкие лапы |
| doctor08.clinic06@example.test | VETERINARIAN | СИНТЕТИКА · Мягкие лапы |
| doctor09.clinic06@example.test | VETERINARIAN | СИНТЕТИКА · Мягкие лапы |
| doctor10.clinic06@example.test | VETERINARIAN | СИНТЕТИКА · Мягкие лапы |
| clinic_admin.clinic07@example.test | CLINIC_ADMIN | СИНТЕТИКА · ВетПрактика |
| receptionist.clinic07@example.test | RECEPTIONIST | СИНТЕТИКА · ВетПрактика |
| doctor01.clinic07@example.test | VETERINARIAN | СИНТЕТИКА · ВетПрактика |
| doctor02.clinic07@example.test | VETERINARIAN | СИНТЕТИКА · ВетПрактика |
| doctor03.clinic07@example.test | VETERINARIAN | СИНТЕТИКА · ВетПрактика |
| doctor04.clinic07@example.test | VETERINARIAN | СИНТЕТИКА · ВетПрактика |
| doctor05.clinic07@example.test | VETERINARIAN | СИНТЕТИКА · ВетПрактика |
| doctor06.clinic07@example.test | VETERINARIAN | СИНТЕТИКА · ВетПрактика |
| doctor07.clinic07@example.test | VETERINARIAN | СИНТЕТИКА · ВетПрактика |
| doctor08.clinic07@example.test | VETERINARIAN | СИНТЕТИКА · ВетПрактика |
| doctor09.clinic07@example.test | VETERINARIAN | СИНТЕТИКА · ВетПрактика |
| doctor10.clinic07@example.test | VETERINARIAN | СИНТЕТИКА · ВетПрактика |
| clinic_admin.clinic08@example.test | CLINIC_ADMIN | СИНТЕТИКА · Питомец+ |
| receptionist.clinic08@example.test | RECEPTIONIST | СИНТЕТИКА · Питомец+ |
| doctor01.clinic08@example.test | VETERINARIAN | СИНТЕТИКА · Питомец+ |
| doctor02.clinic08@example.test | VETERINARIAN | СИНТЕТИКА · Питомец+ |
| doctor03.clinic08@example.test | VETERINARIAN | СИНТЕТИКА · Питомец+ |
| doctor04.clinic08@example.test | VETERINARIAN | СИНТЕТИКА · Питомец+ |
| doctor05.clinic08@example.test | VETERINARIAN | СИНТЕТИКА · Питомец+ |
| doctor06.clinic08@example.test | VETERINARIAN | СИНТЕТИКА · Питомец+ |
| doctor07.clinic08@example.test | VETERINARIAN | СИНТЕТИКА · Питомец+ |
| doctor08.clinic08@example.test | VETERINARIAN | СИНТЕТИКА · Питомец+ |
| doctor09.clinic08@example.test | VETERINARIAN | СИНТЕТИКА · Питомец+ |
| doctor10.clinic08@example.test | VETERINARIAN | СИНТЕТИКА · Питомец+ |
| clinic_admin.clinic09@example.test | CLINIC_ADMIN | СИНТЕТИКА · Добрый доктор |
| receptionist.clinic09@example.test | RECEPTIONIST | СИНТЕТИКА · Добрый доктор |
| doctor01.clinic09@example.test | VETERINARIAN | СИНТЕТИКА · Добрый доктор |
| doctor02.clinic09@example.test | VETERINARIAN | СИНТЕТИКА · Добрый доктор |
| doctor03.clinic09@example.test | VETERINARIAN | СИНТЕТИКА · Добрый доктор |
| doctor04.clinic09@example.test | VETERINARIAN | СИНТЕТИКА · Добрый доктор |
| doctor05.clinic09@example.test | VETERINARIAN | СИНТЕТИКА · Добрый доктор |
| doctor06.clinic09@example.test | VETERINARIAN | СИНТЕТИКА · Добрый доктор |
| doctor07.clinic09@example.test | VETERINARIAN | СИНТЕТИКА · Добрый доктор |
| doctor08.clinic09@example.test | VETERINARIAN | СИНТЕТИКА · Добрый доктор |
| doctor09.clinic09@example.test | VETERINARIAN | СИНТЕТИКА · Добрый доктор |
| doctor10.clinic09@example.test | VETERINARIAN | СИНТЕТИКА · Добрый доктор |
| clinic_admin.clinic10@example.test | CLINIC_ADMIN | СИНТЕТИКА · Мир хвостов |
| receptionist.clinic10@example.test | RECEPTIONIST | СИНТЕТИКА · Мир хвостов |
| doctor01.clinic10@example.test | VETERINARIAN | СИНТЕТИКА · Мир хвостов |
| doctor02.clinic10@example.test | VETERINARIAN | СИНТЕТИКА · Мир хвостов |
| doctor03.clinic10@example.test | VETERINARIAN | СИНТЕТИКА · Мир хвостов |
| doctor04.clinic10@example.test | VETERINARIAN | СИНТЕТИКА · Мир хвостов |
| doctor05.clinic10@example.test | VETERINARIAN | СИНТЕТИКА · Мир хвостов |
| doctor06.clinic10@example.test | VETERINARIAN | СИНТЕТИКА · Мир хвостов |
| doctor07.clinic10@example.test | VETERINARIAN | СИНТЕТИКА · Мир хвостов |
| doctor08.clinic10@example.test | VETERINARIAN | СИНТЕТИКА · Мир хвостов |
| doctor09.clinic10@example.test | VETERINARIAN | СИНТЕТИКА · Мир хвостов |
| doctor10.clinic10@example.test | VETERINARIAN | СИНТЕТИКА · Мир хвостов |
| clinic_admin.clinic11@example.test | CLINIC_ADMIN | СИНТЕТИКА · ВетНавигатор |
| receptionist.clinic11@example.test | RECEPTIONIST | СИНТЕТИКА · ВетНавигатор |
| doctor01.clinic11@example.test | VETERINARIAN | СИНТЕТИКА · ВетНавигатор |
| doctor02.clinic11@example.test | VETERINARIAN | СИНТЕТИКА · ВетНавигатор |
| doctor03.clinic11@example.test | VETERINARIAN | СИНТЕТИКА · ВетНавигатор |
| doctor04.clinic11@example.test | VETERINARIAN | СИНТЕТИКА · ВетНавигатор |
| doctor05.clinic11@example.test | VETERINARIAN | СИНТЕТИКА · ВетНавигатор |
| doctor06.clinic11@example.test | VETERINARIAN | СИНТЕТИКА · ВетНавигатор |
| doctor07.clinic11@example.test | VETERINARIAN | СИНТЕТИКА · ВетНавигатор |
| doctor08.clinic11@example.test | VETERINARIAN | СИНТЕТИКА · ВетНавигатор |
| doctor09.clinic11@example.test | VETERINARIAN | СИНТЕТИКА · ВетНавигатор |
| doctor10.clinic11@example.test | VETERINARIAN | СИНТЕТИКА · ВетНавигатор |
| clinic_admin.clinic12@example.test | CLINIC_ADMIN | СИНТЕТИКА · Атлас Вет |
| receptionist.clinic12@example.test | RECEPTIONIST | СИНТЕТИКА · Атлас Вет |
| doctor01.clinic12@example.test | VETERINARIAN | СИНТЕТИКА · Атлас Вет |
| doctor02.clinic12@example.test | VETERINARIAN | СИНТЕТИКА · Атлас Вет |
| doctor03.clinic12@example.test | VETERINARIAN | СИНТЕТИКА · Атлас Вет |
| doctor04.clinic12@example.test | VETERINARIAN | СИНТЕТИКА · Атлас Вет |
| doctor05.clinic12@example.test | VETERINARIAN | СИНТЕТИКА · Атлас Вет |
| doctor06.clinic12@example.test | VETERINARIAN | СИНТЕТИКА · Атлас Вет |
| doctor07.clinic12@example.test | VETERINARIAN | СИНТЕТИКА · Атлас Вет |
| doctor08.clinic12@example.test | VETERINARIAN | СИНТЕТИКА · Атлас Вет |
| doctor09.clinic12@example.test | VETERINARIAN | СИНТЕТИКА · Атлас Вет |
| doctor10.clinic12@example.test | VETERINARIAN | СИНТЕТИКА · Атлас Вет |
| clinic_admin.clinic13@example.test | CLINIC_ADMIN | СИНТЕТИКА · Тёплый нос |
| receptionist.clinic13@example.test | RECEPTIONIST | СИНТЕТИКА · Тёплый нос |
| doctor01.clinic13@example.test | VETERINARIAN | СИНТЕТИКА · Тёплый нос |
| doctor02.clinic13@example.test | VETERINARIAN | СИНТЕТИКА · Тёплый нос |
| doctor03.clinic13@example.test | VETERINARIAN | СИНТЕТИКА · Тёплый нос |
| doctor04.clinic13@example.test | VETERINARIAN | СИНТЕТИКА · Тёплый нос |
| doctor05.clinic13@example.test | VETERINARIAN | СИНТЕТИКА · Тёплый нос |
| doctor06.clinic13@example.test | VETERINARIAN | СИНТЕТИКА · Тёплый нос |
| doctor07.clinic13@example.test | VETERINARIAN | СИНТЕТИКА · Тёплый нос |
| doctor08.clinic13@example.test | VETERINARIAN | СИНТЕТИКА · Тёплый нос |
| doctor09.clinic13@example.test | VETERINARIAN | СИНТЕТИКА · Тёплый нос |
| doctor10.clinic13@example.test | VETERINARIAN | СИНТЕТИКА · Тёплый нос |
| clinic_admin.clinic14@example.test | CLINIC_ADMIN | СИНТЕТИКА · Семейная Вет |
| receptionist.clinic14@example.test | RECEPTIONIST | СИНТЕТИКА · Семейная Вет |
| doctor01.clinic14@example.test | VETERINARIAN | СИНТЕТИКА · Семейная Вет |
| doctor02.clinic14@example.test | VETERINARIAN | СИНТЕТИКА · Семейная Вет |
| doctor03.clinic14@example.test | VETERINARIAN | СИНТЕТИКА · Семейная Вет |
| doctor04.clinic14@example.test | VETERINARIAN | СИНТЕТИКА · Семейная Вет |
| doctor05.clinic14@example.test | VETERINARIAN | СИНТЕТИКА · Семейная Вет |
| doctor06.clinic14@example.test | VETERINARIAN | СИНТЕТИКА · Семейная Вет |
| doctor07.clinic14@example.test | VETERINARIAN | СИНТЕТИКА · Семейная Вет |
| doctor08.clinic14@example.test | VETERINARIAN | СИНТЕТИКА · Семейная Вет |
| doctor09.clinic14@example.test | VETERINARIAN | СИНТЕТИКА · Семейная Вет |
| doctor10.clinic14@example.test | VETERINARIAN | СИНТЕТИКА · Семейная Вет |
| clinic_admin.clinic15@example.test | CLINIC_ADMIN | СИНТЕТИКА · Пульс питомца |
| receptionist.clinic15@example.test | RECEPTIONIST | СИНТЕТИКА · Пульс питомца |
| doctor01.clinic15@example.test | VETERINARIAN | СИНТЕТИКА · Пульс питомца |
| doctor02.clinic15@example.test | VETERINARIAN | СИНТЕТИКА · Пульс питомца |
| doctor03.clinic15@example.test | VETERINARIAN | СИНТЕТИКА · Пульс питомца |
| doctor04.clinic15@example.test | VETERINARIAN | СИНТЕТИКА · Пульс питомца |
| doctor05.clinic15@example.test | VETERINARIAN | СИНТЕТИКА · Пульс питомца |
| doctor06.clinic15@example.test | VETERINARIAN | СИНТЕТИКА · Пульс питомца |
| doctor07.clinic15@example.test | VETERINARIAN | СИНТЕТИКА · Пульс питомца |
| doctor08.clinic15@example.test | VETERINARIAN | СИНТЕТИКА · Пульс питомца |
| doctor09.clinic15@example.test | VETERINARIAN | СИНТЕТИКА · Пульс питомца |
| doctor10.clinic15@example.test | VETERINARIAN | СИНТЕТИКА · Пульс питомца |
| clinic_admin.clinic16@example.test | CLINIC_ADMIN | СИНТЕТИКА · Лапландия Вет |
| receptionist.clinic16@example.test | RECEPTIONIST | СИНТЕТИКА · Лапландия Вет |
| doctor01.clinic16@example.test | VETERINARIAN | СИНТЕТИКА · Лапландия Вет |
| doctor02.clinic16@example.test | VETERINARIAN | СИНТЕТИКА · Лапландия Вет |
| doctor03.clinic16@example.test | VETERINARIAN | СИНТЕТИКА · Лапландия Вет |
| doctor04.clinic16@example.test | VETERINARIAN | СИНТЕТИКА · Лапландия Вет |
| doctor05.clinic16@example.test | VETERINARIAN | СИНТЕТИКА · Лапландия Вет |
| doctor06.clinic16@example.test | VETERINARIAN | СИНТЕТИКА · Лапландия Вет |
| doctor07.clinic16@example.test | VETERINARIAN | СИНТЕТИКА · Лапландия Вет |
| doctor08.clinic16@example.test | VETERINARIAN | СИНТЕТИКА · Лапландия Вет |
| doctor09.clinic16@example.test | VETERINARIAN | СИНТЕТИКА · Лапландия Вет |
| doctor10.clinic16@example.test | VETERINARIAN | СИНТЕТИКА · Лапландия Вет |
| clinic_admin.clinic17@example.test | CLINIC_ADMIN | СИНТЕТИКА · ЗооБаланс |
| receptionist.clinic17@example.test | RECEPTIONIST | СИНТЕТИКА · ЗооБаланс |
| doctor01.clinic17@example.test | VETERINARIAN | СИНТЕТИКА · ЗооБаланс |
| doctor02.clinic17@example.test | VETERINARIAN | СИНТЕТИКА · ЗооБаланс |
| doctor03.clinic17@example.test | VETERINARIAN | СИНТЕТИКА · ЗооБаланс |
| doctor04.clinic17@example.test | VETERINARIAN | СИНТЕТИКА · ЗооБаланс |
| doctor05.clinic17@example.test | VETERINARIAN | СИНТЕТИКА · ЗооБаланс |
| doctor06.clinic17@example.test | VETERINARIAN | СИНТЕТИКА · ЗооБаланс |
| doctor07.clinic17@example.test | VETERINARIAN | СИНТЕТИКА · ЗооБаланс |
| doctor08.clinic17@example.test | VETERINARIAN | СИНТЕТИКА · ЗооБаланс |
| doctor09.clinic17@example.test | VETERINARIAN | СИНТЕТИКА · ЗооБаланс |
| doctor10.clinic17@example.test | VETERINARIAN | СИНТЕТИКА · ЗооБаланс |
| clinic_admin.clinic18@example.test | CLINIC_ADMIN | СИНТЕТИКА · Доктор Пёс и Кот |
| receptionist.clinic18@example.test | RECEPTIONIST | СИНТЕТИКА · Доктор Пёс и Кот |
| doctor01.clinic18@example.test | VETERINARIAN | СИНТЕТИКА · Доктор Пёс и Кот |
| doctor02.clinic18@example.test | VETERINARIAN | СИНТЕТИКА · Доктор Пёс и Кот |
| doctor03.clinic18@example.test | VETERINARIAN | СИНТЕТИКА · Доктор Пёс и Кот |
| doctor04.clinic18@example.test | VETERINARIAN | СИНТЕТИКА · Доктор Пёс и Кот |
| doctor05.clinic18@example.test | VETERINARIAN | СИНТЕТИКА · Доктор Пёс и Кот |
| doctor06.clinic18@example.test | VETERINARIAN | СИНТЕТИКА · Доктор Пёс и Кот |
| doctor07.clinic18@example.test | VETERINARIAN | СИНТЕТИКА · Доктор Пёс и Кот |
| doctor08.clinic18@example.test | VETERINARIAN | СИНТЕТИКА · Доктор Пёс и Кот |
| doctor09.clinic18@example.test | VETERINARIAN | СИНТЕТИКА · Доктор Пёс и Кот |
| doctor10.clinic18@example.test | VETERINARIAN | СИНТЕТИКА · Доктор Пёс и Кот |
| clinic_admin.clinic19@example.test | CLINIC_ADMIN | СИНТЕТИКА · Умная лапа |
| receptionist.clinic19@example.test | RECEPTIONIST | СИНТЕТИКА · Умная лапа |
| doctor01.clinic19@example.test | VETERINARIAN | СИНТЕТИКА · Умная лапа |
| doctor02.clinic19@example.test | VETERINARIAN | СИНТЕТИКА · Умная лапа |
| doctor03.clinic19@example.test | VETERINARIAN | СИНТЕТИКА · Умная лапа |
| doctor04.clinic19@example.test | VETERINARIAN | СИНТЕТИКА · Умная лапа |
| doctor05.clinic19@example.test | VETERINARIAN | СИНТЕТИКА · Умная лапа |
| doctor06.clinic19@example.test | VETERINARIAN | СИНТЕТИКА · Умная лапа |
| doctor07.clinic19@example.test | VETERINARIAN | СИНТЕТИКА · Умная лапа |
| doctor08.clinic19@example.test | VETERINARIAN | СИНТЕТИКА · Умная лапа |
| doctor09.clinic19@example.test | VETERINARIAN | СИНТЕТИКА · Умная лапа |
| doctor10.clinic19@example.test | VETERINARIAN | СИНТЕТИКА · Умная лапа |
| clinic_admin.clinic20@example.test | CLINIC_ADMIN | СИНТЕТИКА · ВетСфера |
| receptionist.clinic20@example.test | RECEPTIONIST | СИНТЕТИКА · ВетСфера |
| doctor01.clinic20@example.test | VETERINARIAN | СИНТЕТИКА · ВетСфера |
| doctor02.clinic20@example.test | VETERINARIAN | СИНТЕТИКА · ВетСфера |
| doctor03.clinic20@example.test | VETERINARIAN | СИНТЕТИКА · ВетСфера |
| doctor04.clinic20@example.test | VETERINARIAN | СИНТЕТИКА · ВетСфера |
| doctor05.clinic20@example.test | VETERINARIAN | СИНТЕТИКА · ВетСфера |
| doctor06.clinic20@example.test | VETERINARIAN | СИНТЕТИКА · ВетСфера |
| doctor07.clinic20@example.test | VETERINARIAN | СИНТЕТИКА · ВетСфера |
| doctor08.clinic20@example.test | VETERINARIAN | СИНТЕТИКА · ВетСфера |
| doctor09.clinic20@example.test | VETERINARIAN | СИНТЕТИКА · ВетСфера |
| doctor10.clinic20@example.test | VETERINARIAN | СИНТЕТИКА · ВетСфера |
| clinic_admin.clinic21@example.test | CLINIC_ADMIN | СИНТЕТИКА · Хвост и здоровье |
| receptionist.clinic21@example.test | RECEPTIONIST | СИНТЕТИКА · Хвост и здоровье |
| doctor01.clinic21@example.test | VETERINARIAN | СИНТЕТИКА · Хвост и здоровье |
| doctor02.clinic21@example.test | VETERINARIAN | СИНТЕТИКА · Хвост и здоровье |
| doctor03.clinic21@example.test | VETERINARIAN | СИНТЕТИКА · Хвост и здоровье |
| doctor04.clinic21@example.test | VETERINARIAN | СИНТЕТИКА · Хвост и здоровье |
| doctor05.clinic21@example.test | VETERINARIAN | СИНТЕТИКА · Хвост и здоровье |
| doctor06.clinic21@example.test | VETERINARIAN | СИНТЕТИКА · Хвост и здоровье |
| doctor07.clinic21@example.test | VETERINARIAN | СИНТЕТИКА · Хвост и здоровье |
| doctor08.clinic21@example.test | VETERINARIAN | СИНТЕТИКА · Хвост и здоровье |
| doctor09.clinic21@example.test | VETERINARIAN | СИНТЕТИКА · Хвост и здоровье |
| doctor10.clinic21@example.test | VETERINARIAN | СИНТЕТИКА · Хвост и здоровье |
| clinic_admin.clinic22@example.test | CLINIC_ADMIN | СИНТЕТИКА · Забота 24 |
| receptionist.clinic22@example.test | RECEPTIONIST | СИНТЕТИКА · Забота 24 |
| doctor01.clinic22@example.test | VETERINARIAN | СИНТЕТИКА · Забота 24 |
| doctor02.clinic22@example.test | VETERINARIAN | СИНТЕТИКА · Забота 24 |
| doctor03.clinic22@example.test | VETERINARIAN | СИНТЕТИКА · Забота 24 |
| doctor04.clinic22@example.test | VETERINARIAN | СИНТЕТИКА · Забота 24 |
| doctor05.clinic22@example.test | VETERINARIAN | СИНТЕТИКА · Забота 24 |
| doctor06.clinic22@example.test | VETERINARIAN | СИНТЕТИКА · Забота 24 |
| doctor07.clinic22@example.test | VETERINARIAN | СИНТЕТИКА · Забота 24 |
| doctor08.clinic22@example.test | VETERINARIAN | СИНТЕТИКА · Забота 24 |
| doctor09.clinic22@example.test | VETERINARIAN | СИНТЕТИКА · Забота 24 |
| doctor10.clinic22@example.test | VETERINARIAN | СИНТЕТИКА · Забота 24 |
| clinic_admin.clinic23@example.test | CLINIC_ADMIN | СИНТЕТИКА · Верный друг |
| receptionist.clinic23@example.test | RECEPTIONIST | СИНТЕТИКА · Верный друг |
| doctor01.clinic23@example.test | VETERINARIAN | СИНТЕТИКА · Верный друг |
| doctor02.clinic23@example.test | VETERINARIAN | СИНТЕТИКА · Верный друг |
| doctor03.clinic23@example.test | VETERINARIAN | СИНТЕТИКА · Верный друг |
| doctor04.clinic23@example.test | VETERINARIAN | СИНТЕТИКА · Верный друг |
| doctor05.clinic23@example.test | VETERINARIAN | СИНТЕТИКА · Верный друг |
| doctor06.clinic23@example.test | VETERINARIAN | СИНТЕТИКА · Верный друг |
| doctor07.clinic23@example.test | VETERINARIAN | СИНТЕТИКА · Верный друг |
| doctor08.clinic23@example.test | VETERINARIAN | СИНТЕТИКА · Верный друг |
| doctor09.clinic23@example.test | VETERINARIAN | СИНТЕТИКА · Верный друг |
| doctor10.clinic23@example.test | VETERINARIAN | СИНТЕТИКА · Верный друг |
| clinic_admin.clinic24@example.test | CLINIC_ADMIN | СИНТЕТИКА · ВетЛиния |
| receptionist.clinic24@example.test | RECEPTIONIST | СИНТЕТИКА · ВетЛиния |
| doctor01.clinic24@example.test | VETERINARIAN | СИНТЕТИКА · ВетЛиния |
| doctor02.clinic24@example.test | VETERINARIAN | СИНТЕТИКА · ВетЛиния |
| doctor03.clinic24@example.test | VETERINARIAN | СИНТЕТИКА · ВетЛиния |
| doctor04.clinic24@example.test | VETERINARIAN | СИНТЕТИКА · ВетЛиния |
| doctor05.clinic24@example.test | VETERINARIAN | СИНТЕТИКА · ВетЛиния |
| doctor06.clinic24@example.test | VETERINARIAN | СИНТЕТИКА · ВетЛиния |
| doctor07.clinic24@example.test | VETERINARIAN | СИНТЕТИКА · ВетЛиния |
| doctor08.clinic24@example.test | VETERINARIAN | СИНТЕТИКА · ВетЛиния |
| doctor09.clinic24@example.test | VETERINARIAN | СИНТЕТИКА · ВетЛиния |
| doctor10.clinic24@example.test | VETERINARIAN | СИНТЕТИКА · ВетЛиния |
| clinic_admin.clinic25@example.test | CLINIC_ADMIN | СИНТЕТИКА · Клиника Листок |
| receptionist.clinic25@example.test | RECEPTIONIST | СИНТЕТИКА · Клиника Листок |
| doctor01.clinic25@example.test | VETERINARIAN | СИНТЕТИКА · Клиника Листок |
| doctor02.clinic25@example.test | VETERINARIAN | СИНТЕТИКА · Клиника Листок |
| doctor03.clinic25@example.test | VETERINARIAN | СИНТЕТИКА · Клиника Листок |
| doctor04.clinic25@example.test | VETERINARIAN | СИНТЕТИКА · Клиника Листок |
| doctor05.clinic25@example.test | VETERINARIAN | СИНТЕТИКА · Клиника Листок |
| doctor06.clinic25@example.test | VETERINARIAN | СИНТЕТИКА · Клиника Листок |
| doctor07.clinic25@example.test | VETERINARIAN | СИНТЕТИКА · Клиника Листок |
| doctor08.clinic25@example.test | VETERINARIAN | СИНТЕТИКА · Клиника Листок |
| doctor09.clinic25@example.test | VETERINARIAN | СИНТЕТИКА · Клиника Листок |
| doctor10.clinic25@example.test | VETERINARIAN | СИНТЕТИКА · Клиника Листок |
| owner0001@example.test | OWNER | Own pets only |
| owner0002@example.test | OWNER | Own pets only |
| owner0003@example.test | OWNER | Own pets only |
| owner0004@example.test | OWNER | Own pets only |
| owner0005@example.test | OWNER | Own pets only |
| owner0006@example.test | OWNER | Own pets only |
| owner0007@example.test | OWNER | Own pets only |
| owner0008@example.test | OWNER | Own pets only |
| owner0009@example.test | OWNER | Own pets only |
| owner0010@example.test | OWNER | Own pets only |
| owner0011@example.test | OWNER | Own pets only |
| owner0012@example.test | OWNER | Own pets only |
| owner0013@example.test | OWNER | Own pets only |
| owner0014@example.test | OWNER | Own pets only |
| owner0015@example.test | OWNER | Own pets only |
| owner0016@example.test | OWNER | Own pets only |
| owner0017@example.test | OWNER | Own pets only |
| owner0018@example.test | OWNER | Own pets only |
| owner0019@example.test | OWNER | Own pets only |
| owner0020@example.test | OWNER | Own pets only |
| owner0021@example.test | OWNER | Own pets only |
| owner0022@example.test | OWNER | Own pets only |
| owner0023@example.test | OWNER | Own pets only |
| owner0024@example.test | OWNER | Own pets only |
| owner0025@example.test | OWNER | Own pets only |
| owner0026@example.test | OWNER | Own pets only |
| owner0027@example.test | OWNER | Own pets only |
| owner0028@example.test | OWNER | Own pets only |
| owner0029@example.test | OWNER | Own pets only |
| owner0030@example.test | OWNER | Own pets only |
| owner0031@example.test | OWNER | Own pets only |
| owner0032@example.test | OWNER | Own pets only |
| owner0033@example.test | OWNER | Own pets only |
| owner0034@example.test | OWNER | Own pets only |
| owner0035@example.test | OWNER | Own pets only |
| owner0036@example.test | OWNER | Own pets only |
| owner0037@example.test | OWNER | Own pets only |
| owner0038@example.test | OWNER | Own pets only |
| owner0039@example.test | OWNER | Own pets only |
| owner0040@example.test | OWNER | Own pets only |
| owner0041@example.test | OWNER | Own pets only |
| owner0042@example.test | OWNER | Own pets only |
| owner0043@example.test | OWNER | Own pets only |
| owner0044@example.test | OWNER | Own pets only |
| owner0045@example.test | OWNER | Own pets only |
| owner0046@example.test | OWNER | Own pets only |
| owner0047@example.test | OWNER | Own pets only |
| owner0048@example.test | OWNER | Own pets only |
| owner0049@example.test | OWNER | Own pets only |
| owner0050@example.test | OWNER | Own pets only |
| owner0051@example.test | OWNER | Own pets only |
| owner0052@example.test | OWNER | Own pets only |
| owner0053@example.test | OWNER | Own pets only |
| owner0054@example.test | OWNER | Own pets only |
| owner0055@example.test | OWNER | Own pets only |
| owner0056@example.test | OWNER | Own pets only |
| owner0057@example.test | OWNER | Own pets only |
| owner0058@example.test | OWNER | Own pets only |
| owner0059@example.test | OWNER | Own pets only |
| owner0060@example.test | OWNER | Own pets only |
| owner0061@example.test | OWNER | Own pets only |
| owner0062@example.test | OWNER | Own pets only |
| owner0063@example.test | OWNER | Own pets only |
| owner0064@example.test | OWNER | Own pets only |
| owner0065@example.test | OWNER | Own pets only |
| owner0066@example.test | OWNER | Own pets only |
| owner0067@example.test | OWNER | Own pets only |
| owner0068@example.test | OWNER | Own pets only |
| owner0069@example.test | OWNER | Own pets only |
| owner0070@example.test | OWNER | Own pets only |
| owner0071@example.test | OWNER | Own pets only |
| owner0072@example.test | OWNER | Own pets only |
| owner0073@example.test | OWNER | Own pets only |
| owner0074@example.test | OWNER | Own pets only |
| owner0075@example.test | OWNER | Own pets only |
| owner0076@example.test | OWNER | Own pets only |
| owner0077@example.test | OWNER | Own pets only |
| owner0078@example.test | OWNER | Own pets only |
| owner0079@example.test | OWNER | Own pets only |
| owner0080@example.test | OWNER | Own pets only |
| owner0081@example.test | OWNER | Own pets only |
| owner0082@example.test | OWNER | Own pets only |
| owner0083@example.test | OWNER | Own pets only |
| owner0084@example.test | OWNER | Own pets only |
| owner0085@example.test | OWNER | Own pets only |
| owner0086@example.test | OWNER | Own pets only |
| owner0087@example.test | OWNER | Own pets only |
| owner0088@example.test | OWNER | Own pets only |
| owner0089@example.test | OWNER | Own pets only |
| owner0090@example.test | OWNER | Own pets only |
| owner0091@example.test | OWNER | Own pets only |
| owner0092@example.test | OWNER | Own pets only |
| owner0093@example.test | OWNER | Own pets only |
| owner0094@example.test | OWNER | Own pets only |
| owner0095@example.test | OWNER | Own pets only |
| owner0096@example.test | OWNER | Own pets only |
| owner0097@example.test | OWNER | Own pets only |
| owner0098@example.test | OWNER | Own pets only |
| owner0099@example.test | OWNER | Own pets only |
| owner0100@example.test | OWNER | Own pets only |
| owner0101@example.test | OWNER | Own pets only |
| owner0102@example.test | OWNER | Own pets only |
| owner0103@example.test | OWNER | Own pets only |
| owner0104@example.test | OWNER | Own pets only |
| owner0105@example.test | OWNER | Own pets only |
| owner0106@example.test | OWNER | Own pets only |
| owner0107@example.test | OWNER | Own pets only |
| owner0108@example.test | OWNER | Own pets only |
| owner0109@example.test | OWNER | Own pets only |
| owner0110@example.test | OWNER | Own pets only |
| owner0111@example.test | OWNER | Own pets only |
| owner0112@example.test | OWNER | Own pets only |
| owner0113@example.test | OWNER | Own pets only |
| owner0114@example.test | OWNER | Own pets only |
| owner0115@example.test | OWNER | Own pets only |
| owner0116@example.test | OWNER | Own pets only |
| owner0117@example.test | OWNER | Own pets only |
| owner0118@example.test | OWNER | Own pets only |
| owner0119@example.test | OWNER | Own pets only |
| owner0120@example.test | OWNER | Own pets only |
| owner0121@example.test | OWNER | Own pets only |
| owner0122@example.test | OWNER | Own pets only |
| owner0123@example.test | OWNER | Own pets only |
| owner0124@example.test | OWNER | Own pets only |
| owner0125@example.test | OWNER | Own pets only |
| owner0126@example.test | OWNER | Own pets only |
| owner0127@example.test | OWNER | Own pets only |
| owner0128@example.test | OWNER | Own pets only |
| owner0129@example.test | OWNER | Own pets only |
| owner0130@example.test | OWNER | Own pets only |
| owner0131@example.test | OWNER | Own pets only |
| owner0132@example.test | OWNER | Own pets only |
| owner0133@example.test | OWNER | Own pets only |
| owner0134@example.test | OWNER | Own pets only |
| owner0135@example.test | OWNER | Own pets only |
| owner0136@example.test | OWNER | Own pets only |
| owner0137@example.test | OWNER | Own pets only |
| owner0138@example.test | OWNER | Own pets only |
| owner0139@example.test | OWNER | Own pets only |
| owner0140@example.test | OWNER | Own pets only |
| owner0141@example.test | OWNER | Own pets only |
| owner0142@example.test | OWNER | Own pets only |
| owner0143@example.test | OWNER | Own pets only |
| owner0144@example.test | OWNER | Own pets only |
| owner0145@example.test | OWNER | Own pets only |
| owner0146@example.test | OWNER | Own pets only |
| owner0147@example.test | OWNER | Own pets only |
| owner0148@example.test | OWNER | Own pets only |
| owner0149@example.test | OWNER | Own pets only |
| owner0150@example.test | OWNER | Own pets only |
| owner0151@example.test | OWNER | Own pets only |
| owner0152@example.test | OWNER | Own pets only |
| owner0153@example.test | OWNER | Own pets only |
| owner0154@example.test | OWNER | Own pets only |
| owner0155@example.test | OWNER | Own pets only |
| owner0156@example.test | OWNER | Own pets only |
| owner0157@example.test | OWNER | Own pets only |
| owner0158@example.test | OWNER | Own pets only |
| owner0159@example.test | OWNER | Own pets only |
| owner0160@example.test | OWNER | Own pets only |
| owner0161@example.test | OWNER | Own pets only |
| owner0162@example.test | OWNER | Own pets only |
| owner0163@example.test | OWNER | Own pets only |
| owner0164@example.test | OWNER | Own pets only |
| owner0165@example.test | OWNER | Own pets only |
| owner0166@example.test | OWNER | Own pets only |
| owner0167@example.test | OWNER | Own pets only |
| owner0168@example.test | OWNER | Own pets only |
| owner0169@example.test | OWNER | Own pets only |
| owner0170@example.test | OWNER | Own pets only |
| owner0171@example.test | OWNER | Own pets only |
| owner0172@example.test | OWNER | Own pets only |
| owner0173@example.test | OWNER | Own pets only |
| owner0174@example.test | OWNER | Own pets only |
| owner0175@example.test | OWNER | Own pets only |
| owner0176@example.test | OWNER | Own pets only |
| owner0177@example.test | OWNER | Own pets only |
| owner0178@example.test | OWNER | Own pets only |
| owner0179@example.test | OWNER | Own pets only |
| owner0180@example.test | OWNER | Own pets only |
| owner0181@example.test | OWNER | Own pets only |
| owner0182@example.test | OWNER | Own pets only |
| owner0183@example.test | OWNER | Own pets only |
| owner0184@example.test | OWNER | Own pets only |
| owner0185@example.test | OWNER | Own pets only |
| owner0186@example.test | OWNER | Own pets only |
| owner0187@example.test | OWNER | Own pets only |
| owner0188@example.test | OWNER | Own pets only |
| owner0189@example.test | OWNER | Own pets only |
| owner0190@example.test | OWNER | Own pets only |
| owner0191@example.test | OWNER | Own pets only |
| owner0192@example.test | OWNER | Own pets only |
| owner0193@example.test | OWNER | Own pets only |
| owner0194@example.test | OWNER | Own pets only |
| owner0195@example.test | OWNER | Own pets only |
| owner0196@example.test | OWNER | Own pets only |
| owner0197@example.test | OWNER | Own pets only |
| owner0198@example.test | OWNER | Own pets only |
| owner0199@example.test | OWNER | Own pets only |
| owner0200@example.test | OWNER | Own pets only |
| owner0201@example.test | OWNER | Own pets only |
| owner0202@example.test | OWNER | Own pets only |
| owner0203@example.test | OWNER | Own pets only |
| owner0204@example.test | OWNER | Own pets only |
| owner0205@example.test | OWNER | Own pets only |
| owner0206@example.test | OWNER | Own pets only |
| owner0207@example.test | OWNER | Own pets only |
| owner0208@example.test | OWNER | Own pets only |
| owner0209@example.test | OWNER | Own pets only |
| owner0210@example.test | OWNER | Own pets only |
| owner0211@example.test | OWNER | Own pets only |
| owner0212@example.test | OWNER | Own pets only |
| owner0213@example.test | OWNER | Own pets only |
| owner0214@example.test | OWNER | Own pets only |
| owner0215@example.test | OWNER | Own pets only |
| owner0216@example.test | OWNER | Own pets only |
| owner0217@example.test | OWNER | Own pets only |
| owner0218@example.test | OWNER | Own pets only |
| owner0219@example.test | OWNER | Own pets only |
| owner0220@example.test | OWNER | Own pets only |
| owner0221@example.test | OWNER | Own pets only |
| owner0222@example.test | OWNER | Own pets only |
| owner0223@example.test | OWNER | Own pets only |
| owner0224@example.test | OWNER | Own pets only |
| owner0225@example.test | OWNER | Own pets only |
| owner0226@example.test | OWNER | Own pets only |
| owner0227@example.test | OWNER | Own pets only |
| owner0228@example.test | OWNER | Own pets only |
| owner0229@example.test | OWNER | Own pets only |
| owner0230@example.test | OWNER | Own pets only |
| owner0231@example.test | OWNER | Own pets only |
| owner0232@example.test | OWNER | Own pets only |
| owner0233@example.test | OWNER | Own pets only |
| owner0234@example.test | OWNER | Own pets only |
| owner0235@example.test | OWNER | Own pets only |
| owner0236@example.test | OWNER | Own pets only |
| owner0237@example.test | OWNER | Own pets only |
| owner0238@example.test | OWNER | Own pets only |
| owner0239@example.test | OWNER | Own pets only |
| owner0240@example.test | OWNER | Own pets only |
| owner0241@example.test | OWNER | Own pets only |
| owner0242@example.test | OWNER | Own pets only |
| owner0243@example.test | OWNER | Own pets only |
| owner0244@example.test | OWNER | Own pets only |
| owner0245@example.test | OWNER | Own pets only |
| owner0246@example.test | OWNER | Own pets only |
| owner0247@example.test | OWNER | Own pets only |
| owner0248@example.test | OWNER | Own pets only |
| owner0249@example.test | OWNER | Own pets only |
| owner0250@example.test | OWNER | Own pets only |
| owner0251@example.test | OWNER | Own pets only |
| owner0252@example.test | OWNER | Own pets only |
| owner0253@example.test | OWNER | Own pets only |
| owner0254@example.test | OWNER | Own pets only |
| owner0255@example.test | OWNER | Own pets only |
| owner0256@example.test | OWNER | Own pets only |
| owner0257@example.test | OWNER | Own pets only |
| owner0258@example.test | OWNER | Own pets only |
| owner0259@example.test | OWNER | Own pets only |
| owner0260@example.test | OWNER | Own pets only |
| owner0261@example.test | OWNER | Own pets only |
| owner0262@example.test | OWNER | Own pets only |
| owner0263@example.test | OWNER | Own pets only |
| owner0264@example.test | OWNER | Own pets only |
| owner0265@example.test | OWNER | Own pets only |
| owner0266@example.test | OWNER | Own pets only |
| owner0267@example.test | OWNER | Own pets only |
| owner0268@example.test | OWNER | Own pets only |
| owner0269@example.test | OWNER | Own pets only |
| owner0270@example.test | OWNER | Own pets only |
| owner0271@example.test | OWNER | Own pets only |
| owner0272@example.test | OWNER | Own pets only |
| owner0273@example.test | OWNER | Own pets only |
| owner0274@example.test | OWNER | Own pets only |
| owner0275@example.test | OWNER | Own pets only |
| owner0276@example.test | OWNER | Own pets only |
| owner0277@example.test | OWNER | Own pets only |
| owner0278@example.test | OWNER | Own pets only |
| owner0279@example.test | OWNER | Own pets only |
| owner0280@example.test | OWNER | Own pets only |
| owner0281@example.test | OWNER | Own pets only |
| owner0282@example.test | OWNER | Own pets only |
| owner0283@example.test | OWNER | Own pets only |
| owner0284@example.test | OWNER | Own pets only |
| owner0285@example.test | OWNER | Own pets only |
| owner0286@example.test | OWNER | Own pets only |
| owner0287@example.test | OWNER | Own pets only |
| owner0288@example.test | OWNER | Own pets only |
| owner0289@example.test | OWNER | Own pets only |
| owner0290@example.test | OWNER | Own pets only |
| owner0291@example.test | OWNER | Own pets only |
| owner0292@example.test | OWNER | Own pets only |
| owner0293@example.test | OWNER | Own pets only |
| owner0294@example.test | OWNER | Own pets only |
| owner0295@example.test | OWNER | Own pets only |
| owner0296@example.test | OWNER | Own pets only |
| owner0297@example.test | OWNER | Own pets only |
| owner0298@example.test | OWNER | Own pets only |
| owner0299@example.test | OWNER | Own pets only |
| owner0300@example.test | OWNER | Own pets only |
| owner0301@example.test | OWNER | Own pets only |
| owner0302@example.test | OWNER | Own pets only |
| owner0303@example.test | OWNER | Own pets only |
| owner0304@example.test | OWNER | Own pets only |
| owner0305@example.test | OWNER | Own pets only |
| owner0306@example.test | OWNER | Own pets only |
| owner0307@example.test | OWNER | Own pets only |
| owner0308@example.test | OWNER | Own pets only |
| owner0309@example.test | OWNER | Own pets only |
| owner0310@example.test | OWNER | Own pets only |
| owner0311@example.test | OWNER | Own pets only |
| owner0312@example.test | OWNER | Own pets only |
| owner0313@example.test | OWNER | Own pets only |
| owner0314@example.test | OWNER | Own pets only |
| owner0315@example.test | OWNER | Own pets only |
| owner0316@example.test | OWNER | Own pets only |
| owner0317@example.test | OWNER | Own pets only |
| owner0318@example.test | OWNER | Own pets only |
| owner0319@example.test | OWNER | Own pets only |
| owner0320@example.test | OWNER | Own pets only |

import { expect, test } from '@playwright/test';
import { SignJWT } from 'jose';

const clinicId = '68395a8b-5e57-4d46-85aa-73760300a20b';
const locationId = 'e6a256a8-e467-4de3-a411-85c16a105df6';
const holdId = process.env.W7D_HOLD_ID ?? 'edddb377-80e9-448e-94ac-b9d0269bdb4b';
const portalOrigin = 'http://127.0.0.1:3001';
const ownerOrigin = 'http://127.0.0.1:8081';
const resultText = 'По итогам осмотра состояние стабильное. Продолжить домашнее наблюдение.';
const amendmentText = 'Уточнение: контрольный осмотр рекомендован через семь дней.';

test('W7-D-R3 real Visit to published Owner Diary and Amendment journey', async ({ page, context }) => {
  const admin = await token('CLINIC_ADMIN');
  await context.addCookies([{ name: 'vethelp_clinic_session', value: admin, url: portalOrigin, httpOnly: true, sameSite: 'Lax' }]);
  await page.goto(`${portalOrigin}/clinics/${clinicId}/locations/${locationId}/queue`);
  await expect(page.getByRole('link', { name: 'Открыть очередь записей' })).toBeVisible();

  await context.clearCookies();
  const vet = await token('CLINIC_VETERINARIAN');
  await context.addCookies([{ name: 'vethelp_clinic_session', value: vet, url: portalOrigin, httpOnly: true, sameSite: 'Lax' }]);
  await page.goto(`${portalOrigin}/clinics/${clinicId}/locations/${locationId}/vet/visits/${holdId}`);
  await expect(page.getByRole('heading', { name: 'W7D Рекс' })).toBeVisible();
  await expect(page.getByText('DOG')).toBeVisible();
  const completion = page.getByRole('form', { name: 'Завершение приёма' });
  if (await completion.isVisible()) {
    await page.getByLabel('Клиническое заключение').fill('Осмотр завершён: состояние стабильное, наблюдать аппетит и активность.');
    await page.getByRole('button', { name: 'Завершить приём' }).click();
    await expect(page.getByRole('button', { name: 'Оформить результат' })).toBeVisible();
    await page.getByRole('button', { name: 'Оформить результат' }).click();
    await page.getByLabel('Текст результата').fill(resultText);
    await page.getByRole('button', { name: 'Сохранить черновик' }).click();
  }
  await expect(page.getByText('Черновик', { exact: true })).toBeVisible();
  await expect(page.getByText('Не виден владельцу питомца')).toBeVisible();

  const owner = await context.newPage();
  await owner.goto(ownerOrigin);
  await owner.getByRole('button', { name: 'Войти', exact: true }).click();
  await owner.getByLabel('Номер телефона').fill('+79991234567');
  await owner.getByRole('button', { name: 'Получить код' }).click();
  await owner.getByLabel('Код из сообщения').fill('246810');
  await owner.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(owner.getByRole('button', { name: 'Открыть дневник' })).toBeVisible();
  await openDiary(owner);
  await expect(owner.getByText(resultText)).toHaveCount(0);

  await page.getByRole('button', { name: 'Опубликовать результат' }).click();
  const dialog = page.getByRole('dialog', { name: 'Опубликовать результат?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await expect(page.getByText('Исходный результат')).toBeVisible();
  await expect(page.getByText(resultText)).toBeVisible();

  await owner.reload();
  await openDiary(owner);
  await expect(owner.getByText(resultText)).toBeVisible();
  await owner.getByRole('button', { name: /Открыть результат приёма/ }).click();
  await expect(owner.getByRole('heading', { name: 'Результат приёма' })).toBeVisible();
  await expect(owner.getByText(resultText)).toBeVisible();

  await page.getByRole('button', { name: 'Добавить уточнение' }).click();
  await page.getByLabel('Текст уточнения').fill(amendmentText);
  await page.getByRole('form', { name: 'Добавление уточнения' }).getByRole('button', { name: 'Добавить уточнение' }).click();
  await expect(page.getByText(amendmentText)).toBeVisible();
  await page.reload();
  await expect(page.getByText(resultText)).toBeVisible();
  await expect(page.getByText(amendmentText)).toBeVisible();

  await owner.reload();
  await openDiary(owner);
  await expect(owner.getByText('Уточнений: 1')).toBeVisible();
  await owner.getByRole('button', { name: /Открыть результат приёма/ }).click();
  await expect(owner.getByText(resultText)).toBeVisible();
  await expect(owner.getByText(amendmentText)).toBeVisible();
});

async function openDiary(page: import('@playwright/test').Page) {
  const open = page.getByRole('button', { name: 'Открыть дневник' });
  if (await open.isVisible()) await open.click();
  const selection = page.getByRole('heading', { name: 'Выберите питомца' });
  if (await selection.isVisible()) await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByRole('heading', { name: 'Дневник: W7D Рекс' })).toBeVisible();
}

async function token(role: 'CLINIC_ADMIN' | 'CLINIC_VETERINARIAN') {
  return new SignJWT({ roles: [role], clinicIds: [clinicId], locationIds: [locationId] })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('a6000000-0000-4000-8000-000000000001')
    .setIssuer('vethelp-local')
    .setAudience('vethelp-api')
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(new TextEncoder().encode('local-development-jwt-signing-key-not-for-shared-use'));
}

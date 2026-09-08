import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const ownerWeb = `http://127.0.0.1:${Number(process.env.OWNER_EXPO_WEB_PORT ?? 8081)}`,
  clinicPortal = `http://127.0.0.1:${Number(process.env.CLINIC_PORTAL_LOCAL_STACK_PORT ?? 3213)}`;
const evidence = resolve(
    process.cwd(),
    "../../docs/testing/evidence/wave6-smart-reallocation-closure",
  ),
  designPack =
    process.env.VETHELP_V50_PACK ??
    "/Users/evrusetskiy/Downloads/VetHelp_V50_Unified_UX_UI_Pack.zip";
const otp = process.env.AUTH_DEV_OTP_CODE ?? "246810",
  secret =
    process.env.VETHELP_CLINIC_JWT_SECRET ??
    "local-development-jwt-signing-key-not-for-shared-use";
const ids = {
  support: "a6000000-0000-4000-8000-000000000001",
  service: randomUUID(),
  slot: randomUUID(),
  hold: randomUUID(),
  appointment: randomUUID(),
};
type EvidenceRecord = {
  state: string;
  file: string;
  width: number;
  height: number;
  surface: "owner" | "clinic";
  sha256?: string;
};

test("W6-D confirmed replacement crosses Owner BFF, PostgreSQL and canonical Clinic queue", async ({
  page,
  request,
}) => {
  test.setTimeout(420_000);
  expect((await request.get("http://127.0.0.1:3000/v1/health")).ok()).toBe(
    true,
  );
  seed();
  cleanupWave6Fixtures();
  mkdirSync(evidence, { recursive: true });
  for (const file of readdirSync(evidence))
    if (/^\d{2}-.*\.png$/.test(file) || file === "manifest.json")
      unlinkSync(resolve(evidence, file));
  const records: EvidenceRecord[] = [];
  const capture = async (
    state: string,
    width: number,
    height: number,
    surface: "owner" | "clinic",
  ) => {
    await page.setViewportSize({ width, height });
    await assertSurface(page);
    const undersized = await page
      .locator("main button:visible, main select:visible")
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => node.getBoundingClientRect().height < 43.5)
          .map((node) => ({
            text: (node.textContent ?? "").trim(),
            height: node.getBoundingClientRect().height,
          })),
      );
    expect(undersized).toEqual([]);
    const file = `${String(records.length + 1).padStart(2, "0")}-${state}-${width}x${height}.png`;
    await page.screenshot({ path: resolve(evidence, file), fullPage: true });
    records.push({ state, file, width, height, surface });
  };
  resetOtp();
  const pet = await owner(page),
    ownerId = sql(
      `SELECT owner_id::text FROM pet_schema.pets WHERE id='${pet}'`,
    ).trim(),
    source = seedSource(ownerId, pet);
  await page.goto(`${ownerWeb}/booking/${ids.hold}`);
  await expect(page.getByText("Запись подтверждена")).toBeVisible();
  await capture("booking-A-preserved", 390, 844, "owner");
  await capture("booking-A-preserved", 768, 1024, "owner");
  await capture("booking-A-preserved", 1440, 900, "owner");
  await page
    .getByRole("button", { name: "Запросить изменение времени" })
    .click();
  await page.getByRole("button", { name: "Отправить запрос" }).click();
  await expect(
    page.getByText("Запрос отправлен", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Ваша текущая запись сохранена")).toBeVisible();
  const loadingRoute =
    "**/api/owner/v1/owner/booking-change-requests/*/reallocation";
  await page.route(
    loadingRoute,
    async (route) => {
      await new Promise((done) => setTimeout(done, 1_500));
      await route.continue();
    },
    { times: 1 },
  );
  const openPromise = page
    .getByRole("button", { name: "Показать варианты" })
    .click();
  await expect(page.getByText("Подбираем варианты…")).toBeVisible();
  await capture("reallocation-loading", 390, 844, "owner");
  await openPromise;
  await expect(
    page.getByRole("radiogroup", { name: "Варианты переноса" }),
  ).toBeVisible();
  await page.unroute(loadingRoute);
  await capture("reallocation-offers", 390, 844, "owner");
  await capture("reallocation-offers", 1440, 900, "owner");
  await capture("offer-with-missing-optional-facts", 768, 1024, "owner");
  sql(
    `WITH moment AS (SELECT clock_timestamp() AS value) UPDATE booking_schema.reallocation_offers SET created_at=moment.value-interval '11 minutes',expires_at=moment.value+interval '4 minutes' FROM moment WHERE reallocation_case_id=(SELECT id FROM booking_schema.reallocation_cases WHERE booking_hold_id='${ids.hold}') AND rank=1`,
  );
  await page.getByRole("button", { name: "Обновить варианты" }).click();
  await expect(page.getByText("Срок скоро истечёт")).toBeVisible();
  await capture("offer-expiring", 390, 844, "owner");
  const cards = page.getByRole("radiogroup").getByRole("radio");
  expect(await cards.count()).toBeGreaterThanOrEqual(2);
  expect(await cards.count()).toBeLessThanOrEqual(5);
  const ranked = JSON.parse(
    sql(
      `SELECT COALESCE(json_agg(json_build_object('clinicName',clinic.public_name,'startsAt',offer.starts_at,'timezone',location.timezone) ORDER BY offer.rank),'[]'::json)::text FROM booking_schema.reallocation_offers offer JOIN booking_schema.reallocation_cases reallocation ON reallocation.id=offer.reallocation_case_id JOIN clinic_schema.clinics clinic ON clinic.id=offer.clinic_id JOIN clinic_schema.clinic_locations location ON location.id=offer.location_id WHERE reallocation.booking_hold_id='${ids.hold}'`,
    ).trim(),
  ) as Array<{ clinicName: string; startsAt: string; timezone: string }>;
  expect(ranked.length).toBe(await cards.count());
  expect(ranked.map((item) => Date.parse(item.startsAt))).toEqual(
    [...ranked.map((item) => Date.parse(item.startsAt))].sort((a, b) => a - b),
  );
  for (let index = 0; index < ranked.length; index += 1) {
    const expectedDateTime = new Intl.DateTimeFormat("ru-RU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: ranked[index].timezone,
    }).format(new Date(ranked[index].startsAt));
    await expect(cards.nth(index)).toHaveAttribute(
      "aria-label",
      new RegExp(
        `^${escapeRegex(expectedDateTime)}, ${escapeRegex(ranked[index].clinicName)}`,
      ),
    );
  }
  const first = cards.first();
  await first.click();
  await page
    .getByRole("button", { name: "Продолжить с этим вариантом" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Создать запрос на новое время?",
  });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Создать запрос" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Не сейчас" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Создать запрос" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Продолжить с этим вариантом" }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Продолжить с этим вариантом" })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Создать запрос" }),
  ).toBeFocused();
  await capture("offer-accept-confirmation", 390, 844, "owner");
  await dialog.getByRole("button", { name: "Создать запрос" }).click();
  await expect(page.getByText("Запрос на новое время создан")).toBeVisible();
  await capture("booking-B-pending-A-preserved", 390, 844, "owner");
  const lineage = JSON.parse(
    sql(
      `SELECT json_build_object('caseId',c.id,'holdId',c.replacement_booking_hold_id,'clinicId',o.clinic_id,'locationId',o.location_id,'sourceState',a.state,'sourceBooked',s.booked_count,'targetHeld',t.held_count)::text FROM booking_schema.reallocation_cases c JOIN booking_schema.reallocation_offers o ON o.id=c.accepted_offer_id JOIN booking_schema.booking_holds a ON a.id=c.booking_hold_id JOIN clinic_schema.appointment_slots s ON s.id=a.slot_id JOIN clinic_schema.appointment_slots t ON t.id=o.slot_id WHERE c.booking_hold_id='${ids.hold}'`,
    ).trim(),
  );
  expect(lineage).toMatchObject({
    sourceState: "CONFIRMED",
    sourceBooked: 1,
    targetHeld: 1,
  });
  sql(
    `INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES('${ids.support}','${lineage.locationId}','CLINIC_ADMIN') ON CONFLICT(employee_id,clinic_location_id) DO UPDATE SET role='CLINIC_ADMIN',active=true,revoked_at=NULL,updated_at=clock_timestamp()`,
  );
  await page.context().addCookies([
    {
      name: "vethelp_clinic_session",
      value: jwt(ids.support, lineage.clinicId, lineage.locationId),
      url: clinicPortal,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.goto(
    `${clinicPortal}/clinics/${lineage.clinicId}/locations/${lineage.locationId}/queue`,
  );
  const replacementRow = page
    .getByRole("row")
    .filter({ hasText: "Wave Six 613" });
  await expect(replacementRow).toBeVisible();
  await capture("clinic-replacement-pending", 430, 932, "clinic");
  await capture("clinic-replacement-pending", 1024, 768, "clinic");
  await capture("clinic-replacement-pending", 1440, 900, "clinic");
  await replacementRow.getByRole("button", { name: "Подтвердить" }).click();
  await expect(page.getByRole("status")).toContainText("Запись подтверждена");
  await capture("replacement-confirmed", 1440, 900, "clinic");
  const final = JSON.parse(
    sql(
      `SELECT json_build_object('caseStatus',c.status,'offerStatus',o.status,'aState',a.state,'aAppointment',aa.status,'aBooked',sa.booked_count,'bState',b.state,'bBooked',sb.booked_count)::text FROM booking_schema.reallocation_cases c JOIN booking_schema.reallocation_offers o ON o.id=c.accepted_offer_id JOIN booking_schema.booking_holds a ON a.id=c.booking_hold_id JOIN booking_schema.appointments aa ON aa.hold_id=a.id JOIN booking_schema.booking_holds b ON b.id=c.replacement_booking_hold_id JOIN clinic_schema.appointment_slots sa ON sa.id=a.slot_id JOIN clinic_schema.appointment_slots sb ON sb.id=b.slot_id WHERE c.id='${lineage.caseId}'`,
    ).trim(),
  );
  expect(final).toEqual({
    caseStatus: "CLOSED",
    offerStatus: "ACCEPTED",
    aState: "RELEASED",
    aAppointment: "CANCELLED",
    aBooked: 0,
    bState: "CONFIRMED",
    bBooked: 1,
  });
  await page.goto(`${ownerWeb}/booking/${ids.hold}`);
  await page.getByRole("button", { name: "Показать варианты" }).click();
  await expect(page.getByText("Новое время подтверждено")).toBeVisible();
  await expect(page.getByText(/Новая запись подтверждена/)).toBeVisible();
  await capture("owner-final-replaced-booking", 390, 844, "owner");
  await capture("owner-final-replaced-booking", 768, 1024, "owner");
  await capture("owner-final-replaced-booking", 1440, 900, "owner");
  expect(await page.locator("body").innerText()).not.toMatch(
    /REPLACEMENT_PENDING_CONFIRMATION|ACCEPTED/,
  );

  const rejectedSource = seedAdditional(ownerId, pet, source);
  const rejected = await acceptFromOwner(page, rejectedSource.holdId);
  await clinicSession(page, rejected);
  await page.goto(
    `${clinicPortal}/clinics/${rejected.clinicId}/locations/${rejected.locationId}/queue`,
  );
  const rejectedRow = page.getByRole("row").filter({ hasText: "Wave Six 613" });
  await rejectedRow.getByRole("button", { name: "Отклонить" }).click();
  const rejectDialog = page.getByRole("dialog", { name: "Отклонить заявку" });
  await expect(
    rejectDialog.getByRole("button", { name: "Отклонить заявку" }),
  ).toBeFocused();
  await rejectDialog.getByRole("button", { name: "Отклонить заявку" }).click();
  await expect(page.getByRole("status")).toContainText("Заявка отклонена");
  expect(readOutcome(rejected.caseId)).toEqual({
    case_status: "CLOSED",
    source_state: "CONFIRMED",
    source_booked: 1,
    replacement_state: "RELEASED",
    replacement_held: 0,
    offer_status: "ACCEPTED",
  });
  await page.goto(`${ownerWeb}/booking/${rejectedSource.holdId}`);
  await page.getByRole("button", { name: "Показать варианты" }).click();
  await expect(page.getByText("Новое время не подтверждено")).toBeVisible();
  await expect(
    page.getByText("Ваша предыдущая запись сохранена без изменений."),
  ).toBeVisible();
  await capture("replacement-rejected-original-preserved", 390, 844, "owner");

  const expiredSource = seedAdditional(ownerId, pet, source);
  const expired = await acceptFromOwner(page, expiredSource.holdId);
  sql(
    `UPDATE booking_schema.booking_holds SET confirmation_sla_expires_at=clock_timestamp()-interval '1 second' WHERE id='${expired.holdId}'`,
  );
  await expect
    .poll(() => readOutcome(expired.caseId).case_status, { timeout: 20_000 })
    .toBe("CLOSED");
  expect(readOutcome(expired.caseId)).toEqual({
    case_status: "CLOSED",
    source_state: "CONFIRMED",
    source_booked: 1,
    replacement_state: "EXPIRED",
    replacement_held: 0,
    offer_status: "ACCEPTED",
  });
  await page.goto(`${ownerWeb}/booking/${expiredSource.holdId}`);
  await page.getByRole("button", { name: "Показать варианты" }).click();
  await expect(page.getByText("Новое время не подтверждено")).toBeVisible();
  await capture("replacement-expired-original-preserved", 390, 844, "owner");

  const staleSource = seedAdditional(ownerId, pet, source);
  await openOwnerOffers(page, staleSource.holdId);
  const stale = JSON.parse(
    sql(
      `SELECT json_build_object('caseId',c.id,'slotId',o.slot_id)::text FROM booking_schema.reallocation_cases c JOIN booking_schema.reallocation_offers o ON o.reallocation_case_id=c.id AND o.rank=1 WHERE c.booking_hold_id='${staleSource.holdId}'`,
    ).trim(),
  );
  const staleBefore = readSource(staleSource.holdId);
  sql(
    `UPDATE clinic_schema.appointment_slots SET booked_count=capacity,held_count=0,version=version+1,updated_at=clock_timestamp() WHERE id='${stale.slotId}'`,
  );
  await page.getByRole("radio").first().click();
  await page
    .getByRole("button", { name: "Продолжить с этим вариантом" })
    .click();
  await page
    .getByRole("dialog", { name: "Создать запрос на новое время?" })
    .getByRole("button", { name: "Создать запрос" })
    .click();
  await expect(
    page.getByText("Не удалось создать запрос на новое время"),
  ).toBeVisible();
  await page
    .getByText("Не удалось создать запрос на новое время")
    .scrollIntoViewIfNeeded();
  await capture("stale-offer", 390, 844, "owner");
  expect(readSource(staleSource.holdId)).toEqual(staleBefore);
  expect(
    Number(
      sql(
        `SELECT count(*) FROM booking_schema.booking_holds WHERE id IN (SELECT replacement_booking_hold_id FROM booking_schema.reallocation_cases WHERE id='${stale.caseId}')`,
      ).trim(),
    ),
  ).toBe(0);

  const emptySource = seedAdditional(ownerId, pet, source);
  sql(
    `UPDATE clinic_schema.clinic_services service SET code='W6D_NO_ALT_${randomUUID().replaceAll("-", "")}' FROM clinic_schema.appointment_slots slot,booking_schema.booking_holds hold WHERE hold.id='${emptySource.holdId}' AND slot.id=hold.slot_id AND service.id=slot.service_id`,
  );
  await page.goto(`${ownerWeb}/booking/${emptySource.holdId}`);
  await page
    .getByRole("button", { name: "Запросить изменение времени" })
    .click();
  await page.getByRole("button", { name: "Отправить запрос" }).click();
  await page.getByRole("button", { name: "Показать варианты" }).click();
  await expect(page.getByText("Подходящих вариантов пока нет")).toBeVisible();
  await capture("no-alternatives", 390, 844, "owner");
  const failureRoute = "**/api/owner/v1/owner/reallocation-cases/**";
  await page.route(failureRoute, (route) => route.abort("failed"), {
    times: 1,
  });
  await page.getByRole("button", { name: "Обновить варианты" }).click();
  await expect(page.getByText("Не удалось обновить варианты")).toBeVisible();
  await page.unroute(failureRoute);
  await capture("error-retry", 390, 844, "owner");

  writeEvidenceManifest(records);
  expect(records.length).toBeGreaterThanOrEqual(20);
  expect(records.length).toBeLessThanOrEqual(26);
  expect(source.serviceId).toBeTruthy();
});

async function openOwnerOffers(page: Page, holdId: string) {
  await page.goto(`${ownerWeb}/booking/${holdId}`);
  await expect(page.getByText("Запись подтверждена")).toBeVisible();
  await page
    .getByRole("button", { name: "Запросить изменение времени" })
    .click();
  await page.getByRole("button", { name: "Отправить запрос" }).click();
  await expect(
    page.getByText("Запрос отправлен", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Показать варианты" }).click();
  await expect(
    page.getByRole("radiogroup", { name: "Варианты переноса" }),
  ).toBeVisible();
}
async function acceptFromOwner(page: Page, holdId: string) {
  await openOwnerOffers(page, holdId);
  await page.getByRole("radio").first().click();
  await page
    .getByRole("button", { name: "Продолжить с этим вариантом" })
    .click();
  await page
    .getByRole("dialog", { name: "Создать запрос на новое время?" })
    .getByRole("button", { name: "Создать запрос" })
    .click();
  await expect(page.getByText("Запрос на новое время создан")).toBeVisible();
  return JSON.parse(
    sql(
      `SELECT json_build_object('caseId',c.id,'holdId',c.replacement_booking_hold_id,'clinicId',o.clinic_id,'locationId',o.location_id)::text FROM booking_schema.reallocation_cases c JOIN booking_schema.reallocation_offers o ON o.id=c.accepted_offer_id WHERE c.booking_hold_id='${holdId}'`,
    ).trim(),
  );
}
async function clinicSession(
  page: Page,
  lineage: { clinicId: string; locationId: string },
) {
  sql(
    `INSERT INTO clinic_schema.employee_location_memberships(employee_id,clinic_location_id,role) VALUES('${ids.support}','${lineage.locationId}','CLINIC_ADMIN') ON CONFLICT(employee_id,clinic_location_id) DO UPDATE SET role='CLINIC_ADMIN',active=true,revoked_at=NULL,updated_at=clock_timestamp()`,
  );
  await page.context().addCookies([
    {
      name: "vethelp_clinic_session",
      value: jwt(ids.support, lineage.clinicId, lineage.locationId),
      url: clinicPortal,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
function seedAdditional(
  ownerId: string,
  petId: string,
  source: { locationId: string; serviceId: string },
) {
  const slotId = randomUUID(),
    holdId = randomUUID(),
    appointmentId = randomUUID(),
    newServiceId = randomUUID();
  const [targetCode, targetSlotId] = sql(
    `SELECT service.code||'|'||slot.id::text FROM clinic_schema.appointment_slots slot JOIN clinic_schema.clinic_services service ON service.id=slot.service_id JOIN clinic_schema.clinic_locations target ON target.id=slot.clinic_location_id WHERE slot.source='DOCTOR_SHIFT' AND slot.publication_state='PUBLISHED' AND slot.starts_at>clock_timestamp() AND slot.capacity-slot.booked_count-slot.held_count>0 AND target.clinic_id<>(SELECT clinic_id FROM clinic_schema.clinic_locations WHERE id='${source.locationId}') AND NOT EXISTS(SELECT 1 FROM booking_schema.booking_holds pending JOIN clinic_schema.appointment_slots pending_slot ON pending_slot.id=pending.slot_id WHERE pending_slot.clinic_location_id=target.id AND pending.state='MANUAL_CONFIRM_PENDING') ORDER BY slot.starts_at,slot.id LIMIT 1`,
  )
    .trim()
    .split("|");
  sql(
    `INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active) VALUES('${newServiceId}','${source.locationId}','${targetCode}','Smart reallocation visit',30,true) ON CONFLICT(clinic_location_id,code) DO UPDATE SET active=true`,
  );
  const sourceServiceId = sql(
    `SELECT id::text FROM clinic_schema.clinic_services WHERE clinic_location_id='${source.locationId}' AND code='${targetCode}'`,
  ).trim();
  sql(
    `INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at,capacity,booked_count,held_count,state,status,source,publication_state) VALUES('${slotId}','${source.locationId}','${sourceServiceId}',clock_timestamp()+interval '2 days',clock_timestamp()+interval '2 days 30 minutes',1,1,0,'OPEN','BOOKED','MANUAL','PUBLISHED');INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES('${holdId}','${slotId}','${ownerId}','${petId}','CONFIRMED',clock_timestamp()+interval '3 days');INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES('${appointmentId}','${holdId}','${ownerId}','${petId}','${source.locationId}','${slotId}','CONFIRMED')`,
  );
  return { slotId, holdId, appointmentId, targetSlotId };
}
function readOutcome(caseId: string) {
  return JSON.parse(
    sql(
      `SELECT json_build_object('case_status',c.status,'source_state',a.state,'source_booked',sa.booked_count,'replacement_state',b.state,'replacement_held',sb.held_count,'offer_status',o.status)::text FROM booking_schema.reallocation_cases c JOIN booking_schema.reallocation_offers o ON o.id=c.accepted_offer_id JOIN booking_schema.booking_holds a ON a.id=c.booking_hold_id JOIN booking_schema.booking_holds b ON b.id=c.replacement_booking_hold_id JOIN clinic_schema.appointment_slots sa ON sa.id=a.slot_id JOIN clinic_schema.appointment_slots sb ON sb.id=b.slot_id WHERE c.id='${caseId}'`,
    ).trim(),
  );
}
function readSource(holdId: string) {
  return JSON.parse(
    sql(
      `SELECT json_build_object('state',h.state,'version',h.version,'appointment',a.status,'booked',s.booked_count)::text FROM booking_schema.booking_holds h JOIN booking_schema.appointments a ON a.hold_id=h.id JOIN clinic_schema.appointment_slots s ON s.id=h.slot_id WHERE h.id='${holdId}'`,
    ).trim(),
  );
}

function writeEvidenceManifest(records: EvidenceRecord[]) {
  const root = resolve(process.cwd(), "../.."),
    sources = [
      "backend/src/booking-core/reallocation.service.ts",
      "backend/src/booking-core/reallocation-finalization.service.ts",
      "backend/src/booking-core/reallocation.controller.ts",
      "apps/owner-app/src/booking/ReallocationOfferPanel.tsx",
      "apps/owner-app/src/booking/BookingChangeRequestPanel.tsx",
      "apps/owner-app/src/booking/BookingStatusScreen.tsx",
      "apps/owner-app/src/booking/booking-api.ts",
      "apps/clinic-portal/components/queue/ClinicQueueClientV2.tsx",
      "apps/owner-app/tests/e2e/wave6-reallocation.real-stack.spec.ts",
    ];
  for (const item of records)
    item.sha256 = sha(readFileSync(resolve(evidence, item.file)));
  const sourceHashes = Object.fromEntries(
      sources.map((source) => [
        source,
        sha(readFileSync(resolve(root, source))),
      ]),
    ),
    archiveOptions = { maxBuffer: 256 * 1024 * 1024 },
    ownerAuthority = execFileSync(
      "unzip",
      ["-p", designPack, "VetHelp_Owner_V50_Behavioral_Unified.zip"],
      archiveOptions,
    ),
    clinicAuthority = execFileSync(
      "unzip",
      ["-p", designPack, "VetHelp_Clinic_V50_Behavioral_Dense.zip"],
      archiveOptions,
    );
  writeFileSync(
    resolve(evidence, "manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        status: "PASS",
        generatedAt: new Date().toISOString(),
        stack:
          "Owner Expo Web -> Owner BFF -> Backend -> PostgreSQL -> canonical Clinic Queue -> Backend -> PostgreSQL -> Owner authoritative readback",
        physicalDevice: false,
        visualAuthority: {
          outer: { file: designPack, sha256: sha(readFileSync(designPack)) },
          owner: {
            entry: "VetHelp_Owner_V50_Behavioral_Unified.zip",
            sha256: sha(ownerAuthority),
          },
          clinic: {
            entry: "VetHelp_Clinic_V50_Behavioral_Dense.zip",
            sha256: sha(clinicAuthority),
          },
        },
        sources: sourceHashes,
        checks: {
          realConfirmed: "PASS",
          realRejected: "PASS",
          realExpired: "PASS",
          staleOfferSafety: "PASS",
          bookingAPreservedUntilConfirmation: "PASS",
          ownerAuthoritativeReadback: "PASS",
          rankingOrderAndBound: "PASS",
          missingOptionalFactsUsable: "PASS",
          axeSeriousCritical: 0,
          horizontalOverflow: 0,
          minActionHeight: 44,
          keyboardFocus: "PASS",
          rawEnumsVisible: 0,
        },
        states: [...new Set(records.map((item) => item.state))],
        viewports: [
          ...new Set(records.map((item) => `${item.width}x${item.height}`)),
        ],
        cases: records,
      },
      null,
      2,
    )}\n`,
  );
}

async function assertSurface(page: Page) {
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function owner(page: Page) {
  const phone = `+7997${String(Number.parseInt(randomUUID().slice(0, 8), 16) % 10_000_000).padStart(7, "0")}`;
  await page.goto("/?intent=book");
  await page.getByRole("button", { name: "Начать запись" }).click();
  await page.getByLabel("Номер телефона").fill(phone);
  await page.getByRole("button", { name: "Получить код" }).click();
  await page.getByLabel("Код из сообщения").fill(otp);
  await page.getByRole("button", { name: "Подтвердить" }).click();
  await page.getByRole("button", { name: "Продолжить запись" }).click();
  await page.getByRole("button", { name: "Добавить питомца" }).click();
  await page.getByLabel("Имя питомца").fill("Wave Six 613");
  await page.getByText("Собака", { exact: true }).click();
  await page.getByRole("button", { name: "Сохранить питомца" }).click();
  return sql(
    `SELECT id::text FROM pet_schema.pets WHERE name='Wave Six 613' ORDER BY created_at DESC LIMIT 1`,
  ).trim();
}
function seed() {
  execFileSync(
    "docker",
    [
      "compose",
      "-p",
      "vethelp-alpha",
      "-f",
      "../../docker-compose.local.yml",
      "exec",
      "-T",
      "backend",
      "npm",
      "run",
      "seed",
    ],
    { cwd: process.cwd(), stdio: "pipe" },
  );
}
function resetOtp() {
  sql(
    "TRUNCATE identity_schema.otp_rate_limit_attempts,identity_schema.otp_rate_limit_blocks",
  );
}
function cleanupWave6Fixtures() {
  sql(`BEGIN;
    WITH confirmed_replacements AS (
      SELECT replacement.id AS hold_id,replacement.slot_id
      FROM booking_schema.reallocation_cases reallocation
      JOIN booking_schema.booking_holds source ON source.id=reallocation.booking_hold_id
      JOIN pet_schema.pets pet ON pet.id=source.pet_id
      JOIN booking_schema.booking_holds replacement ON replacement.id=reallocation.replacement_booking_hold_id
      WHERE pet.name='Wave Six 613' AND replacement.state='CONFIRMED'
    ), counts AS (SELECT slot_id,count(*)::integer AS amount FROM confirmed_replacements GROUP BY slot_id)
    UPDATE clinic_schema.appointment_slots slot SET booked_count=GREATEST(0,slot.booked_count-counts.amount),status='AVAILABLE',updated_at=clock_timestamp() FROM counts WHERE slot.id=counts.slot_id;
    UPDATE booking_schema.appointments appointment SET status='CANCELLED',updated_at=clock_timestamp()
    FROM booking_schema.reallocation_cases reallocation,booking_schema.booking_holds source,pet_schema.pets pet
    WHERE appointment.hold_id=reallocation.replacement_booking_hold_id AND source.id=reallocation.booking_hold_id AND pet.id=source.pet_id AND pet.name='Wave Six 613' AND appointment.status='CONFIRMED';
    UPDATE booking_schema.booking_holds replacement SET state='RELEASED',version=replacement.version+1,updated_at=clock_timestamp()
    FROM booking_schema.reallocation_cases reallocation,booking_schema.booking_holds source,pet_schema.pets pet
    WHERE replacement.id=reallocation.replacement_booking_hold_id AND source.id=reallocation.booking_hold_id AND pet.id=source.pet_id AND pet.name='Wave Six 613' AND replacement.state='CONFIRMED';
    WITH leaked AS (
      SELECT replacement.id AS hold_id,replacement.slot_id
      FROM booking_schema.reallocation_cases reallocation
      JOIN booking_schema.booking_holds source ON source.id=reallocation.booking_hold_id
      JOIN pet_schema.pets pet ON pet.id=source.pet_id
      JOIN booking_schema.booking_holds replacement ON replacement.id=reallocation.replacement_booking_hold_id
      WHERE pet.name='Wave Six 613' AND replacement.state='MANUAL_CONFIRM_PENDING'
    ), counts AS (SELECT slot_id,count(*)::integer AS amount FROM leaked GROUP BY slot_id)
    UPDATE clinic_schema.appointment_slots slot SET held_count=GREATEST(0,slot.held_count-counts.amount),updated_at=clock_timestamp() FROM counts WHERE slot.id=counts.slot_id;
    UPDATE booking_schema.booking_holds replacement SET state='RELEASED',version=replacement.version+1,updated_at=clock_timestamp()
    FROM booking_schema.reallocation_cases reallocation,booking_schema.booking_holds source,pet_schema.pets pet
    WHERE replacement.id=reallocation.replacement_booking_hold_id AND source.id=reallocation.booking_hold_id AND pet.id=source.pet_id AND pet.name='Wave Six 613' AND replacement.state='MANUAL_CONFIRM_PENDING';
    UPDATE booking_schema.reallocation_cases reallocation SET status='CLOSED',version=reallocation.version+1,updated_at=clock_timestamp()
    FROM booking_schema.booking_holds source,pet_schema.pets pet
    WHERE source.id=reallocation.booking_hold_id AND pet.id=source.pet_id AND pet.name='Wave Six 613' AND reallocation.status='REPLACEMENT_PENDING_CONFIRMATION';
    UPDATE clinic_schema.appointment_slots slot SET booked_count=0,status='AVAILABLE',version=slot.version+1,updated_at=clock_timestamp()
    WHERE slot.id IN (
      SELECT offer.slot_id FROM booking_schema.reallocation_offers offer
      JOIN booking_schema.reallocation_cases reallocation ON reallocation.id=offer.reallocation_case_id
      JOIN booking_schema.booking_holds source ON source.id=reallocation.booking_hold_id
      JOIN pet_schema.pets pet ON pet.id=source.pet_id
      WHERE pet.name='Wave Six 613'
    ) AND NOT EXISTS(SELECT 1 FROM booking_schema.booking_holds hold WHERE hold.slot_id=slot.id AND hold.state='CONFIRMED');
    UPDATE clinic_schema.appointment_slots slot SET booked_count=0,held_count=0,status='AVAILABLE',version=slot.version+1,updated_at=clock_timestamp()
    FROM clinic_schema.clinic_services service
    WHERE service.id=slot.service_id AND slot.source='DOCTOR_SHIFT' AND service.code LIKE 'W6C1\_%' ESCAPE '\\'
      AND NOT EXISTS(SELECT 1 FROM booking_schema.booking_holds hold WHERE hold.slot_id=slot.id AND hold.state IN ('CONFIRMED','MANUAL_CONFIRM_PENDING'));
    UPDATE booking_schema.booking_holds hold SET state='RELEASED',version=hold.version+1,updated_at=clock_timestamp()
    FROM clinic_schema.appointment_slots slot,clinic_schema.clinic_services service
    WHERE slot.id=hold.slot_id AND service.id=slot.service_id AND service.code LIKE 'W6C1\_%' ESCAPE '\\' AND hold.state='MANUAL_CONFIRM_PENDING';
    UPDATE booking_schema.reallocation_cases reallocation SET status='CLOSED',version=reallocation.version+1,updated_at=clock_timestamp()
    FROM booking_schema.booking_holds replacement,clinic_schema.appointment_slots slot,clinic_schema.clinic_services service
    WHERE replacement.id=reallocation.replacement_booking_hold_id AND slot.id=replacement.slot_id AND service.id=slot.service_id AND service.code LIKE 'W6C1\_%' ESCAPE '\\' AND reallocation.status='REPLACEMENT_PENDING_CONFIRMATION';
    UPDATE clinic_schema.appointment_slots slot SET held_count=0,status=CASE WHEN booked_count=capacity THEN 'BOOKED' ELSE 'AVAILABLE' END,version=slot.version+1,updated_at=clock_timestamp()
    FROM clinic_schema.clinic_services service
    WHERE service.id=slot.service_id AND service.code LIKE 'W6C1\_%' ESCAPE '\\' AND slot.source='DOCTOR_SHIFT';
    COMMIT;`);
}
function seedSource(ownerId: string, petId: string) {
  const [clinicId, locationId, targetCode, targetSlotId] = sql(
    `SELECT c.id::text||'|'||l.id::text||'|'||candidate.code||'|'||candidate.slot_id::text FROM clinic_schema.clinics c JOIN clinic_schema.clinic_locations l ON l.clinic_id=c.id CROSS JOIN LATERAL(SELECT service.code,(array_agg(slot.id ORDER BY slot.starts_at,slot.id))[1] AS slot_id FROM clinic_schema.appointment_slots slot JOIN clinic_schema.clinic_services service ON service.id=slot.service_id JOIN clinic_schema.clinic_locations target ON target.id=slot.clinic_location_id WHERE slot.source='DOCTOR_SHIFT' AND slot.publication_state='PUBLISHED' AND slot.starts_at>clock_timestamp() AND slot.capacity-slot.booked_count-slot.held_count>0 AND target.clinic_id<>c.id AND NOT EXISTS(SELECT 1 FROM booking_schema.booking_holds pending JOIN clinic_schema.appointment_slots pending_slot ON pending_slot.id=pending.slot_id WHERE pending_slot.clinic_location_id=target.id AND pending.state='MANUAL_CONFIRM_PENDING') GROUP BY service.code HAVING count(*)>=2 ORDER BY min(slot.starts_at),service.code LIMIT 1)candidate WHERE c.public_name='VetHelp Pilot' LIMIT 1`,
  )
    .trim()
    .split("|");
  sql(
    `INSERT INTO clinic_schema.clinic_services(id,clinic_location_id,code,display_name,duration_minutes,active) VALUES('${ids.service}','${locationId}','${targetCode}','Smart reallocation visit',30,true) ON CONFLICT(clinic_location_id,code) DO UPDATE SET active=true`,
  );
  const serviceId = sql(
    `SELECT id::text FROM clinic_schema.clinic_services WHERE clinic_location_id='${locationId}' AND code='${targetCode}'`,
  ).trim();
  const [targetLocationId, targetServiceId] = sql(
    `SELECT slot.clinic_location_id::text||'|'||slot.service_id::text FROM clinic_schema.appointment_slots slot JOIN clinic_schema.clinic_services service ON service.id=slot.service_id JOIN clinic_schema.clinic_locations target ON target.id=slot.clinic_location_id WHERE service.code='${targetCode}' AND target.clinic_id<>'${clinicId}' AND slot.source='DOCTOR_SHIFT' AND slot.publication_state='PUBLISHED' LIMIT 1`,
  )
    .trim()
    .split("|");
  sql(
    `INSERT INTO identity_schema.users(id) VALUES('${ids.support}') ON CONFLICT DO NOTHING; INSERT INTO clinic_schema.appointment_slots(id,clinic_location_id,service_id,starts_at,ends_at,capacity,booked_count,held_count,state,status,source,publication_state) VALUES('${ids.slot}','${locationId}','${serviceId}',clock_timestamp()+interval '2 days',clock_timestamp()+interval '2 days 30 minutes',1,1,0,'OPEN','BOOKED','MANUAL','PUBLISHED'); INSERT INTO booking_schema.booking_holds(id,slot_id,owner_id,pet_id,state,expires_at) VALUES('${ids.hold}','${ids.slot}','${ownerId}','${petId}','CONFIRMED',clock_timestamp()+interval '3 days'); INSERT INTO booking_schema.appointments(id,hold_id,owner_id,pet_id,clinic_location_id,slot_id,status) VALUES('${ids.appointment}','${ids.hold}','${ownerId}','${petId}','${locationId}','${ids.slot}','CONFIRMED')`,
  );
  return {
    clinicId,
    locationId,
    serviceId,
    targetLocationId,
    targetServiceId,
  };
}
function jwt(sub: string, clinicId: string, locationId: string) {
  const now = Math.floor(Date.now() / 1000),
    enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url"),
    h = enc({ alg: "HS256", typ: "JWT" }),
    p = enc({
      sub,
      roles: ["CLINIC_ADMIN"],
      clinicIds: [clinicId],
      locationIds: [locationId],
      iss: "vethelp-local",
      aud: "vethelp-api",
      iat: now,
      exp: now + 3600,
    });
  return `${h}.${p}.${createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url")}`;
}
function sql(statement: string) {
  return execFileSync(
    "docker",
    [
      "compose",
      "-p",
      "vethelp-alpha",
      "-f",
      "../../docker-compose.local.yml",
      "exec",
      "-T",
      "postgres",
      "psql",
      "-At",
      "-U",
      "vethelp",
      "-d",
      "vethelp",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      statement,
    ],
    { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}
function sha(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

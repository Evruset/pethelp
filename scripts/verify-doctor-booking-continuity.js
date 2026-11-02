import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(new URL("../apps/owner-app/package.json", import.meta.url));
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const artifactDir = path.join(__dirname, "../docs/ai/artifacts/owner-v50-doctor-booking-continuity");
const ownerPhone = process.env.OWNER_CAPTURE_PHONE ?? "+79991234567";
const ownerOtp = process.env.OWNER_CAPTURE_OTP ?? "246810";
fs.mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const runtimeErrors = [];
const evidence = [];
page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
});
page.on("response", (response) => {
  if (response.status() >= 400 && response.url().includes("/api/owner/")) {
    runtimeErrors.push(`request: ${response.status()} ${response.url()}`);
  }
});

const authenticate = async () => {
  const login = page.getByRole("button", { name: "Войти", exact: true });
  const clinics = page.getByText("Клиники", { exact: true }).last();
  await login.or(clinics).first().waitFor({ state: "visible", timeout: 20000 });
  if (!(await login.isVisible().catch(() => false))) return;
  await login.click();
  await page.getByLabel("Номер телефона").fill(ownerPhone);
  await page.getByRole("button", { name: "Получить код", exact: true }).click();
  await page.getByLabel("Код из сообщения").fill(ownerOtp);
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await clinics.waitFor({ state: "visible", timeout: 20000 });
};

const quality = async (label) => {
  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    undersized: [...document.querySelectorAll('[role="button"], [role="radio"], button')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
      })
      .map((element) => element.textContent?.trim() || element.getAttribute("aria-label")),
  }));
  if (geometry.document > geometry.viewport) throw new Error(`${label}: horizontal overflow`);
  if (geometry.undersized.length) throw new Error(`${label}: undersized targets ${geometry.undersized.join(", ")}`);
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { resultTypes: ["violations"] });
    return result.violations.filter(({ impact }) => impact === "serious" || impact === "critical");
  });
  if (violations.length) throw new Error(`${label}: axe ${violations.map(({ id }) => id).join(", ")}`);
};

try {
  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of ["doctor-select", "booking"]) {
      await page.goto(`http://127.0.0.1:8766/prototype-v50/index.html#${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(artifactDir, `prototype_${route}_${viewport.name}.png`), fullPage: true });
    }

    await page.goto("http://127.0.0.1:8081", { waitUntil: "domcontentloaded" });
    await page.locator("#root").waitFor({ state: "attached", timeout: 15000 });
    await authenticate();
    await page.getByText("Клиники", { exact: true }).last().click();
    await page.getByText("Клиники VetHelp", { exact: true }).waitFor({ state: "visible" });
    runtimeErrors.length = 0;
    await page.getByLabel("Поиск по клинике или адресу").fill("Большая Полянка");
    await page.getByRole("button", { name: "Найти", exact: true }).click();
    await page.getByText("Филиал · Москва, ул. Большая Полянка, 18", { exact: true }).waitFor({ state: "visible" });

    const doctorResponsePromise = page.waitForResponse((response) => response.url().includes("/doctors?locationId=") && response.status() === 200);
    await page.getByRole("button", { name: "Посмотреть услуги", exact: true }).click();
    const doctorPayload = await (await doctorResponsePromise).json();
    await page.getByText("Ветеринарные врачи", { exact: true }).waitFor({ state: "visible" });
    if (!Array.isArray(doctorPayload.doctors) || doctorPayload.doctors.length === 0) throw new Error(`${viewport.name}: no doctors`);
    for (const doctor of doctorPayload.doctors) {
      await page.getByText(doctor.displayName, { exact: true }).waitFor({ state: "visible" });
      if (await page.getByRole("button", { name: new RegExp(doctor.displayName) }).count()) {
        throw new Error(`${viewport.name}: Pilot exposes selectable doctor ${doctor.displayName}`);
      }
    }
    await quality(`doctor-discovery-${viewport.name}`);
    await page.screenshot({ path: path.join(artifactDir, `runtime_doctor_discovery_${viewport.name}.png`), fullPage: true });

    const serviceRadio = page.getByRole("radio").first();
    const serviceLabel = (await serviceRadio.textContent())?.trim() ?? "";
    await serviceRadio.click();
    const availabilityResponsePromise = page.waitForResponse((response) => response.url().includes("/availability") && response.status() === 200);
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    const availability = await (await availabilityResponsePromise).json();
    if (!availability.serviceName || !availability.slots?.length) throw new Error(`${viewport.name}: no authoritative slots`);
    if (availability.slots.some((slot) => "doctorId" in slot || "staffId" in slot)) {
      throw new Error(`${viewport.name}: unexpected selectable identity in Pilot availability DTO`);
    }
    await page.getByText("Доступные интервалы", { exact: true }).waitFor({ state: "visible" });
    await quality(`availability-${viewport.name}`);
    await page.screenshot({ path: path.join(artifactDir, `runtime_availability_${viewport.name}.png`), fullPage: true });

    await page.getByRole("radio").first().click();
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    await page.getByText("Кого записываем?", { exact: true }).waitFor({ state: "visible" });
    if (runtimeErrors.length) throw new Error(`${viewport.name}: ${runtimeErrors.join("\n")}`);
    evidence.push({
      viewport: `${viewport.width}x${viewport.height}`,
      doctorIds: doctorPayload.doctors.map(({ id }) => id),
      serviceLabel,
      serviceName: availability.serviceName,
      slotIds: availability.slots.map(({ slotId }) => slotId),
      handoff: "PET_SELECTION",
      runtimeErrors: 0,
    });
  }
  fs.writeFileSync(path.join(artifactDir, "evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence));
  console.log("DOCTOR_DISCOVERY=PASS");
  console.log("DOCTOR_SELECTION=NOT_IN_PILOT");
  console.log("AVAILABILITY_HANDOFF=PASS");
  console.log("RESPONSIVE=PASS ACCESSIBILITY=PASS RUNTIME_ERRORS=0");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}

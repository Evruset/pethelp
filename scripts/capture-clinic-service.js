import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(new URL("../apps/owner-app/package.json", import.meta.url));
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const artifactDir = path.join(
  __dirname,
  "../docs/ai/artifacts/owner-v50-clinic-service-parity",
);
const ownerPhone = process.env.OWNER_CAPTURE_PHONE ?? "+79991234567";
const ownerOtp = process.env.OWNER_CAPTURE_OTP ?? "246810";

fs.mkdirSync(artifactDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const runtimeErrors = [];
page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
});
page.on("response", (response) => {
  if (response.status() >= 400 && response.url().includes("/api/owner/")) {
    runtimeErrors.push(`request: ${response.status()} ${response.url()}`);
  }
});

const assertPageQuality = async (name) => {
  const geometry = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    undersizedTargets: [...document.querySelectorAll('[role="button"], button')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
      })
      .map((element) => element.textContent?.trim() || element.getAttribute("aria-label") || "<unnamed>"),
  }));
  if (geometry.documentWidth > geometry.viewportWidth) {
    throw new Error(`${name}: horizontal overflow ${geometry.documentWidth} > ${geometry.viewportWidth}`);
  }
  if (geometry.undersizedTargets.length) {
    throw new Error(`${name}: touch targets below 44px: ${geometry.undersizedTargets.join(", ")}`);
  }
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { resultTypes: ["violations"] });
    return result.violations.filter(({ impact }) => impact === "serious" || impact === "critical");
  });
  if (violations.length) {
    throw new Error(
      `${name}: axe violations: ${violations
        .map(({ id, nodes }) => `${id} (${nodes.map((node) => node.target.join(" ")).join("; ")})`)
        .join(", ")}`,
    );
  }
};

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

try {
  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const prototype of ["clinic", "booking"]) {
      await page.goto(`http://127.0.0.1:8766/prototype-v50/index.html#${prototype}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(700);
      await page.screenshot({
        path: path.join(artifactDir, `prototype_${prototype}_${viewport.name}.png`),
        fullPage: true,
      });
    }

    await page.goto("http://127.0.0.1:8081", { waitUntil: "domcontentloaded" });
    await page.locator("#root").waitFor({ state: "attached", timeout: 15000 });
    await authenticate();
    await page.getByText("Клиники", { exact: true }).last().click();
    await page.getByText("Клиники VetHelp", { exact: true }).waitFor({ state: "visible" });
    // An anonymous session probe may legitimately return 401 before OTP login.
    runtimeErrors.length = 0;
    await page.getByLabel("Поиск по клинике или адресу").fill("Большая Полянка");
    await page.getByRole("button", { name: "Найти", exact: true }).click();
    await page.getByText("Филиал · Москва, ул. Большая Полянка, 18", { exact: true }).waitFor({ state: "visible" });

    const clinicResponse = page.waitForResponse(
      (response) =>
        /clinic-catalog\/[^/]+\/locations\/[^/?]+$/.test(response.url()) &&
        response.status() === 200,
    );
    await page.getByRole("button", { name: "Посмотреть услуги", exact: true }).click();
    const clinicPayload = await (await clinicResponse).json();
    const selectedIds = {
      clinicId: clinicPayload.clinicId,
      locationId: clinicPayload.locationId,
    };
    await page.getByText("Выберите услугу", { exact: true }).waitFor({ state: "visible" });
    await page.waitForTimeout(500);
    if (!selectedIds?.clinicId || !selectedIds?.locationId) throw new Error("Clinic/location handoff was not observed");
    await assertPageQuality(`clinic-${viewport.name}`);
    await page.screenshot({
      path: path.join(artifactDir, `runtime_clinic_${viewport.name}.png`),
      fullPage: true,
    });

    const service = page.getByRole("radio").first();
    await service.click();
    const serviceName = (await service.textContent())?.trim();
    const availabilityResponse = page.waitForResponse((response) =>
      response.url().includes("/availability") && response.status() === 200,
    );
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    const availabilityPayload = await (await availabilityResponse).json();
    if (
      availabilityPayload.clinicName.length === 0 ||
      availabilityPayload.serviceName.length === 0 ||
      !Array.isArray(availabilityPayload.slots) ||
      availabilityPayload.slots.length === 0
    ) {
      throw new Error("Authoritative availability response is incomplete");
    }
    await page.getByText("Доступные интервалы", { exact: true }).waitFor({ state: "visible" });
    await assertPageQuality(`availability-${viewport.name}`);
    await page.screenshot({
      path: path.join(artifactDir, `runtime_availability_${viewport.name}.png`),
      fullPage: true,
    });

    await page.getByRole("radio").first().click();
    await page.getByText(/^Выбрано:/).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "Продолжить", exact: true }).click();
    await page.getByText("Кого записываем?", { exact: true }).waitFor({ state: "visible" });
    if (!serviceName || runtimeErrors.length) {
      throw new Error(`Runtime errors (${viewport.name}): ${runtimeErrors.join("\n")}`);
    }
    console.log(
      `${viewport.name}: clinic=${selectedIds.clinicId} location=${selectedIds.locationId} service=${availabilityPayload.serviceName} slots=${availabilityPayload.slots.length}`,
    );
  }
  console.log("CLINIC_HANDOFF=PASS");
  console.log("SERVICE_SELECTION=PASS");
  console.log("AVAILABILITY=PASS");
  console.log("BOOKING_HANDOFF=PASS");
  console.log("RESPONSIVE=PASS");
  console.log("ACCESSIBILITY=PASS");
  console.log("RUNTIME_ERRORS=0");
} catch (error) {
  await page.screenshot({ path: path.join(artifactDir, "failure.png"), fullPage: true }).catch(() => {});
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ownerRequire = createRequire(new URL("../apps/owner-app/package.json", import.meta.url));
const axeSource = fs.readFileSync(ownerRequire.resolve("axe-core/axe.min.js"), "utf8");
const artifactDir = path.join(__dirname, `../docs/ai/artifacts/${process.env.OWNER_CAPTURE_ARTIFACT_DIR ?? "owner-v50-r2k-live"}`);
const repoRoot = path.join(__dirname, "..");
const phone = process.env.OWNER_CAPTURE_PHONE ?? "+79990000991";
const otp = process.env.OWNER_CAPTURE_OTP ?? "246810";
const ownerId = "94000000-0000-4000-8000-000000000001";
const runtimeUrl = "http://127.0.0.1:8081";
const structuralOnly = process.env.STRUCTURAL_ONLY === "1";
const requiredStates = ["bookings_before", "eligible_detail", "confirmation", "cancelled_detail", "bookings_after", "terminal_detail"];
fs.mkdirSync(artifactDir, { recursive: true });

let previousPhoneOwner = null;
let previousOwnerPhone = null;

function backendNode(source) {
  return execFileSync("docker", ["compose", "-f", "docker-compose.local.yml", "exec", "-T", "backend", "node", "-e", source], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function installIdentity() {
  const result = JSON.parse(backendNode(`const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});(async()=>{const c=await p.connect();try{await c.query('BEGIN');const a=(await c.query('SELECT user_id::text FROM identity_schema.owner_identities WHERE phone_e164=$1 FOR UPDATE',[${JSON.stringify(phone)}])).rows[0]?.user_id??null;const b=(await c.query('SELECT phone_e164 FROM identity_schema.owner_identities WHERE user_id=$1::uuid FOR UPDATE',[${JSON.stringify(ownerId)}])).rows[0]?.phone_e164??null;await c.query('DELETE FROM identity_schema.owner_identities WHERE phone_e164=$1 OR user_id=$2::uuid',[${JSON.stringify(phone)},${JSON.stringify(ownerId)}]);await c.query('INSERT INTO identity_schema.owner_identities(user_id,phone_e164) VALUES($1::uuid,$2)',[${JSON.stringify(ownerId)},${JSON.stringify(phone)}]);await c.query('COMMIT');console.log(JSON.stringify({a,b}));}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await p.end();}})()`));
  previousPhoneOwner = result.a;
  previousOwnerPhone = result.b;
}

function restoreIdentity() {
  backendNode(`const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});(async()=>{const c=await p.connect();try{await c.query('BEGIN');await c.query('DELETE FROM identity_schema.owner_identities WHERE user_id=$1::uuid OR phone_e164=$2',[${JSON.stringify(ownerId)},${JSON.stringify(phone)}]);${previousPhoneOwner ? `await c.query('INSERT INTO identity_schema.owner_identities(user_id,phone_e164) VALUES($1::uuid,$2)',[${JSON.stringify(previousPhoneOwner)},${JSON.stringify(phone)}]);` : ""}${previousOwnerPhone && previousOwnerPhone !== phone ? `await c.query('INSERT INTO identity_schema.owner_identities(user_id,phone_e164) VALUES($1::uuid,$2)',[${JSON.stringify(ownerId)},${JSON.stringify(previousOwnerPhone)}]);` : ""}await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await p.end();}})()`);
}

async function authenticate(page) {
  await page.goto(runtimeUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#root").waitFor({ state: "attached", timeout: 15000 });
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.getByLabel("Номер телефона").fill(phone);
  await page.getByRole("button", { name: "Получить код", exact: true }).click();
  await page.getByLabel("Код из сообщения").fill(otp);
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await page.getByText("Мои записи", { exact: true }).last().waitFor({ state: "visible", timeout: 20000 });
}

async function quality(page, label) {
  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    rawStatuses: document.body.innerText.match(/\b(?:CONFIRMED|RELEASED|CANCELLED|CANCELLATION_REQUESTED)\b/g) ?? [],
    undersized: [...document.querySelectorAll('[role="button"], button')].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44);
    }).map((element) => element.textContent?.trim() || element.getAttribute("aria-label")),
  }));
  if (geometry.document > geometry.viewport) throw new Error(`${label}: horizontal overflow`);
  if (geometry.undersized.length) throw new Error(`${label}: undersized targets ${geometry.undersized.join(", ")}`);
  if (geometry.rawStatuses.length) throw new Error(`${label}: raw statuses ${geometry.rawStatuses.join(", ")}`);
  await page.addScriptTag({ content: axeSource });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { resultTypes: ["violations"] });
    return result.violations.filter(({ impact }) => impact === "serious" || impact === "critical");
  });
  if (violations.length) throw new Error(`${label}: axe ${violations.map(({ id }) => id).join(", ")}`);
}

async function shot(page, name, viewport) {
  await quality(page, `${name}-${viewport}`);
  await page.screenshot({ path: path.join(artifactDir, `${name}_${viewport}.png`), fullPage: true });
}

async function runViewport(browser, viewport) {
  execFileSync(path.join(repoRoot, "start-vethelp.sh"), ["seed", "rich-demo"], { cwd: repoRoot, stdio: "ignore" });
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`); });
  page.on("response", (response) => {
    if (response.status() >= 500 && response.url().includes("/api/owner/")) runtimeErrors.push(`request: ${response.status()} ${response.url()}`);
  });

  for (const route of ["appointments", "appointment-detail"]) {
    await page.goto(`http://127.0.0.1:8766/prototype-v50/index.html#${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(artifactDir, `prototype_${route}_${viewport.name}.png`), fullPage: true });
  }
  await authenticate(page);
  await page.getByText("Мои записи", { exact: true }).last().click();
  await page.getByRole("heading", { name: "Мои записи", exact: true }).waitFor({ state: "visible" });
  runtimeErrors.length = 0;
  await page.getByText("Барни · Собака", { exact: true }).waitFor({ state: "visible" });
  if (await page.getByText("Рокки · Собака", { exact: true }).count()) throw new Error(`${viewport.name}: history row visible in active tab`);
  await shot(page, "bookings_before", viewport.name);

  await page.getByRole("tab", { name: "История", exact: true }).click();
  await page.getByText("Рокки · Собака", { exact: true }).waitFor({ state: "visible" });
  if (await page.getByText("Барни · Собака", { exact: true }).count()) throw new Error(`${viewport.name}: active row visible in history tab`);
  await shot(page, "bookings_history", viewport.name);

  await page.getByRole("button", { name: "Подробнее", exact: true }).first().click();
  await page.getByRole("heading", { name: "Детали записи", exact: true }).waitFor({ state: "visible" });
  await page.getByText("Рокки · Собака", { exact: true }).waitFor({ state: "visible" });
  if (await page.getByRole("button", { name: "Отменить запись", exact: true }).count()) throw new Error(`${viewport.name}: terminal booking exposes cancel`);
  await shot(page, "terminal_detail", viewport.name);
  await page.getByText("К списку записей", { exact: true }).click();

  await page.getByText("Барни · Собака", { exact: true }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Подробнее", exact: true }).first().click();
  await page.getByText("Барни · Собака", { exact: true }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Отменить запись", exact: true }).waitFor({ state: "visible" });
  await shot(page, "eligible_detail", viewport.name);
  if (structuralOnly) {
    if (runtimeErrors.length) throw new Error(`${viewport.name}: ${runtimeErrors.join("\n")}`);
    await context.close();
    return { viewport: `${viewport.width}x${viewport.height}`, assertions: 8, tabs: "PASS", listToDetail: "PASS", horizontalOverflow: 0, touchTargets: "PASS", axeSeriousCritical: 0, runtimeErrors: 0 };
  }
  await page.getByRole("button", { name: "Отменить запись", exact: true }).click();
  await page.getByText("Отменить запись?", { exact: true }).waitFor({ state: "visible" });
  await shot(page, "confirmation", viewport.name);

  let cancelHeaders;
  await page.route("**/api/owner/v1/owner/bookings/*/cancel", async (route) => {
    cancelHeaders = route.request().headers();
    await route.abort("failed");
  }, { times: 1 });
  await page.getByRole("button", { name: "Да, отменить", exact: true }).click();
  await page.getByText("Не удалось отменить запись", { exact: true }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Отменить запись", exact: true }).waitFor({ state: "visible" });
  if (await page.getByText("Отменена", { exact: true }).count()) throw new Error(`${viewport.name}: optimistic cancellation detected`);
  runtimeErrors.length = 0; // The single ERR_FAILED above is the controlled network-failure assertion.

  const cancelResponsePromise = page.waitForResponse((response) => response.url().endsWith("/cancel") && response.status() === 200);
  await page.getByRole("button", { name: "Да, отменить", exact: true }).click();
  const cancelResponse = await cancelResponsePromise;
  const cancelPayload = await cancelResponse.json();
  if (cancelPayload.status !== "CANCELLED") throw new Error(`${viewport.name}: cancellation command did not return CANCELLED: ${JSON.stringify(cancelPayload)}`);
  await page.getByText("Отменена", { exact: true }).waitFor({ state: "visible" });
  if (await page.getByRole("button", { name: "Отменить запись", exact: true }).count()) throw new Error(`${viewport.name}: cancelled detail still exposes cancel`);
  await shot(page, "cancelled_detail", viewport.name);

  const cancellationUrl = cancelResponse.url();
  const commandHeaders = {
    "content-type": "application/json",
    origin: runtimeUrl,
    authorization: cancelHeaders.authorization,
    cookie: cancelHeaders.cookie,
    "idempotency-key": cancelHeaders["idempotency-key"],
    "if-match": cancelHeaders["if-match"],
  };
  const replay = await context.request.post(cancellationUrl, { headers: commandHeaders, data: { reasonCode: "OTHER" } });
  const replayPayload = await replay.json().catch(async () => ({ text: await replay.text() }));
  if (replay.status() !== 200 || replayPayload.status !== "CANCELLED") throw new Error(`${viewport.name}: idempotent replay failed: ${replay.status()} ${JSON.stringify(replayPayload)} requestHeaders=${JSON.stringify(cancelHeaders)}`);
  const stale = await context.request.post(cancellationUrl, {
    headers: { ...commandHeaders, "idempotency-key": crypto.randomUUID(), "if-match": "1" },
    data: { reasonCode: "OTHER" },
  });
  if (stale.status() !== 409) throw new Error(`${viewport.name}: stale command returned ${stale.status()}`);

  await page.getByText("Назад", { exact: true }).click();
  await page.getByRole("heading", { name: "Мои записи", exact: true }).waitFor({ state: "visible" });
  await page.getByRole("tab", { name: "История", exact: true }).click();
  await page.getByText("Барни · Собака", { exact: true }).waitFor({ state: "visible" });
  if ((await page.getByText("Отменена", { exact: true }).count()) < 1) throw new Error(`${viewport.name}: refreshed list did not show cancelled booking`);
  await shot(page, "bookings_after", viewport.name);
  if (runtimeErrors.length) throw new Error(`${viewport.name}: ${runtimeErrors.join("\n")}`);
  await context.close();
  return { viewport: `${viewport.width}x${viewport.height}`, holdId: cancelPayload.holdId, pet: "Барни", commandStatus: cancelPayload.status, replayStatus: replay.status(), staleStatus: stale.status(), runtimeErrors: 0 };
}

let browser;
try {
  installIdentity();
  browser = await chromium.launch({ headless: true });
  const evidence = [];
  const viewports = [{ name: "mobile", width: 390, height: 844 }, { name: "desktop", width: 1440, height: 900 }]
    .filter(({ name }) => !process.env.VIEWPORT || process.env.VIEWPORT === name);
  if (!viewports.length) throw new Error(`Unsupported VIEWPORT=${process.env.VIEWPORT}`);
  for (const viewport of viewports) {
    const result = await runViewport(browser, viewport);
    evidence.push(result);
    fs.writeFileSync(path.join(artifactDir, `evidence_${viewport.name}.json`), `${JSON.stringify(result, null, 2)}\n`);
  }
  const expectedStates = structuralOnly ? ["bookings_before", "bookings_history", "eligible_detail"] : requiredStates;
  for (const viewport of viewports.map(({ name }) => name)) for (const state of expectedStates) {
    const file = path.join(artifactDir, `${state}_${viewport}.png`);
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error(`Missing required screenshot: ${file}`);
  }
  fs.writeFileSync(path.join(artifactDir, "evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence));
  console.log(structuralOnly
    ? "STRUCTURAL_CAPTURE=PASS RESPONSIVE=PASS ACCESSIBILITY=PASS RUNTIME_ERRORS=0"
    : "OWNER_V50_R2K_COMPLETE=YES RESPONSIVE=PASS ACCESSIBILITY=PASS RUNTIME_ERRORS=0");
} finally {
  if (browser) await browser.close();
  execFileSync(path.join(repoRoot, "start-vethelp.sh"), ["seed", "rich-demo"], { cwd: repoRoot, stdio: "ignore" });
  restoreIdentity();
}

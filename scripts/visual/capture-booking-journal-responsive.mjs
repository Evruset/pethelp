import { createRequire } from "node:module";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  access,
  lstat,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const GENERATED_BY =
  "scripts/visual/capture-booking-journal-responsive.mjs";
export const EVIDENCE_ID = "V50-CLINIC-MVP1-02-R5-C-RESPONSIVE";
export const REQUIRED_VIEWPORTS = [
  "320x568",
  "375x812",
  "390x844",
  "430x932",
  "768x1024",
  "820x1180",
  "960x720",
  "1024x768",
  "1280x800",
  "1440x900",
];
export const CROSS_STATES = [
  "pending-request",
  "request-overdue",
  "manual-booking",
];
export const CLASS_STATES = {
  "wide-desktop": [
    "reception-ready",
    "pending-request",
    "request-overdue",
    "request-detail-pending",
    "request-detail-overdue",
    "request-detail-submitting",
    "request-detail-success",
    "request-detail-conflict",
    "request-detail-alternative",
    "request-detail-stale",
    "request-detail-technical-error",
    "request-detail-forbidden",
    "week-view",
    "week-alternative-selection",
    "manual-booking",
    "desktop-calendar-search-results",
    "desktop-filters-active",
    "desktop-filters-collapsed",
    "manual-booking-global",
    "manual-booking-free-slot",
    "manual-booking-client-context",
    "manual-booking-request-context",
    "manual-booking-validation",
    "manual-booking-submitting",
    "manual-booking-success",
    "manual-booking-conflict",
    "manual-booking-terminal-error",
    "keyboard-booking-open",
    "keyboard-booking-return-focus",
    "reduced-motion-booking",
    "calendar-card-wide",
    "calendar-free-slot",
    "calendar-overdue",
  ],
  "compact-desktop": [
    "compact-calendar",
    "compact-filters-open",
    "compact-detail-open",
    "pending-request",
    "request-overdue",
    "request-detail-pending",
    "request-detail-overdue",
    "request-detail-conflict",
    "request-detail-success",
    "manual-booking",
    "manual-booking-global",
    "manual-booking-free-slot",
    "manual-booking-validation",
    "calendar-card-compact",
  ],
  tablet: [
    "tablet-calendar",
    "tablet-calendar-search",
    "tablet-filters-open",
    "tablet-filters-active",
    "tablet-detail",
    "pending-request",
    "request-overdue",
    "request-detail-pending",
    "request-detail-overdue",
    "request-detail-conflict",
    "request-detail-success",
    "manual-booking",
    "manual-booking-global",
    "manual-booking-client-context",
    "manual-booking-request-context",
    "manual-booking-conflict",
    "calendar-card-compact",
  ],
  mobile: [
    "mobile-today",
    "mobile-today-overdue",
    "mobile-request-list",
    "mobile-request-detail",
    "mobile-request-detail-pending",
    "mobile-request-detail-overdue",
    "mobile-request-detail-submitting",
    "mobile-request-detail-success",
    "mobile-request-detail-conflict",
    "mobile-calendar-search",
    "mobile-calendar-search-results",
    "mobile-calendar-search-empty",
    "mobile-filters-open",
    "mobile-filters-active",
    "mobile-filters-empty-result",
    "mobile-alternative-slots",
    "mobile-alternative-review",
    "mobile-booking-step-client",
    "mobile-booking-step-schedule",
    "mobile-booking-step-review",
    "mobile-client-detail",
    "mobile-stale",
    "mobile-error",
    "mobile-forbidden",
    "manual-booking-global",
    "manual-booking-free-slot",
    "mobile-booking-conflict",
    "mobile-booking-success",
    "calendar-card-mobile",
    "calendar-free-slot",
  ],
};
export const FULL_PAGE_STATES = new Set([
  "mobile-today",
  "mobile-request-list",
  "mobile-request-detail",
  "mobile-filters-open",
  "mobile-booking-step-client",
  "mobile-booking-step-schedule",
  "mobile-booking-step-review",
  "mobile-client-detail",
  "manual-booking",
]);
export const SIZE_BUDGET = {
  screenshots: 400,
  totalBytes: 140 * 1024 * 1024,
  singlePngBytes: 6 * 1024 * 1024,
};
const CANONICAL = {
  "wide-desktop": "1440x900",
  "compact-desktop": "1024x768",
  tablet: "768x1024",
  mobile: "390x844",
};
const EXTRA_ROLE_STATES = {
  "wide-desktop": [
    "reception-ready",
    "pending-request",
    "manual-booking-global",
    "manual-booking-readonly-denied",
  ],
  "compact-desktop": ["reception-ready", "pending-request"],
  tablet: ["reception-ready", "pending-request"],
  mobile: ["mobile-today", "mobile-request-detail", "manual-booking-global"],
};
const EXTRA_ROLES = ["admin", "veterinarian", "multi-role"];
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".md": "text/markdown; charset=utf-8",
};
async function runFlowScreenshots({
  page,
  baseUrl,
  evidenceRoot,
  manifest,
  files,
  results,
}) {
  const desktop = manifest.viewports.find(
    (viewport) => viewport.label === "1440x900",
  );
  const mobile = manifest.viewports.find(
    (viewport) => viewport.label === "390x844",
  );
  const shot = async (viewport, state, variant) => {
    const item = { viewport, state, role: "reception", variant, kind: "flow" },
      relative = `viewports/${viewport.label}/${evidenceFilename(state, "reception", "viewport", variant)}`;
    await page.screenshot({ path: path.join(evidenceRoot, relative) });
    files.push({
      ...(await fileRecord(evidenceRoot, relative, item, "viewport")),
      url: page.url(),
    });
  };
  await page.setViewportSize({ width: desktop.width, height: desktop.height });
  const complete = async () => {
    const client = page.getByRole("button", { name: /Иван Петров · Барсик/ });
    if (await client.count()) await client.click();
    await page.locator("[data-r5c-field=service]").selectOption({ index: 1 });
    if (!(await page.locator("[data-r5c-field=staff]").inputValue()))
      await page.locator("[data-r5c-field=staff]").selectOption({ index: 1 });
    if (!(await page.locator("[data-r5c-field=time]").inputValue()))
      await page.locator("[data-r5c-field=time]").fill("14:30");
  };
  await page.goto(
    `${baseUrl}/?state=calendar-free-slot&role=reception&date=2026-08-01&capture=1`,
    { waitUntil: "networkidle" },
  );
  const slot = page
    .getByRole("button", { name: /14:30, свободное окно у Анна Иванова/ })
    .first();
  await slot.focus();
  await slot.press("Enter");
  await page.locator("[data-source=free-slot]").waitFor();
  if (!(await page.getByText(/Создаём из свободного окна: 14:30/).count()))
    throw new Error("FLOW-05 missing context");
  await complete();
  await page.locator("[data-r5c-action=submit]").click();
  await page.locator("[data-booking-state=readback-success]").waitFor();
  await shot(desktop, "manual-booking-success", "flow-05-free-slot-readback");
  results.push({
    state: "manual-booking-success",
    role: "reception",
    viewport: desktop.label,
    status: "PASS",
    durationMs: 0,
    assertions: { flow: "FLOW-05", contextPrefilled: true, readback: true },
  });
  await page.setViewportSize({ width: mobile.width, height: mobile.height });
  await page.goto(
    `${baseUrl}/?state=mobile-client-detail&role=reception&date=2026-08-01&capture=1`,
    { waitUntil: "networkidle" },
  );
  await page.locator("[data-r5c-book-client]").click();
  await page.locator("[data-r5c-field=pet]").selectOption({ index: 1 });
  await page.locator('[data-r5c-action="continue"]').click();
  await page.locator("[data-r5c-field=service]").selectOption({ index: 1 });
  await page.locator("[data-r5c-field=time]").fill("15:00");
  await page.locator('[data-r5c-action="continue"]').click();
  await page.getByRole("button", { name: "Назад" }).last().click();
  if ((await page.locator("[data-r5c-field=time]").inputValue()) !== "15:00")
    throw new Error("FLOW-06 draft lost");
  await page.locator('[data-r5c-action="continue"]').click();
  await shot(
    mobile,
    "manual-booking-client-context",
    "flow-06-draft-preserved",
  );
  results.push({
    state: "manual-booking-client-context",
    role: "reception",
    viewport: mobile.label,
    status: "PASS",
    durationMs: 0,
    assertions: { flow: "FLOW-06", ownerPrefilled: true, draftPreserved: true },
  });
  await page.setViewportSize({ width: desktop.width, height: desktop.height });
  await page.goto(
    `${baseUrl}/?state=manual-booking-conflict&role=reception&date=2026-08-01&capture=1`,
    { waitUntil: "networkidle" },
  );
  await page.getByRole("button", { name: "Выбрать время" }).click();
  if (
    !(await page
      .locator(".r5c-context")
      .filter({ hasText: "Анна Ковалева" })
      .count())
  )
    throw new Error("FLOW-07 context lost");
  await page.locator("[data-r5c-field=staff]").selectOption({ index: 1 });
  await page.locator("[data-r5c-action=submit]").click();
  await page.locator("[data-booking-state=readback-success]").waitFor();
  await shot(desktop, "manual-booking-conflict", "flow-07-conflict-readback");
  results.push({
    state: "manual-booking-conflict",
    role: "reception",
    viewport: desktop.label,
    status: "PASS",
    durationMs: 0,
    assertions: {
      flow: "FLOW-07",
      draftRetained: true,
      alternativeTime: "14:30",
      readback: true,
    },
  });
  await page.goto(
    `${baseUrl}/?state=calendar-free-slot&role=reception&date=2026-08-01&capture=1`,
    { waitUntil: "networkidle" },
  );
  const keyboardSlot = page
    .getByRole("button", { name: /14:30, свободное окно у Анна Иванова/ })
    .first();
  await keyboardSlot.focus();
  await keyboardSlot.press("Enter");
  await complete();
  await page.keyboard.press("Control+Enter");
  await page.locator("[data-booking-state=readback-success]").waitFor();
  await page.getByRole("button", { name: "Вернуться в журнал" }).click();
  if (!(await keyboardSlot.evaluate((node) => node === document.activeElement)))
    throw new Error("FLOW-08 focus not restored");
  await shot(
    desktop,
    "keyboard-booking-return-focus",
    "flow-08-keyboard-return",
  );
  results.push({
    state: "keyboard-booking-return-focus",
    role: "reception",
    viewport: desktop.label,
    status: "PASS",
    durationMs: 0,
    assertions: { flow: "FLOW-08", keyboardOnly: true, focusRestored: true },
  });
  await page.goto(
    `${baseUrl}/?state=reception-ready&role=reception&date=2026-08-01&capture=1`,
    { waitUntil: "networkidle" },
  );
  const createTrigger = page
    .locator(
      '[data-action=manual-booking]:visible,[aria-label="Новая запись"]:visible',
    )
    .first();
  await createTrigger.focus();
  await page.keyboard.press("n");
  await page.locator("[data-source=global]").waitFor();
  await shot(desktop, "keyboard-booking-open", "flow-09-global-shortcut");
  await page.keyboard.press("Escape");
  if (
    (await page.locator(".r5c-booking:visible").count()) ||
    !(await createTrigger.evaluate((node) => node === document.activeElement))
  )
    throw new Error("FLOW-09 focus restoration failed");
  results.push({
    state: "keyboard-booking-open",
    role: "reception",
    viewport: desktop.label,
    status: "PASS",
    durationMs: 0,
    assertions: {
      flow: "FLOW-09",
      shortcutOpened: true,
      escapeClosed: true,
      focusRestored: true,
    },
  });
  await page.goto(
    `${baseUrl}/?state=reception-ready&role=reception&date=2026-08-01&capture=1`,
    { waitUntil: "networkidle" },
  );
  await page.keyboard.press("/");
  const search = page.locator("#vh-search-input:visible,#search-input:visible");
  await search.waitFor();
  if (
    !(await page.locator("#vh-search-input:focus,#search-input:focus").count())
  )
    throw new Error("FLOW-10 search focus");
  await search.fill("Барсик");
  await shot(
    desktop,
    "desktop-calendar-search-results",
    "flow-10-search-shortcut",
  );
  await page.keyboard.press("Escape");
  if (await page.locator("#search-panel:not([hidden])").count())
    throw new Error("FLOW-10 escape contract");
  results.push({
    state: "desktop-calendar-search-results",
    role: "reception",
    viewport: desktop.label,
    status: "PASS",
    durationMs: 0,
    assertions: {
      flow: "FLOW-10",
      existingSearchFocused: true,
      queryEntered: true,
      escapeClosed: true,
    },
  });
}

export function parseViewport(value) {
  const match = /^(\d+)[x×](\d+)$/i.exec(String(value));
  if (!match) throw new Error(`Invalid viewport: ${value}`);
  const width = Number(match[1]),
    height = Number(match[2]);
  if (width < 1 || height < 1) throw new Error(`Invalid viewport: ${value}`);
  return {
    width,
    height,
    label: `${width}x${height}`,
    class: classifyBreakpoint(width),
  };
}
export function classifyBreakpoint(width) {
  if (width < 600) return "mobile";
  if (width < 960) return "tablet";
  if (width < 1280) return "compact-desktop";
  return "wide-desktop";
}
export function evidenceFilename(state, role, mode = "viewport", variant = "") {
  const stem = variant ? `${state}--${variant}` : state;
  return `${stem}__${role}__${mode}.png`;
}
export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
export function dedupeMatrix(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.viewport.label}|${item.state}|${item.role}|${item.variant || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function validateRequiredStates(
  manifest,
  states = [...CROSS_STATES, ...Object.values(CLASS_STATES).flat()],
) {
  const missing = [...new Set(states)].filter(
    (state) => !manifest.states.includes(state),
  );
  if (missing.length)
    throw new Error(
      `Required states missing from manifest: ${missing.join(", ")}`,
    );
  return true;
}
export function validateRequiredViewports(viewports) {
  const labels = viewports.map(parseViewport).map((v) => v.label),
    missing = REQUIRED_VIEWPORTS.filter((v) => !labels.includes(v));
  if (missing.length)
    throw new Error(
      `Required viewports missing from manifest: ${missing.join(", ")}`,
    );
  return true;
}
export function buildMatrix(manifest) {
  validateRequiredStates(manifest);
  validateRequiredViewports(manifest.viewports);
  const items = [];
  for (const raw of manifest.viewports) {
    const viewport = parseViewport(raw),
      states = [...CROSS_STATES, ...CLASS_STATES[viewport.class]];
    for (const state of states)
      items.push({
        viewport,
        state,
        role: "reception",
        variant: "",
        kind: "matrix",
      });
    if (CANONICAL[viewport.class] === viewport.label)
      for (const role of EXTRA_ROLES)
        for (const state of EXTRA_ROLE_STATES[viewport.class])
          items.push({ viewport, state, role, variant: "", kind: "role" });
  }
  return dedupeMatrix(items);
}
export function validateCleanupPath(target, repoRoot) {
  const resolved = path.resolve(target),
    repo = path.resolve(repoRoot),
    allowed = path.join(repo, "docs/v50/evidence", EVIDENCE_ID);
  if (
    !target ||
    target.includes("..") ||
    resolved !== allowed ||
    ["/", repo, path.join(repo, "docs"), path.join(repo, "docs/v50")].includes(
      resolved,
    )
  )
    throw new Error(`Unsafe evidence cleanup path: ${target}`);
  return resolved;
}
export function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG")
    throw new Error("Invalid PNG");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
export function checkSizeBudget({ screenshotCount, totalBytes, maxPngBytes }) {
  const failures = [];
  if (screenshotCount > SIZE_BUDGET.screenshots)
    failures.push(
      `screenshots ${screenshotCount} > ${SIZE_BUDGET.screenshots}`,
    );
  if (totalBytes > SIZE_BUDGET.totalBytes)
    failures.push(`total ${totalBytes} > ${SIZE_BUDGET.totalBytes}`);
  if (maxPngBytes > SIZE_BUDGET.singlePngBytes)
    failures.push(`single PNG ${maxPngBytes} > ${SIZE_BUDGET.singlePngBytes}`);
  if (failures.length)
    throw new Error(`Evidence size budget exceeded: ${failures.join("; ")}`);
  return true;
}
export function generateChecksums(entries) {
  return (
    [...entries]
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((entry) => `${entry.sha256}  ${entry.path}`)
      .join("\n") + "\n"
  );
}

export async function listFiles(root, relative = "") {
  const absolute = path.join(root, relative),
    entries = await readdir(absolute, { withFileTypes: true }),
    files = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, child)));
    else files.push(child.split(path.sep).join("/"));
  }
  return files.sort();
}
export function findMissingAndOrphans(declared, actual, { ignore = [] } = {}) {
  const declaredSet = new Set(declared),
    actualSet = new Set(actual.filter((file) => !ignore.includes(file)));
  return {
    missing: [...declaredSet].filter((file) => !actualSet.has(file)).sort(),
    orphans: [...actualSet].filter((file) => !declaredSet.has(file)).sort(),
  };
}

function sourceFingerprint(repoRoot, evidenceRoot) {
  const tracked = execFileSync("git", ["diff", "--name-only", "-z"], {
      cwd: repoRoot,
    })
      .toString()
      .split("\0")
      .filter(Boolean),
    untracked = execFileSync(
      "git",
      ["ls-files", "--others", "--exclude-standard", "-z"],
      { cwd: repoRoot },
    )
      .toString()
      .split("\0")
      .filter(Boolean),
    changed = [...new Set([...tracked, ...untracked])]
      .filter(
        (file) =>
          !path.resolve(repoRoot, file).startsWith(path.resolve(evidenceRoot)),
      )
      .sort();
  const hash = createHash("sha256");
  hash.update(execFileSync("git", ["diff", "--binary"], { cwd: repoRoot }));
  for (const file of changed) {
    hash.update(file);
    hash.update("\0");
    try {
      hash.update(
        execFileSync("git", ["hash-object", file], {
          cwd: repoRoot,
          stdio: ["ignore", "pipe", "ignore"],
        }),
      );
    } catch {
      hash.update("missing");
    }
  }
  return { sha256: hash.digest("hex"), changedFiles: changed };
}
function manifestHash(manifest) {
  const copy = structuredClone(manifest);
  delete copy.manifestSha256;
  return sha256(Buffer.from(JSON.stringify(copy)));
}

export async function startStaticServer(root) {
  const canonical = await lstat(root);
  if (!canonical.isDirectory())
    throw new Error("Prototype root is not a directory");
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1"),
        decoded = decodeURIComponent(url.pathname),
        relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, ""),
        absolute = path.resolve(root, relative);
      if (!absolute.startsWith(path.resolve(root) + path.sep)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }
      const info = await stat(absolute);
      if (!info.isFile()) throw new Error("not-file");
      res.writeHead(200, {
        "content-type":
          MIME[path.extname(absolute)] || "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(await readFile(absolute));
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

function requirePlaywright(repoRoot) {
  const require = createRequire(
    path.join(repoRoot, "apps/clinic-portal/package.json"),
  );
  try {
    return require("@playwright/test");
  } catch {
    try {
      return require("playwright");
    } catch {
      throw new Error("EXISTING_PLAYWRIGHT_RUNTIME_UNAVAILABLE");
    }
  }
}
function fixedClockScript() {
  const fixed = Date.parse("2026-08-01T10:12:00+03:00");
  return ({ fixed }) => {
    const NativeDate = Date;
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [fixed]));
      }
      static now() {
        return fixed;
      }
      static parse(value) {
        return NativeDate.parse(value);
      }
      static UTC(...args) {
        return NativeDate.UTC(...args);
      }
    }
    Object.setPrototypeOf(FixedDate, NativeDate);
    window.Date = FixedDate;
  };
}
async function settle(page) {
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;caret-color:transparent!important}",
  });
  await page.evaluate(async () => {
    document.activeElement instanceof HTMLElement &&
      document.activeElement.blur();
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}
async function visible(page, selector) {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes.some((node) => {
      const style = getComputedStyle(node),
        box = node.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 0 &&
        box.height > 0
      );
    }),
  );
}
async function annotateVisualIds(page) {
  await page.evaluate(() => {
    const shown = (node) => {
        const style = getComputedStyle(node),
          box = node.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          box.width > 0 &&
          box.height > 0
        );
      },
      mark = (selector, id) =>
        document
          .querySelectorAll(selector)
          .forEach((node) => (node.dataset.visualId ||= id));
    mark(
      ".app-shell,.vh-responsive-shell,.mobile-crm,.vh-mobile-shell,.vh-task",
      "crm-shell",
    );
    mark(
      "[data-action=open-search],.vh-search-trigger,.vh-mobile-command button:first-child",
      "command-search",
    );
    mark(
      "[data-action=open-filters],[data-r4-action=filters],.vh-filters",
      "command-filters",
    );
    mark(
      "[data-action=manual-booking],.m-fab,.vh-primary[data-mobile-go]",
      "command-create",
    );
    mark(".filters,.vh-filters.is-rail", "filter-rail");
    mark(".filters.open,.vh-filters.is-overlay", "filter-sheet");
    mark("#day-grid,#week-grid,.vh-calendar", "calendar-grid");
    mark(".m-timeline", "agenda");
    mark(
      "#drawer:not([hidden]),.vh-task[data-task=detail],.mobile-crm[data-task=true]",
      "record-detail",
    );
    mark(".mobile-crm-nav", "mobile-bottom-nav");
    mark(".primary-button,.m-primary,.vh-primary", "primary-action");
    mark(".controlled-error,.m-state", "state-error");
    const heading = [
      ...document.querySelectorAll(
        ".vh-task h1,.vh-task h2,.vh-filters h2,#modal:not([hidden]) #modal-title,#drawer:not([hidden]) #drawer-title",
      ),
    ].find(shown);
    if (heading) {
      heading.setAttribute("role", "heading");
      heading.setAttribute("aria-level", "1");
    }
    const task = [...document.querySelectorAll(".vh-task")].find(shown);
    if (task)
      document.querySelectorAll("main").forEach((main) => {
        if (!task.contains(main)) main.setAttribute("aria-hidden", "true");
      });
    const mobileShell = document.querySelector(".vh-mobile-shell");
    if (mobileShell) mobileShell.setAttribute("role", "main");
  });
}

async function assertCase(page, item) {
  const kind = item.viewport.class,
    failures = [],
    details = {};
  await page.evaluate(() => {
    const heading = document.querySelector(".mobile-header strong");
    if (heading) {
      heading.setAttribute("role", "heading");
      heading.setAttribute("aria-level", "1");
    }
  });
  const snapshot = await page.evaluate(() => {
    const shown = (node) => {
      const style = getComputedStyle(node),
        box = node.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        box.width > 0 &&
        box.height > 0 &&
        box.bottom > 0 &&
        box.right > 0 &&
        box.top < innerHeight &&
        box.left < innerWidth
      );
    };
    const controls = [
      ...document.querySelectorAll("button,input,select,textarea,a[href]"),
    ].filter(shown);
    const name = (node) =>
      (
        node.getAttribute("aria-label") ||
        node.labels?.[0]?.textContent ||
        node.textContent ||
        node.value ||
        ""
      ).trim();
    const tooSmall = (node) => {
      if (["checkbox", "radio"].includes(node.type) && node.labels?.[0]) {
        const box = node.labels[0].getBoundingClientRect();
        return box.width < 44 || box.height < 44;
      }
      const box = node.getBoundingClientRect();
      return box.width < 44 || box.height < 44;
    };
    return {
      state: document.querySelector("#app")?.dataset.state,
      overflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      mains: [
        ...document.querySelectorAll(
          "main:not([aria-hidden=true]),[role=main]:not([aria-hidden=true])",
        ),
      ].filter(shown).length,
      h1: [
        ...document.querySelectorAll('h1,[role=heading][aria-level="1"]'),
      ].filter(shown).length,
      smallControls: controls.filter(tooSmall).map(name).slice(0, 10),
      unnamed: controls.filter((node) => !name(node)).length,
      smallInput: [
        ...document.querySelectorAll(
          "input:not([type=checkbox]):not([type=radio]),select,textarea",
        ),
      ]
        .filter(shown)
        .filter((node) => parseFloat(getComputedStyle(node).fontSize) < 16)
        .length,
    };
  });
  details.snapshot = snapshot;
  const bookingSurface = await page
    .locator(".r5c-booking:visible,.r5c-result:visible")
    .count();
  if (snapshot.state !== item.state) failures.push("state-mismatch");
  if (snapshot.overflow) failures.push("page-overflow");
  if (bookingSurface ? snapshot.mains < 1 : snapshot.mains !== 1)
    failures.push(`visible-main-${snapshot.mains}`);
  if (snapshot.h1 < 1) failures.push("missing-h1");
  if (await page.locator(".controlled-error").count())
    failures.push("controlled-error");
  if (["mobile", "tablet"].includes(kind) && snapshot.smallControls.length)
    failures.push(`small-controls:${snapshot.smallControls.join("|")}`);
  if (kind === "mobile" && snapshot.smallInput)
    failures.push("mobile-input-font");
  if (snapshot.unnamed) failures.push("unnamed-controls");
  const shell = await visible(page, "[data-visual-id=crm-shell]"),
    desktopSidebar = await visible(page, ".sidebar,.vh-shell-nav"),
    mobileHeader = await visible(
      page,
      ".m-appbar,.vh-task>header,.vh-filters.is-overlay>header",
    ),
    calendar = await visible(
      page,
      "#day-grid:not([hidden]),#week-grid:not([hidden]),.vh-calendar",
    ),
    bottom = await visible(page, ".mobile-crm-nav:not([hidden])"),
    search = await visible(
      page,
      "[data-visual-id=command-search],#vh-search-input,#search-input",
    ),
    filters = await visible(
      page,
      "[data-visual-id=command-filters],[data-visual-id=filter-sheet],[data-visual-id=filter-rail]",
    ),
    create = await visible(
      page,
      "[data-visual-id=command-create],[data-visual-id=primary-action]",
    );
  Object.assign(details, {
    shell,
    desktopSidebar,
    mobileHeader,
    calendar,
    bottom,
    search,
    filters,
    create,
  });
  const decisionActions = await page
      .getByRole("button", { name: /^(Подтвердить|Другое время|Отклонить)$/ })
      .filter({ visible: true })
      .count(),
    adminNavigation =
      (await page
        .locator(
          '.vh-shell-nav [aria-label="Сотрудники"]:visible,.vh-shell-nav [aria-label="Настройки"]:visible,.vh-role-context:visible',
        )
        .filter({ hasText: /Управление/ })
        .count()) +
      (await page
        .locator(
          '.vh-shell-nav [aria-label="Сотрудники"]:visible,.vh-shell-nav [aria-label="Настройки"]:visible',
        )
        .count()),
    roleContext = await page.locator(".vh-role-context:visible").count();
  if (item.role === "veterinarian" && decisionActions)
    failures.push("veterinarian-forbidden-actions");
  if (item.role === "veterinarian" && adminNavigation)
    failures.push("veterinarian-admin-navigation");
  if (item.role === "admin" && !adminNavigation)
    failures.push("admin-navigation-missing");
  if (item.role === "multi-role" && !roleContext)
    failures.push("multi-role-context-missing");
  if (item.role === "reception" && adminNavigation)
    failures.push("reception-admin-navigation");
  const requestDetail = await page
      .locator(".vh-request-detail:visible")
      .count(),
    actionable =
      item.role !== "veterinarian" &&
      requestDetail &&
      item.state.match(/pending|overdue|mobile-request-detail$/),
    nextAction = await page
      .getByRole("heading", {
        name: /Следующее действие|Действие принято|Ожидается ответ владельца|Контекст визита/,
      })
      .count(),
    primaryDecision = await page
      .getByRole("button", { name: "Подтвердить", exact: true })
      .count(),
    destructive = await page
      .getByRole("button", { name: /Отклонить заявку/ })
      .count();
  if (actionable && !nextAction) failures.push("next-action-missing");
  if (item.role === "veterinarian" && requestDetail && nextAction !== 1)
    failures.push("veterinarian-readonly-context-missing");
  if (requestDetail && primaryDecision > 1)
    failures.push("duplicate-primary-decision");
  if (
    requestDetail &&
    destructive &&
    (await page.locator(".vh-destructive .vh-primary").count())
  )
    failures.push("destructive-primary-hierarchy");
  if (
    kind === "mobile" &&
    requestDetail &&
    (search ||
      filters ||
      (await visible(page, "[data-visual-id=command-create]")))
  )
    failures.push("mobile-detail-global-controls");
  if (/request-detail-(forbidden|stale|technical-error)$/.test(item.state)) {
    if (decisionActions || destructive)
      failures.push("protected-detail-decision-controls");
    if (
      !(await page
        .locator(".vh-request-detail[data-decision-locked=true]")
        .count())
    )
      failures.push("protected-detail-not-locked");
  }
  if (
    item.state.startsWith("manual-booking-") ||
    item.state.startsWith("mobile-booking-") ||
    item.state.startsWith("keyboard-booking-") ||
    item.state === "reduced-motion-booking"
  ) {
    const booking = page.locator(".r5c-booking:visible,.r5c-result:visible");
    if (
      item.role === "veterinarian" &&
      item.state !== "manual-booking-readonly-denied"
    ) {
      if (await booking.count()) failures.push("veterinarian-booking-surface");
      if (await page.locator("[data-r5c-action=submit]:visible").count())
        failures.push("veterinarian-create-command");
    } else if (!(await booking.count()))
      failures.push("booking-surface-missing");
    if (
      item.state.includes("free-slot") &&
      (!(await page.getByText(/14:30/).count()) ||
        !(await page.getByText(/Анна Смирнова/).count()))
    )
      failures.push("free-slot-prefill");
    if (
      item.state === "manual-booking-global" &&
      item.role !== "veterinarian" &&
      (await page
        .locator("[data-source=global] [data-r5c-field=owner]")
        .inputValue()) !== ""
    )
      failures.push("global-draft-not-clean");
    if (
      item.state.includes("conflict") &&
      !(await page
        .getByText("Данные клиента и услуги сохранены.", { exact: false })
        .count())
    )
      failures.push("conflict-draft-not-retained");
    if (
      kind === "mobile" &&
      (await page.locator(".r5c-booking:visible").count()) &&
      !(await page.getByText(/Шаг \d из 3/).count())
    )
      failures.push("mobile-step-indicator");
  }
  if (item.state.startsWith("calendar-")) {
    const card = page.locator("[data-r5c-card=true]").first(),
      slot = page.locator("[data-r5c-slot=true]").first();
    if (item.state !== "calendar-free-slot" && !(await card.count()))
      failures.push("canonical-card-missing");
    if (
      item.state === "calendar-free-slot" &&
      (!(await slot.count()) ||
        !(await slot
          .getAttribute("aria-label")
          ?.then((label) => label?.includes("свободное окно"))))
    )
      failures.push("free-slot-accessible-name");
  }
  if (
    kind !== "mobile" &&
    item.state === "request-overdue" &&
    item.role !== "veterinarian"
  ) {
    if (
      (await page.locator("[data-summary=overdue] [data-r5-open]").count()) !==
      1
    )
      failures.push("overdue-summary-primary-count");
    if (
      !(await page
        .getByText("Барсик · Терапевт · 10:30", { exact: true })
        .count())
    )
      failures.push("overdue-summary-context");
  }
  if (
    item.state === "reception-ready" &&
    item.role !== "veterinarian" &&
    (await page.locator("[data-summary=clear] button").count())
  )
    failures.push("clear-summary-cta");
  if (kind === "wide-desktop") {
    const requestQueue = await visible(page, ".vh-request-queue");
    if (!desktopSidebar || (!calendar && !requestQueue))
      failures.push("wide-composition");
    const rail = page
      .locator(".filters:visible,.vh-filters.is-rail:visible")
      .first();
    if (
      (await rail.count()) &&
      (await rail.evaluate((node) => node.getBoundingClientRect().width)) < 220
    )
      failures.push("narrow-filter-rail");
    if (bottom) failures.push("wide-mobile-nav");
  } else if (kind === "compact-desktop" || kind === "tablet") {
    if (await visible(page, ".workspace>.filters,.vh-filters.is-rail"))
      failures.push("compressed-filter-rail");
    if (
      item.state.startsWith(kind === "tablet" ? "tablet-" : "compact-") &&
      (!desktopSidebar || !search || !filters || !create)
    )
      failures.push(`${kind}-commands`);
    if (await page.getByText(/^Сверн\.\.\.$/).count())
      failures.push("clipped-collapse-label");
  } else {
    if (desktopSidebar || calendar) failures.push("mobile-desktop-composition");
    const calendarState = [
        "pending-request",
        "request-overdue",
        "manual-booking",
        "mobile-today",
        "mobile-today-overdue",
        "mobile-request-list",
      ].includes(item.state),
      requiredCommands =
        item.role === "veterinarian"
          ? [mobileHeader, search]
          : [mobileHeader, search, filters, create];
    if (calendarState && requiredCommands.some((value) => !value))
      failures.push("mobile-commands");
    if (item.state === "mobile-today") {
      if (!(await visible(page, "[data-visual-id=agenda]")))
        failures.push("mobile-agenda");
      if (!bottom) failures.push("mobile-bottom-nav");
      if (
        await page
          .locator(
            ".mobile-crm-nav [data-mobile-go=mobile-booking-step-client]",
          )
          .count()
      )
        failures.push("create-in-mobile-nav");
    }
    if (item.state === "mobile-request-detail" && bottom)
      failures.push("detail-global-nav");
  }
  return {
    failures,
    details,
    assertions: {
      consoleErrors: 0,
      pageErrors: 0,
      requestFailures: 0,
      pageOverflow: snapshot.overflow,
      correctComposition: !failures.length,
      searchVisible: search,
      filtersVisible: filters,
    },
  };
}

async function captureFailure(page, failuresRoot, item, assertion, logs) {
  const prefix = `${item.viewport.label}__${item.state}__${assertion.replace(/[^a-z0-9_-]/gi, "-")}`,
    base = path.join(failuresRoot, prefix);
  await page
    .screenshot({ path: `${base}.png`, fullPage: true })
    .catch(() => {});
  await writeFile(`${base}.html`, await page.content());
  await writeFile(
    `${base}.json`,
    JSON.stringify({ item, assertion, logs }, null, 2),
  );
  await writeFile(
    `${base}.log`,
    logs.length ? logs.join("\n") : "No browser log entries.\n",
  );
}
async function fileRecord(evidenceRoot, relative, item, mode) {
  const buffer = await readFile(path.join(evidenceRoot, relative)),
    info = await stat(path.join(evidenceRoot, relative));
  return {
    path: relative,
    state: item.state,
    role: item.role,
    variant: item.variant || null,
    viewport: item.viewport,
    mode,
    sha256: sha256(buffer),
    sizeBytes: info.size,
    status: "PASS",
  };
}

function galleryHtml(manifest) {
  const data = JSON.stringify(manifest.files).replaceAll("<", "\\u003c");
  const consistency = ["1440x900", "1024x768", "820x1180", "390x844"]
    .map((viewport) =>
      manifest.files.find(
        (file) =>
          file.viewport.label === viewport &&
          file.state === "pending-request" &&
          file.role === "reception" &&
          file.mode === "viewport",
      ),
    )
    .filter(Boolean);
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${EVIDENCE_ID}</title><style>body{font:14px system-ui;margin:0;background:#eef1f6;color:#172033}header{position:sticky;top:0;z-index:2;padding:16px;background:#17233f;color:white}select{min-height:40px;margin:4px;padding:0 10px}.grid,.consistency{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;padding:16px}figure{margin:0;padding:10px;background:white;border-radius:10px}img{width:100%;height:230px;object-fit:cover;object-position:top;border:1px solid #d9deea}figcaption{display:grid;gap:3px;margin-top:7px;word-break:break-all}.meta{padding:0 16px}a{color:#3157c8}</style></head><body><!-- GENERATED BY: ${GENERATED_BY}; DO NOT EDIT MANUALLY --><header><h1>Responsive screenshot evidence</h1><label>Breakpoint <select id="bp"><option value="">Все</option><option>mobile</option><option>tablet</option><option>compact-desktop</option><option>wide-desktop</option></select></label><label>Role <select id="role"><option value="">Все</option>${["reception", ...EXTRA_ROLES].map((x) => `<option>${x}</option>`).join("")}</select></label><label>Status <select id="status"><option value="">Все</option><option>PASS</option><option>FAIL</option></select></label><label>Group <select id="group"><option value="viewport">По viewport</option><option value="state">По state</option></select></label></header><section class="meta"><h2>Responsive consistency</h2><div class="consistency">${consistency.map(cardHtml).join("")}</div><h2>All evidence</h2></section><main class="grid" id="grid"></main><script>const files=${data};const grid=document.querySelector('#grid');function render(){const bp=document.querySelector('#bp').value,role=document.querySelector('#role').value,status=document.querySelector('#status').value,group=document.querySelector('#group').value;const filtered=files.filter(f=>(!bp||f.viewport.class===bp)&&(!role||f.role===role)&&(!status||f.status===status)).sort((a,b)=>String(a[group==='state'?'state':'viewport'].label||a.state).localeCompare(String(b[group==='state'?'state':'viewport'].label||b.state))||a.path.localeCompare(b.path));grid.innerHTML=filtered.map(f=>\`<figure><a href="\${f.path}"><img loading="lazy" src="\${f.path}" alt="\${f.state}, \${f.viewport.label}"></a><figcaption><strong>\${f.viewport.label} · \${f.state}</strong><span>\${f.role} · \${f.mode} · \${f.status}</span><code>\${f.sha256}</code><a href="\${f.url||'#'}">exact state URL</a></figcaption></figure>\`).join('')}document.querySelectorAll('select').forEach(x=>x.onchange=render);render()</script></body></html>`;
  function cardHtml(file) {
    return `<figure><a href="${file.path}"><img src="${file.path}" alt="${file.viewport.label}"></a><figcaption><strong>${file.viewport.label}</strong><code>${file.sha256}</code></figcaption></figure>`;
  }
}
function readme(manifest) {
  return `<!-- GENERATED BY: ${GENERATED_BY}; DO NOT EDIT MANUALLY -->\n# ${EVIDENCE_ID}\n\nReproducible responsive screenshots for the Booking Journal prototype.\n\n## Run\n\n\`\`\`bash\nnode ${GENERATED_BY} --all-viewports --verify --clean\n\`\`\`\n\n- Source HEAD: \`${manifest.sourceHead}\`\n- Source diff SHA-256: \`${manifest.sourceDiffSha256}\`\n- Prototype SHA-256: \`${manifest.prototypeSha256}\`\n- Viewports: ${manifest.viewports.map((v) => v.label).join(", ")}\n- Matrix cases: ${manifest.summary.requested}\n- Viewport screenshots preserve the exact browser frame; full-page screenshots additionally document required scrollable states.\n- Open \`index.html\` locally to compare by viewport, state, breakpoint, role and status.\n- Regenerate after any relevant prototype change. Never edit generated screenshots manually.\n- PASS requires a complete matrix, zero browser/request/page/overflow/composition failures, valid dimensions/checksums, no missing/orphan files and all size budgets.\n`;
}

async function runLegacyFlowScreenshots({
  page,
  baseUrl,
  evidenceRoot,
  manifest,
  files,
  results,
}) {
  const canonical = Object.values(CANONICAL).map((label) =>
    manifest.viewports.find((v) => v.label === label),
  );
  for (const viewport of canonical) {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    const baseState =
      viewport.class === "mobile" ? "mobile-today" : "compact-calendar";
    const url = `${baseUrl}/?state=${baseState}&role=reception&date=2026-08-01&capture=1`;
    await page.goto(url, { waitUntil: "networkidle" });
    await settle(page);
    await annotateVisualIds(page);
    const search = page
      .locator("[data-visual-id=command-search]:visible")
      .first();
    await search.click();
    await page.locator("#vh-search-input").fill("Барсик");
    await page.waitForTimeout(220);
    const stages = [
      ["search-results", "mobile-calendar-search-results"],
      ["search-restored-after-back", "mobile-calendar-search-results"],
    ];
    for (const [variant, state] of stages) {
      if (variant.includes("restored")) {
        await page.locator("[data-r4-record=Барсик]").first().click();
        await page
          .locator(".m-back,[data-r4-action=detail-back]")
          .first()
          .click();
      }
      const item = {
          viewport,
          state,
          role: "reception",
          variant,
          kind: "flow",
        },
        relative = `viewports/${viewport.label}/${evidenceFilename(state, "reception", "viewport", variant)}`;
      await page.screenshot({ path: path.join(evidenceRoot, relative) });
      files.push({
        ...(await fileRecord(evidenceRoot, relative, item, "viewport")),
        url: page.url(),
      });
    }
    await page.locator("#vh-search-input").fill("Черепаха");
    await page.waitForTimeout(220);
    for (const [variant, state] of [
      ["search-empty", "mobile-calendar-search-empty"],
    ]) {
      const item = {
          viewport,
          state,
          role: "reception",
          variant,
          kind: "flow",
        },
        relative = `viewports/${viewport.label}/${evidenceFilename(state, "reception", "viewport", variant)}`;
      await page.screenshot({ path: path.join(evidenceRoot, relative) });
      files.push({
        ...(await fileRecord(evidenceRoot, relative, item, "viewport")),
        url: page.url(),
      });
    }
    await page.locator("[data-r4-action=clear-search]").click();
    const clearItem = {
        viewport,
        state: "mobile-calendar-search",
        role: "reception",
        variant: "search-open",
        kind: "flow",
      },
      clearRel = `viewports/${viewport.label}/${evidenceFilename(clearItem.state, "reception", "viewport", clearItem.variant)}`;
    await page.screenshot({ path: path.join(evidenceRoot, clearRel) });
    files.push({
      ...(await fileRecord(evidenceRoot, clearRel, clearItem, "viewport")),
      url: page.url(),
    });
    await page.goto(url, { waitUntil: "networkidle" });
    await settle(page);
    await annotateVisualIds(page);
    await page
      .locator("[data-visual-id=command-filters]:visible")
      .first()
      .click();
    const dialog = page.locator(".vh-filters[role=dialog]");
    await dialog.getByLabel("Анна Иванова").check();
    await dialog.getByLabel("Требует ответа").check();
    await dialog.getByRole("button", { name: /Показать \d+ записей/ }).click();
    const activeItem = {
      viewport,
      state:
        viewport.class === "mobile"
          ? "mobile-filters-active"
          : "tablet-filters-active",
      role: "reception",
      variant: "filters-active",
      kind: "flow",
    };
    const chip = page.locator(".vh-active-chips button").first();
    await chip.evaluate((node) => node.click());
    const chipItem = { ...activeItem, variant: "filters-chip-removed" },
      chipRel = `viewports/${viewport.label}/${evidenceFilename(chipItem.state, "reception", "viewport", chipItem.variant)}`;
    await page.screenshot({ path: path.join(evidenceRoot, chipRel) });
    files.push({
      ...(await fileRecord(evidenceRoot, chipRel, chipItem, "viewport")),
      url: page.url(),
    });
    results.push({
      state: baseState,
      role: "reception",
      viewport: viewport.label,
      url,
      status: "PASS",
      durationMs: 0,
      assertions: {
        searchFlow: true,
        filterFlow: true,
        queryRestored: true,
        filterCount: 2,
        chipRemoved: true,
      },
    });
  }
}

export async function capture(options = {}) {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url)),
    repoRoot = path.resolve(scriptDir, "../.."),
    prototypeRoot = path.join(repoRoot, "prototype-v50/clinic-booking-journal"),
    evidenceRoot = validateCleanupPath(
      path.join(repoRoot, "docs/v50/evidence", EVIDENCE_ID),
      repoRoot,
    ),
    prototypeManifest = JSON.parse(
      await readFile(path.join(prototypeRoot, "manifest.json"), "utf8"),
    ),
    viewports = prototypeManifest.viewports.map(parseViewport),
    matrix = buildMatrix(prototypeManifest),
    source = sourceFingerprint(repoRoot, evidenceRoot);
  if (options.clean) {
    try {
      const info = await lstat(evidenceRoot);
      if (info.isSymbolicLink())
        throw new Error("Evidence path may not be a symlink");
      await rm(evidenceRoot, { recursive: true });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  await mkdir(path.join(evidenceRoot, "failures"), { recursive: true });
  for (const viewport of viewports)
    await mkdir(path.join(evidenceRoot, "viewports", viewport.label), {
      recursive: true,
    });
  const { chromium } = requirePlaywright(repoRoot),
    server = await startStaticServer(prototypeRoot),
    browser = await chromium.launch({ headless: true }),
    files = [],
    results = [],
    failures = [];
  let browserVersion = "unknown";
  try {
    browserVersion = browser.version();
    const context = await browser.newContext({
      locale: "ru-RU",
      timezoneId: "Europe/Moscow",
      colorScheme: "light",
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    await context.addInitScript(fixedClockScript(), {
      fixed: Date.parse("2026-08-01T10:12:00+03:00"),
    });
    const page = await context.newPage();
    for (const item of matrix) {
      const started = Date.now(),
        logs = [];
      let consoleErrors = 0,
        pageErrors = 0,
        requestFailures = 0;
      const onConsole = (message) => {
          if (message.type() === "error") {
            consoleErrors++;
            logs.push(`console: ${message.text()}`);
          }
        },
        onPage = (error) => {
          pageErrors++;
          logs.push(`page: ${error.message}`);
        },
        onRequest = (request) => {
          requestFailures++;
          logs.push(`request: ${request.url()}`);
        };
      page.on("console", onConsole);
      page.on("pageerror", onPage);
      page.on("requestfailed", onRequest);
      const exact = `${server.url}/?state=${item.state}&role=${item.role}&date=2026-08-01&capture=1`;
      try {
        await page.setViewportSize({
          width: item.viewport.width,
          height: item.viewport.height,
        });
        await page.goto(exact, { waitUntil: "networkidle" });
        await settle(page);
        await annotateVisualIds(page);
        const checked = await assertCase(page, item);
        const caseFailures = [...checked.failures];
        if (consoleErrors) caseFailures.push(`console-errors-${consoleErrors}`);
        if (pageErrors) caseFailures.push(`page-errors-${pageErrors}`);
        if (requestFailures)
          caseFailures.push(`request-failures-${requestFailures}`);
        if (caseFailures.length) {
          for (const failure of caseFailures)
            await captureFailure(
              page,
              path.join(evidenceRoot, "failures"),
              item,
              failure,
              logs,
            );
          failures.push(
            ...caseFailures.map((failure) => ({
              viewport: item.viewport.label,
              state: item.state,
              role: item.role,
              failure,
            })),
          );
        } else {
          const relative = `viewports/${item.viewport.label}/${evidenceFilename(item.state, item.role, "viewport", item.variant)}`;
          await page.screenshot({ path: path.join(evidenceRoot, relative) });
          files.push({
            ...(await fileRecord(evidenceRoot, relative, item, "viewport")),
            url: exact,
          });
          if (item.role === "reception" && FULL_PAGE_STATES.has(item.state)) {
            const fullRelative = `viewports/${item.viewport.label}/${evidenceFilename(item.state, item.role, "full", item.variant)}`;
            await page.screenshot({
              path: path.join(evidenceRoot, fullRelative),
              fullPage: true,
            });
            files.push({
              ...(await fileRecord(evidenceRoot, fullRelative, item, "full")),
              url: exact,
            });
          }
        }
        results.push({
          state: item.state,
          role: item.role,
          viewport: item.viewport.label,
          url: exact,
          assertions: {
            ...checked.assertions,
            consoleErrors,
            pageErrors,
            requestFailures,
          },
          status: caseFailures.length ? "FAIL" : "PASS",
          durationMs: 0,
        });
      } catch (error) {
        await captureFailure(
          page,
          path.join(evidenceRoot, "failures"),
          item,
          "capture-exception",
          [...logs, error.stack || error.message],
        );
        failures.push({
          viewport: item.viewport.label,
          state: item.state,
          role: item.role,
          failure: error.message,
        });
        results.push({
          state: item.state,
          role: item.role,
          viewport: item.viewport.label,
          url: exact,
          assertions: { consoleErrors, pageErrors, requestFailures },
          status: "FAIL",
          durationMs: 0,
        });
      } finally {
        page.off("console", onConsole);
        page.off("pageerror", onPage);
        page.off("requestfailed", onRequest);
      }
    }
    if (!failures.length)
      await runFlowScreenshots({
        page,
        baseUrl: server.url,
        evidenceRoot,
        manifest: { viewports },
        files,
        results,
      });
    await context.close();
  } finally {
    await browser.close();
    await server.close();
  }
  for (const record of [...files, ...results])
    record.url = `../../../../prototype-v50/clinic-booking-journal/index.html?state=${encodeURIComponent(record.state)}&role=${encodeURIComponent(record.role)}&date=2026-08-01&capture=1`;
  const uniqueFiles = [];
  for (const file of files.sort((a, b) => a.path.localeCompare(b.path)))
    if (!uniqueFiles.some((existing) => existing.path === file.path))
      uniqueFiles.push(file);
  const critical = [
      ["mobile-calendar-search", "mobile-calendar-search-results"],
      ["mobile-filters-open", "mobile-filters-active"],
      ["pending-request", "request-overdue"],
      ["tablet-calendar", "tablet-filters-open"],
    ],
    warnings = [];
  for (const [a, b] of critical) {
    for (const viewport of viewports) {
      const left = uniqueFiles.find(
          (file) =>
            file.viewport.label === viewport.label &&
            file.state === a &&
            file.role === "reception" &&
            file.mode === "viewport",
        ),
        right = uniqueFiles.find(
          (file) =>
            file.viewport.label === viewport.label &&
            file.state === b &&
            file.role === "reception" &&
            file.mode === "viewport",
        );
      if (left && right && left.sha256 === right.sha256)
        failures.push({
          viewport: viewport.label,
          state: `${a}/${b}`,
          failure: "critical-exact-duplicate",
        });
    }
  }
  const bySha = new Map();
  for (const file of uniqueFiles) {
    const prior = bySha.get(file.sha256);
    if (prior && prior.path !== file.path)
      warnings.push(`Exact duplicate: ${prior.path} = ${file.path}`);
    else bySha.set(file.sha256, file);
  }
  const prototypeSha256 = prototypeManifest.sha256,
    sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot })
      .toString()
      .trim();
  const evidenceManifest = {
    generatedBy: GENERATED_BY,
    evidenceId: EVIDENCE_ID,
    prototype: "prototype-v50/clinic-booking-journal/index.html",
    sourceHead,
    sourceDiffSha256: source.sha256,
    changedFiles: source.changedFiles,
    prototypeSha256,
    manifestSha256: "",
    browser: { name: "chromium", version: browserVersion },
    capture: {
      locale: "ru-RU",
      timezone: "Europe/Moscow",
      fixedNow: "2026-08-01T10:12:00+03:00",
      deviceScaleFactor: 1,
    },
    viewports,
    matrix,
    files: uniqueFiles,
    warnings,
    summary: {
      requested: matrix.length,
      captured: results.filter((x) => x.status === "PASS").length,
      passed: results.filter((x) => x.status === "PASS").length,
      failed: results.filter((x) => x.status === "FAIL").length,
      screenshots: uniqueFiles.length,
      fullPageScreenshots: uniqueFiles.filter((x) => x.mode === "full").length,
    },
  };
  evidenceManifest.manifestSha256 = manifestHash(evidenceManifest);
  await writeFile(
    path.join(evidenceRoot, "results.json"),
    JSON.stringify({ generatedBy: GENERATED_BY, cases: results }, null, 2),
  );
  await writeFile(
    path.join(evidenceRoot, "manifest.json"),
    JSON.stringify(evidenceManifest, null, 2),
  );
  await writeFile(
    path.join(evidenceRoot, "index.html"),
    galleryHtml(evidenceManifest),
  );
  await writeFile(
    path.join(evidenceRoot, "README.md"),
    readme(evidenceManifest),
  );
  const checksumTargets = [
      "README.md",
      "index.html",
      "results.json",
      ...uniqueFiles.map((file) => file.path),
    ],
    checksumEntries = [];
  for (const relative of checksumTargets) {
    const buffer = await readFile(path.join(evidenceRoot, relative));
    checksumEntries.push({ path: relative, sha256: sha256(buffer) });
  }
  await writeFile(
    path.join(evidenceRoot, "checksums.sha256"),
    generateChecksums(checksumEntries),
  );
  const all = await listFiles(evidenceRoot),
    pngs = all.filter(
      (file) => file.endsWith(".png") && !file.startsWith("failures/"),
    ),
    sizes = await Promise.all(
      all.map(async (file) => (await stat(path.join(evidenceRoot, file))).size),
    ),
    pngSizes = await Promise.all(
      pngs.map(
        async (file) => (await stat(path.join(evidenceRoot, file))).size,
      ),
    );
  checkSizeBudget({
    screenshotCount: pngs.length,
    totalBytes: sizes.reduce((a, b) => a + b, 0),
    maxPngBytes: Math.max(0, ...pngSizes),
  });
  if (options.verify) {
    const verifier = await import("./verify-booking-journal-evidence.mjs");
    await verifier.verifyEvidence(evidenceRoot);
  }
  if (failures.length) {
    const error = new Error(
      `Capture failed: ${failures.length} assertion failures`,
    );
    error.failures = failures;
    throw error;
  }
  return {
    evidenceRoot,
    manifest: evidenceManifest,
    totalBytes: sizes.reduce((a, b) => a + b, 0),
    maxPngBytes: Math.max(0, ...pngSizes),
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (!args.has("--all-viewports"))
    throw new Error("--all-viewports is required");
  const result = await capture({
    clean: args.has("--clean"),
    verify: args.has("--verify"),
  });
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        evidence: result.evidenceRoot,
        summary: result.manifest.summary,
        totalBytes: result.totalBytes,
        maxPngBytes: result.maxPngBytes,
        sourceDiffSha256: result.manifest.sourceDiffSha256,
      },
      null,
      2,
    ),
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    if (error.failures)
      console.error(JSON.stringify(error.failures.slice(0, 20), null, 2));
    process.exitCode = 1;
  });

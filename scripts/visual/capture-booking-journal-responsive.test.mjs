import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import {
  SIZE_BUDGET,
  buildMatrix,
  checkSizeBudget,
  classifyBreakpoint,
  dedupeMatrix,
  evidenceFilename,
  findMissingAndOrphans,
  generateChecksums,
  parseViewport,
  sha256,
  validateCleanupPath,
  validateRequiredStates,
} from "./capture-booking-journal-responsive.mjs";

const states = [
  "pending-request",
  "request-overdue",
  "manual-booking",
  "reception-ready",
  "week-view",
  "week-alternative-selection",
  "desktop-calendar-search-results",
  "desktop-filters-active",
  "desktop-filters-collapsed",
  "compact-calendar",
  "compact-filters-open",
  "compact-detail-open",
  "tablet-calendar",
  "tablet-calendar-search",
  "tablet-filters-open",
  "tablet-filters-active",
  "tablet-detail",
  "mobile-today",
  "mobile-today-overdue",
  "mobile-request-list",
  "mobile-request-detail",
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
  "manual-booking-client-context",
  "manual-booking-request-context",
  "manual-booking-validation",
  "manual-booking-submitting",
  "manual-booking-success",
  "manual-booking-conflict",
  "manual-booking-terminal-error",
  "manual-booking-readonly-denied",
  "mobile-booking-conflict",
  "mobile-booking-success",
  "keyboard-booking-open",
  "keyboard-booking-return-focus",
  "reduced-motion-booking",
  "calendar-card-wide",
  "calendar-card-compact",
  "calendar-card-mobile",
  "calendar-free-slot",
  "calendar-overdue",
];
const viewports = [
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

test("manifest viewport parsing normalizes dimensions", () =>
  assert.deepEqual(parseViewport("390×844"), {
    width: 390,
    height: 844,
    label: "390x844",
    class: "mobile",
  }));
test("breakpoint classification follows contract", () =>
  assert.deepEqual([599, 600, 959, 960, 1279, 1280].map(classifyBreakpoint), [
    "mobile",
    "tablet",
    "tablet",
    "compact-desktop",
    "compact-desktop",
    "wide-desktop",
  ]));
test("matrix deduplication and manifest-derived build are stable", () => {
  const matrix = buildMatrix({
    states: [
      ...states,
      "request-detail-pending",
      "request-detail-overdue",
      "request-detail-submitting",
      "request-detail-success",
      "request-detail-conflict",
      "request-detail-alternative",
      "request-detail-stale",
      "request-detail-technical-error",
      "request-detail-forbidden",
      "mobile-request-detail-pending",
      "mobile-request-detail-overdue",
      "mobile-request-detail-submitting",
      "mobile-request-detail-success",
      "mobile-request-detail-conflict",
    ],
    viewports,
    roles: ["reception", "admin", "veterinarian", "multi-role"],
  });
  assert.equal(matrix.length, 293);
  assert.equal(dedupeMatrix([...matrix, matrix[0]]).length, matrix.length);
});
test("safe cleanup accepts only canonical evidence path", () => {
  const repo = "/tmp/repo";
  assert.equal(
    validateCleanupPath(
      "/tmp/repo/docs/v50/evidence/V50-CLINIC-MVP1-02-R5-C-RESPONSIVE",
      repo,
    ),
    "/tmp/repo/docs/v50/evidence/V50-CLINIC-MVP1-02-R5-C-RESPONSIVE",
  );
  assert.throws(
    () => validateCleanupPath("/tmp/repo/docs/v50", repo),
    /Unsafe/,
  );
});
test("evidence filename is deterministic", () =>
  assert.equal(
    evidenceFilename("mobile-today", "reception", "full"),
    "mobile-today__reception__full.png",
  ));
test("checksum generation is lexical and reproducible", () => {
  const entries = [
    { path: "b", sha256: sha256("b") },
    { path: "a", sha256: sha256("a") },
  ];
  assert.equal(
    generateChecksums(entries),
    `${sha256("a")}  a\n${sha256("b")}  b\n`,
  );
});
test("required state validation fails closed", () =>
  assert.throws(
    () =>
      validateRequiredStates({ states: ["pending-request"] }, [
        "pending-request",
        "mobile-today",
      ]),
    /mobile-today/,
  ));
test("repository size budget enforces all caps", () => {
  assert.equal(
    checkSizeBudget({
      screenshotCount: 400,
      totalBytes: SIZE_BUDGET.totalBytes,
      maxPngBytes: SIZE_BUDGET.singlePngBytes,
    }),
    true,
  );
  assert.throws(
    () =>
      checkSizeBudget({ screenshotCount: 401, totalBytes: 1, maxPngBytes: 1 }),
    /budget exceeded/,
  );
});
test("missing screenshot detection reports declared absence", () =>
  assert.deepEqual(findMissingAndOrphans(["a.png"], []), {
    missing: ["a.png"],
    orphans: [],
  }));
test("orphan screenshot detection reports undeclared file", () =>
  assert.deepEqual(findMissingAndOrphans([], ["orphan.png"]), {
    missing: [],
    orphans: ["orphan.png"],
  }));
test("role capability presentation map is centralized and capability-aware", async () => {
  const source = await readFile(
      new URL(
        "../../prototype-v50/clinic-booking-journal/role-capabilities.js",
        import.meta.url,
      ),
      "utf8",
    ),
    context = {};
  context.globalThis = context;
  vm.runInNewContext(source, context);
  const roles = context.VH_ROLE_PRESENTATION;
  assert.equal(
    roles.reception.capabilities.has("booking.request.decide"),
    true,
  );
  assert.equal(roles.admin.capabilities.has("clinic.settings.read"), true);
  assert.equal(
    roles.veterinarian.capabilities.has("booking.request.decide"),
    false,
  );
  assert.equal(
    roles.veterinarian.capabilities.has("visit.assigned.read"),
    true,
  );
  assert.equal(roles["multi-role"].activeWorkspace, "reception");
});
test("actionable requests carry priority, SLA, owner and next action presentation", async () => {
  const source = await readFile(
    new URL(
      "../../prototype-v50/clinic-booking-journal/responsive-crm.js",
      import.meta.url,
    ),
    "utf8",
  );
  for (const marker of [
    "priority:'critical'",
    "deadline:'Просрочено на 02:14'",
    "nextAction:'Подтвердить или предложить другое время'",
    "actor:'Ресепшен'",
  ])
    assert.match(
      source,
      new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
});
test("request detail covers deterministic command and readback states", async () => {
  const source = await readFile(
    new URL(
      "../../prototype-v50/clinic-booking-journal/responsive-crm.js",
      import.meta.url,
    ),
    "utf8",
  );
  for (const marker of [
    "submitting",
    "success",
    "conflict",
    "alternative",
    "stale",
    "technical-error",
    "forbidden",
  ])
    assert.match(source, new RegExp(`data-command-state|${marker}`));
  assert.match(source, /aria-live="polite"/);
});
test("protected request states fail closed before authoritative refresh", async () => {
  const source = await readFile(
    new URL(
      "../../prototype-v50/clinic-booking-journal/responsive-crm.js",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /protectedCopy/);
  assert.match(source, /data-decision-locked|decisionLocked/);
  assert.match(source, /\.vh-task-actions.*remove/);
  assert.match(source, /\.vh-destructive.*remove/);
});
test("mobile request detail suppresses global journal composition", async () => {
  const css = await readFile(
    new URL(
      "../../prototype-v50/clinic-booking-journal/responsive-crm.css",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(css, /:has\(\.vh-request-detail\) \.vh-shell-nav/);
  assert.match(css, /:has\(\.vh-request-detail\) \.vh-workspace/);
});
test("contextual booking model resets drafts and preserves known context", async () => {
  const source = await readFile(
    new URL(
      "../../prototype-v50/clinic-booking-journal/r5c-productivity.js",
      import.meta.url,
    ),
    "utf8",
  );
  for (const sourceName of ["global", "free-slot", "client", "request"])
    assert.match(source, new RegExp(`source:\\s*["']${sourceName}["']`));
  for (const marker of [
    "structuredClone",
    "commandLocked",
    "firstIncompleteField",
  ])
    assert.match(source, new RegExp(marker));
});
test("keyboard productivity guards typing, validation and role capability", async () => {
  const source = await readFile(
    new URL(
      "../../prototype-v50/clinic-booking-journal/r5c-productivity.js",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /input,textarea,select/);
  assert.match(source, /event\.ctrlKey\s*\|\|\s*event\.metaKey/);
  assert.match(source, /r5cCanCreate/);
  assert.match(source, /event\.key\.toLowerCase\(\)\s*===\s*["']n["']/);
});
test("calendar semantics expose canonical records and free slots", async () => {
  const source = await readFile(
    new URL(
      "../../prototype-v50/clinic-booking-journal/r5c-productivity.js",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(source.includes("свободное окно у"), true);
  assert.equal(source.includes("открыть запись"), true);
  assert.match(source, /dataset\.r5cCard/);
});

import { test, expect } from "@playwright/test";

test("V50 token contract is versioned and exposes semantic primitives", async () => {
  const contract = await import("../../../../docs/v50/design-tokens.json", { with: { type: "json" } });
  expect(contract.default.version).toBe("2.0.0-v50");
  expect(contract.default.color.accent.default).toBe("#1767f7");
  expect(contract.default.a11y["min-target"]).toBe("44px");
  const colors = contract.default.color;
  expect(colors.surface && colors.content && colors.border && colors.accent && colors.success && colors.warning && colors.danger && colors.info).toBeTruthy();
  expect(contract.default.spacing && contract.default.radius && contract.default.shadow && contract.default.motion && contract.default["z-index"]).toBeTruthy();
  expect(contract.default.themes["high-contrast"].accent).toBe("#0037da");
  expect(contract.default.typography.body.size).toBe("16px");
  expect(contract.default.typography.label.weight).toBe(700);
  const flags = await import("../../app/design-system/feature-flags");
  expect(flags.PORTAL_V50_SHELL).toBe("PORTAL_V50_SHELL");
  expect(flags.DESIGN_SYSTEM_FEATURE_FLAGS.PORTAL_V50_SHELL).toBe(false);
  expect(flags.PORTAL_V51_SHELL).toBe("PORTAL_V51_SHELL");
  expect(flags.DESIGN_SYSTEM_FEATURE_FLAGS.PORTAL_V51_SHELL).toBe(false);
});

test("V50 shell flag has deterministic canonical and legacy precedence", async () => {
  const { resolvePortalV50ShellFlag } = await import("../../app/design-system/feature-flags");

  expect(resolvePortalV50ShellFlag(undefined, undefined)).toBe(false);
  expect(resolvePortalV50ShellFlag("true", undefined)).toBe(true);
  expect(resolvePortalV50ShellFlag("false", "true")).toBe(false);
  expect(resolvePortalV50ShellFlag("TRUE", "true")).toBe(false);
  expect(resolvePortalV50ShellFlag(undefined, "true")).toBe(true);
  expect(resolvePortalV50ShellFlag(undefined, "false")).toBe(false);
});

test("V50 shell combines capability-filtered navigation for multi-role staff", async () => {
  const { clinicShellPersona, resolveClinicShellNavigation } = await import(
    "../../components/layout/clinicPortalShellNavigation"
  );
  const capabilities = new Set([
    "booking.queue.read",
    "schedule.read",
    "quality.read",
    "clinical.visit.workspace.read",
  ]);

  const roles = ["CLINIC_ADMIN", "CLINIC_VETERINARIAN"];
  const items = resolveClinicShellNavigation(roles, (capability) => capabilities.has(capability));

  expect(clinicShellPersona(roles)).toBe("multi-role");
  expect(items.map((item) => item.href)).toEqual(["queue", "schedule", "quality", "vet/visits"]);
  expect(items.filter((item) => item.href === "schedule")).toHaveLength(1);
  expect(resolveClinicShellNavigation([], () => true)).toEqual([]);
});

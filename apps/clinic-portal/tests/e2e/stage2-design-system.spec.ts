import { test, expect } from "@playwright/test";

test("Stage 2 token contract is versioned and exposes semantic primitives", async () => {
  const contract = await import("../../../../docs/v51/design-tokens.json", { with: { type: "json" } });
  expect(contract.default.version).toBe("1.0.0");
  expect(contract.default.color.accent.default).toBe("#175cd3");
  expect(contract.default.a11y["min-target"]).toBe("44px");
  const colors = contract.default.color;
  expect(colors.surface && colors.content && colors.border && colors.accent && colors.success && colors.warning && colors.danger && colors.info).toBeTruthy();
  expect(contract.default.spacing && contract.default.radius && contract.default.shadow && contract.default.motion && contract.default["z-index"]).toBeTruthy();
  expect(contract.default.themes["high-contrast"].accent).toBe("#0037da");
  expect(contract.default.typography.body.size).toBe("16px");
  expect(contract.default.typography.label.weight).toBe(700);
  const flags = await import("../../app/design-system/feature-flags");
  expect(flags.PORTAL_V51_SHELL).toBe("PORTAL_V51_SHELL");
  expect(flags.DESIGN_SYSTEM_FEATURE_FLAGS.PORTAL_V51_SHELL).toBe(false);
});

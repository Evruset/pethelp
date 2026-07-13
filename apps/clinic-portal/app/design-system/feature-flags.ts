/** Stage 2 rollout contract. Runtime wiring is intentionally server-side only. */
export const PORTAL_V51_SHELL = "PORTAL_V51_SHELL" as const;
export const DESIGN_SYSTEM_FEATURE_FLAGS = {
  [PORTAL_V51_SHELL]: false,
} as const;

export function isPortalV51ShellEnabled(value = process.env[PORTAL_V51_SHELL]): boolean {
  return value === "true";
}

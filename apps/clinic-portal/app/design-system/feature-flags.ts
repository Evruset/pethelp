/**
 * Shell rollout stays server-side so a deployment can return to the legacy
 * composition without changing route or authorization contracts.
 */
export const PORTAL_V50_SHELL = "PORTAL_V50_SHELL" as const;
/** @deprecated Compatibility alias for deployments that still expose the V51 name. */
export const PORTAL_V51_SHELL = "PORTAL_V51_SHELL" as const;
export const DESIGN_SYSTEM_FEATURE_FLAGS = {
  [PORTAL_V50_SHELL]: false,
  [PORTAL_V51_SHELL]: false,
} as const;

export function resolvePortalV50ShellFlag(canonicalValue?: string, legacyValue?: string): boolean {
  // A defined canonical value always wins, including an explicit false.
  return canonicalValue !== undefined ? canonicalValue === "true" : legacyValue === "true";
}

export function isPortalV50ShellEnabled(): boolean {
  return resolvePortalV50ShellFlag(process.env[PORTAL_V50_SHELL], process.env[PORTAL_V51_SHELL]);
}

/** @deprecated Use isPortalV50ShellEnabled. */
export function isPortalV51ShellEnabled(): boolean {
  return isPortalV50ShellEnabled();
}

/**
 * Shell rollout stays server-side so a deployment can return to the legacy
 * composition without changing route or authorization contracts.
 */
export const PORTAL_V50_SHELL = "PORTAL_V50_SHELL" as const;
/** @deprecated Compatibility alias for deployments that still expose the V51 name. */
export const PORTAL_V51_SHELL = "PORTAL_V51_SHELL" as const;
export const CLINIC_APPOINTMENTS_REGISTRY = "VETHELP_CLINIC_APPOINTMENTS_REGISTRY" as const;
export const CLINIC_PATIENTS_REGISTRY = "VETHELP_CLINIC_PATIENTS_REGISTRY" as const;
export const CLINIC_PATIENT_ADMIN_REFERENCE_SEARCH = "VETHELP_CLINIC_PATIENT_ADMIN_REFERENCE_SEARCH" as const;
export const DESIGN_SYSTEM_FEATURE_FLAGS = {
  [PORTAL_V50_SHELL]: false,
  [PORTAL_V51_SHELL]: false,
  [CLINIC_APPOINTMENTS_REGISTRY]: false,
  [CLINIC_PATIENTS_REGISTRY]: false,
  [CLINIC_PATIENT_ADMIN_REFERENCE_SEARCH]: false,
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

export function isClinicAppointmentsRegistryEnabled(): boolean {
  return process.env[CLINIC_APPOINTMENTS_REGISTRY] === "true";
}

export function isClinicPatientsRegistryEnabled(): boolean {
  return process.env[CLINIC_PATIENTS_REGISTRY] === "true";
}

export function isClinicPatientAdminReferenceSearchEnabled(): boolean {
  return process.env[CLINIC_PATIENT_ADMIN_REFERENCE_SEARCH] === "true";
}

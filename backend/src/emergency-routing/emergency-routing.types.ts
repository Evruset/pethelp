export const EMERGENCY_STATUSES = ['ACCEPTING_NOW', 'TEMPORARILY_UNAVAILABLE', 'CLOSED'] as const;
export type EmergencyStatus = (typeof EMERGENCY_STATUSES)[number];

export const EMERGENCY_VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED'] as const;
export type EmergencyVerificationStatus = (typeof EMERGENCY_VERIFICATION_STATUSES)[number];

export const EMERGENCY_SPECIES = ['ALL', 'DOG', 'CAT', 'OTHER'] as const;
export type EmergencySpecies = (typeof EMERGENCY_SPECIES)[number];

export interface EmergencyCapabilityInput {
  capabilityCode: string;
  species: EmergencySpecies;
  available24x7: boolean;
  source: string;
  evidenceReference?: string;
}

export interface EmergencyRouteCandidate {
  clinicLocationId: string;
  clinicId: string;
  clinicName: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  emergencyContactPhone: string | null;
  statusUpdatedAt: string;
  validUntil: string;
  matchingCapabilities: string[];
  straightLineDistanceKm: number | null;
}

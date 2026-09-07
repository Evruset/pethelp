export type OwnerHomeIntent = 'BOOKING' | 'CLINICS' | 'TIME' | 'DIARY';

export function ownerIntentRequiresPet(intent: OwnerHomeIntent): boolean {
  return intent !== 'CLINICS';
}

export function ownerIntentPetPurpose(intent: OwnerHomeIntent): 'booking' | 'time' | 'diary' {
  if (intent === 'DIARY') return 'diary';
  if (intent === 'TIME') return 'time';
  return 'booking';
}

export function ownerIntentCatalogMode(intent: OwnerHomeIntent): 'browse' | 'booking' | 'time' {
  if (intent === 'CLINICS') return 'browse';
  if (intent === 'TIME') return 'time';
  return 'booking';
}

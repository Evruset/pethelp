import type { ReactNode } from 'react';
import { ClinicPortalShellV51Client } from './ClinicPortalShellV51Client';

type ClinicPortalShellV51Props = {
  clinicId: string;
  locationId: string;
  children: ReactNode;
};

/**
 * Flagged v51 composition for existing, already-authorized location routes.
 * It deliberately exposes no new data or routes until the corresponding
 * capability-protected vertical slices exist.
 */
export function ClinicPortalShellV51({ clinicId, locationId, children }: ClinicPortalShellV51Props) {
  return <ClinicPortalShellV51Client clinicId={clinicId} locationId={locationId}>{children}</ClinicPortalShellV51Client>;
}

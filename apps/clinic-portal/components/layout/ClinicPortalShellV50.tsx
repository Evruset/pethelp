import type { ReactNode } from 'react';
import { ClinicPortalShellV50Client } from './ClinicPortalShellV50Client';

type ClinicPortalShellV50Props = {
  clinicId: string;
  locationId: string;
  children: ReactNode;
};

/**
 * Flagged V50 composition for existing, already-authorized location routes.
 * The client shell only changes navigation visibility and presentation.
 */
export function ClinicPortalShellV50({ clinicId, locationId, children }: ClinicPortalShellV50Props) {
  return (
    <ClinicPortalShellV50Client clinicId={clinicId} locationId={locationId}>
      {children}
    </ClinicPortalShellV50Client>
  );
}

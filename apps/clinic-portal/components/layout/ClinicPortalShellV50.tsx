import type { ReactNode } from 'react';
import { isClinicPatientsRegistryEnabled, isClinicWorkspaceHomeEnabled } from '@/app/design-system/feature-flags';
import { ClinicPortalShellV50Client } from './ClinicPortalShellV50Client';
import { resolveMvpProductScope } from '@/lib/config/mvp-product-scope';

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
    <ClinicPortalShellV50Client clinicId={clinicId} locationId={locationId} patientsEnabled={isClinicPatientsRegistryEnabled()} workspaceHomeEnabled={isClinicWorkspaceHomeEnabled()} pilot={resolveMvpProductScope() === 'PILOT_V1'}>
      {children}
    </ClinicPortalShellV50Client>
  );
}

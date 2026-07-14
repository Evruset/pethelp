import { ClinicPortalShell } from '@/components/layout/ClinicPortalShell';
import { ClinicPortalShellV50 } from '@/components/layout/ClinicPortalShellV50';
import { isPortalV50ShellEnabled } from '@/app/design-system/feature-flags';
import type { ReactNode } from 'react';

type LocationLayoutProps = {
  children: ReactNode;
  params: Promise<{
    clinicId: string;
    locationId: string;
  }>;
};

export default async function ClinicLocationLayout({ children, params }: LocationLayoutProps) {
  const { clinicId, locationId } = await params;

  if (isPortalV50ShellEnabled()) {
    return <ClinicPortalShellV50 clinicId={clinicId} locationId={locationId}>{children}</ClinicPortalShellV50>;
  }

  return <ClinicPortalShell clinicId={clinicId} locationId={locationId}>{children}</ClinicPortalShell>;
}

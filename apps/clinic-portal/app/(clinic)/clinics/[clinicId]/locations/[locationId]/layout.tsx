import { ClinicPortalShell } from '@/components/layout/ClinicPortalShell';
import { ClinicPortalShellV51 } from '@/components/layout/ClinicPortalShellV51';
import { isPortalV51ShellEnabled } from '@/app/design-system/feature-flags';
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

  if (isPortalV51ShellEnabled()) {
    return <ClinicPortalShellV51 clinicId={clinicId} locationId={locationId}>{children}</ClinicPortalShellV51>;
  }

  return <ClinicPortalShell clinicId={clinicId} locationId={locationId}>{children}</ClinicPortalShell>;
}

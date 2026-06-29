import { ClinicPortalShell } from '@/components/layout/ClinicPortalShell';
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

  return (
    <ClinicPortalShell clinicId={clinicId} locationId={locationId}>
      {children}
    </ClinicPortalShell>
  );
}

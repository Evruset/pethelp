import { notFound } from 'next/navigation';
import { isClinicWorkspaceHomeEnabled } from '@/app/design-system/feature-flags';
import { ClinicWorkspaceHome } from '@/components/workspace-home/ClinicWorkspaceHome';

export default async function ClinicWorkspaceHomePage({ params }: { params: Promise<{ clinicId: string; locationId: string }> }) {
  const { clinicId, locationId } = await params;
  if (!isClinicWorkspaceHomeEnabled()) notFound();
  return <ClinicWorkspaceHome clinicId={clinicId} locationId={locationId} />;
}

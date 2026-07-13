import type { PoolClient } from 'pg';
import { Role } from '../auth/auth.types';
import { DomainException } from '../common/domain-error';
import { ClinicEmployeeAccessService } from './clinic-employee-access.service';

const EMPLOYEE_ID = '00000000-0000-4000-8000-000000000001';
const LOCATION_ID = '00000000-0000-4000-8000-000000000002';

function clientWithMembership(active: boolean): Pick<PoolClient, 'query'> {
  return {
    query: jest.fn().mockResolvedValue({
      rows: active ? [{ employee_id: EMPLOYEE_ID }] : [],
    }),
  } as unknown as Pick<PoolClient, 'query'>;
}

describe('ClinicEmployeeAccessService clinical completion', () => {
  const service = new ClinicEmployeeAccessService();

  it('allows an active veterinarian in the requested location', async () => {
    const client = clientWithMembership(true);

    await expect(service.assertClinicalVisitCompletionAccess(
      client as PoolClient,
      { sub: EMPLOYEE_ID, roles: [Role.CLINIC_VETERINARIAN], locationIds: [LOCATION_ID] },
      LOCATION_ID,
    )).resolves.toBeUndefined();
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it('denies a clinic administrator before querying membership', async () => {
    const client = clientWithMembership(true);

    await expect(service.assertClinicalVisitCompletionAccess(
      client as PoolClient,
      { sub: EMPLOYEE_ID, roles: [Role.CLINIC_ADMIN], locationIds: [LOCATION_ID] },
      LOCATION_ID,
    )).rejects.toBeInstanceOf(DomainException);
    expect(client.query).not.toHaveBeenCalled();
  });

  it('denies a veterinarian without an active location membership', async () => {
    const client = clientWithMembership(false);

    await expect(service.assertClinicalVisitCompletionAccess(
      client as PoolClient,
      { sub: EMPLOYEE_ID, roles: [Role.CLINIC_VETERINARIAN], locationIds: [LOCATION_ID] },
      LOCATION_ID,
    )).rejects.toBeInstanceOf(DomainException);
  });
});

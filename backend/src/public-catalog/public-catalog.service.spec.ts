import { DatabaseService } from '../database/database.service';
import { PublicCatalogService } from './public-catalog.service';

describe('PublicCatalogService', () => {
  it('returns public locations with availability marked as a read-only snapshot', async () => {
    const observedAt = new Date('2026-06-25T12:00:00.000Z');
    const query = jest.fn().mockResolvedValue({
      rows: [{
        clinic_id: '11111111-1111-4111-8111-111111111111',
        clinic_name: 'VetHelp Pilot',
        location_id: '22222222-2222-4222-8222-222222222222',
        address: 'Moscow, Pilotnaya 1',
        latitude: '55.7558',
        longitude: '37.6173',
        phone: '+7 495 000-00-00',
        has_open_slots: true,
        server_now: observedAt,
      }],
    });

    const service = new PublicCatalogService({ query } as unknown as DatabaseService);

    const response = await service.listClinicLocations({
      query: ' Pilot ',
      limit: 7,
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("location.status = 'ACTIVE'"),
      ['Pilot', 7, null, null, false],
    );

    expect(response).toEqual({
      observedAt: '2026-06-25T12:00:00.000Z',
      locations: [{
        clinic: { id: '11111111-1111-4111-8111-111111111111', name: 'VetHelp Pilot' },
        location: {
          id: '22222222-2222-4222-8222-222222222222',
          address: 'Moscow, Pilotnaya 1',
          latitude: 55.7558,
          longitude: 37.6173,
          phone: '+7 495 000-00-00',
        },
        availability: {
          mode: 'READ_ONLY_SNAPSHOT',
          hasOpenSlots: true,
          observedAt: '2026-06-25T12:00:00.000Z',
        },
      }],
    });
  });

  it('builds filtered public clinic discovery SQL without nonexistent slot status fields', async () => {
    const observedAt = new Date('2026-06-26T12:33:19.112Z');
    const nextAvailableAt = new Date('2026-06-26T13:00:00.000Z');

    const query = jest.fn().mockResolvedValue({
      rows: [{
        clinic_id: '02a158c0-b7c4-46e0-8baa-43bd59a74419',
        clinic_name: 'VetHelp Pilot',
        location_count: '1',
        service_count: '1',
        next_available_at: nextAvailableAt,
        distance_km: null,
        telemed_available: true,
        emergency_available: true,
        doctor_count: '2',
        price_from: '1500.00',
        availability_source_updated_at: new Date('2026-06-26T12:25:00.000Z'),
        server_now: observedAt,
      }],
    });

    const service = new PublicCatalogService({ query } as unknown as DatabaseService);

    const response = await service.listClinics({
      query: ' Pilot ',
      serviceCode: 'GENERAL_VISIT',
      availableFrom: new Date('2026-06-26T12:00:00.000Z'),
      availableTo: new Date('2026-06-27T12:00:00.000Z'),
      openNow: true,
      sort: 'soonest',
      limit: 7,
    });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];

    expect(sql).toContain('MIN(slot.starts_at) FILTER');
    expect(sql).not.toContain('slot.status');
    expect(sql).not.toContain('available_slot.status');
    expect(sql).not.toContain('THEN next_available_at');
    expect(params).toEqual([
      'Pilot',
      7,
      'GENERAL_VISIT',
      new Date('2026-06-26T12:00:00.000Z'),
      new Date('2026-06-27T12:00:00.000Z'),
      true,
      false,
      false,
      null,
      null,
      null,
      null,
      false,
    ]);

    expect(response).toEqual({
      observedAt: '2026-06-26T12:33:19.112Z',
      clinics: [{
        id: '02a158c0-b7c4-46e0-8baa-43bd59a74419',
        name: 'VetHelp Pilot',
        locationCount: 1,
        serviceCount: 1,
        nextAvailableAt: '2026-06-26T13:00:00.000Z',
        distanceKm: null,
        telemedAvailable: true,
        emergencyAvailable: true,
        doctorCount: 2,
        priceFrom: '1500.00',
        availability: {
          sourceUpdatedAt: '2026-06-26T12:25:00.000Z',
          serverNow: '2026-06-26T12:33:19.112Z',
          freshness: 'CURRENT',
          confirmationMode: 'CLINIC_CONFIRMATION',
        },
        fitReasons: [
          'Есть ближайшее подтверждаемое окно',
          'Доступны подтверждённые услуги',
          'Есть ветеринарные специалисты',
          'Экстренная возможность проверена',
        ],
      }],
      personalization: { applied: false },
    });
  });

  it('returns only allowlisted active veterinarian discovery fields with freshness', async () => {
    const query = jest.fn().mockResolvedValue({ rows: [{
      doctor_id: '33333333-3333-4333-8333-333333333333',
      display_name: 'Анна Петрова',
      clinic_id: '11111111-1111-4111-8111-111111111111',
      clinic_name: 'VetHelp Pilot',
      location_id: '22222222-2222-4222-8222-222222222222',
      address: 'Moscow, Pilotnaya 1',
      next_available_at: new Date('2026-06-26T13:00:00.000Z'),
      source_updated_at: new Date('2026-06-26T12:20:00.000Z'),
      server_now: new Date('2026-06-26T12:33:19.112Z'),
    }] });
    const service = new PublicCatalogService({ query } as unknown as DatabaseService);

    const response = await service.listDoctors({
      clinicId: '11111111-1111-4111-8111-111111111111',
      serviceCode: 'general_visit',
      limit: 20,
      petContextApplied: true,
    });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("staff.active = true");
    expect(sql).toContain("staff.role = 'VETERINARIAN'");
    expect(params).toEqual([
      '11111111-1111-4111-8111-111111111111', null, 'GENERAL_VISIT', null, 20,
    ]);
    expect(response.personalization).toEqual({ applied: true });
    expect(response.doctors[0]).toEqual({
      id: '33333333-3333-4333-8333-333333333333',
      displayName: 'Анна Петрова',
      title: 'Ветеринарный врач',
      clinic: { id: '11111111-1111-4111-8111-111111111111', name: 'VetHelp Pilot' },
      location: { id: '22222222-2222-4222-8222-222222222222', address: 'Moscow, Pilotnaya 1' },
      nextAvailableAt: '2026-06-26T13:00:00.000Z',
      availability: {
        sourceUpdatedAt: '2026-06-26T12:20:00.000Z',
        serverNow: '2026-06-26T12:33:19.112Z',
        freshness: 'CURRENT',
        confirmationMode: 'CLINIC_CONFIRMATION',
      },
    });
    expect(response.doctors[0]).not.toHaveProperty('bio');
    expect(response.doctors[0]).not.toHaveProperty('rating');
  });
});

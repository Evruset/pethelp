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

    const response = await service.listClinicLocations({ query: ' Pilot ', limit: 7 });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("location.status = 'ACTIVE'"), ['Pilot', 7]);
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
});

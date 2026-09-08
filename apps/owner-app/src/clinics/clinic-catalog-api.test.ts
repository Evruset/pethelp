import { createClinicCatalogApi } from './clinic-catalog-api';
import type { ApiClient } from '@/api/client';

describe('clinic catalog api',()=>{
  it('sends authority and accepts the bounded response',async()=>{
    const request=jest.fn().mockResolvedValue({observedAt:'2026-08-12T12:00:00Z',clinics:[{clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Clinic',address:'Address',phone:null}]});
    await expect(createClinicCatalogApi({request} as ApiClient).list('credential')).resolves.toMatchObject({clinics:[{name:'Clinic'}]});
    expect(request).toHaveBeenCalledWith('v1/owner/clinic-catalog',expect.objectContaining({headers:{Authorization:'Bearer credential'}}));
  });
  it('rejects malformed snapshots instead of rendering an empty catalog',async()=>{
    const request=jest.fn().mockResolvedValue({observedAt:'bad',clinics:[]});
    await expect(createClinicCatalogApi({request} as ApiClient).list('credential')).rejects.toThrow('INVALID_CLINIC_CATALOG_RESPONSE');
  });
  it('rejects otherwise valid responses containing non-allowlisted fields',async()=>{
    const request=jest.fn().mockResolvedValue({observedAt:'2026-08-12T12:00:00Z',clinics:[{clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Clinic',address:'Address',phone:null,internalStatus:'ACTIVE'}]});
    await expect(createClinicCatalogApi({request} as ApiClient).list('credential')).rejects.toThrow('INVALID_CLINIC_CATALOG_RESPONSE');
  });
});

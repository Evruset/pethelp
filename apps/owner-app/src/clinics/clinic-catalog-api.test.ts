import { createClinicCatalogApi } from './clinic-catalog-api';
import type { ApiClient } from '@/api/client';

describe('clinic catalog api',()=>{
  const decisionSummary={nextAvailability:{startsAt:'2026-08-13T08:00:00.000Z',localDate:'2026-08-13',localTime:'11:00',timezone:'Europe/Moscow'},informationalPrice:{kind:'FROM',amount:'900.50',currency:'RUB'},confirmation:{mode:'MANUAL'}};
  it('sends authority and accepts the bounded response',async()=>{
    const request=jest.fn().mockResolvedValue({observedAt:'2026-08-12T12:00:00Z',clinics:[{clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Clinic',address:'Address',phone:null,decisionSummary}]});
    await expect(createClinicCatalogApi({request} as ApiClient).list('credential')).resolves.toMatchObject({clinics:[{name:'Clinic'}]});
    expect(request).toHaveBeenCalledWith('v1/owner/clinic-catalog',expect.objectContaining({headers:{Authorization:'Bearer credential'}}));
  });
  it('rejects malformed snapshots instead of rendering an empty catalog',async()=>{
    const request=jest.fn().mockResolvedValue({observedAt:'bad',clinics:[]});
    await expect(createClinicCatalogApi({request} as ApiClient).list('credential')).rejects.toThrow('INVALID_CLINIC_CATALOG_RESPONSE');
  });
  it('rejects otherwise valid responses containing non-allowlisted fields',async()=>{
    const request=jest.fn().mockResolvedValue({observedAt:'2026-08-12T12:00:00Z',clinics:[{clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Clinic',address:'Address',phone:null,decisionSummary,internalStatus:'ACTIVE'}]});
    await expect(createClinicCatalogApi({request} as ApiClient).list('credential')).rejects.toThrow('INVALID_CLINIC_CATALOG_RESPONSE');
  });
  it.each([
    {nextAvailability:null,informationalPrice:null,confirmation:{mode:'MANUAL'}},
    {...decisionSummary,informationalPrice:{kind:'FROM',amount:'free',currency:'RUB'}},
    {...decisionSummary,confirmation:{mode:'AUTO'}},
    {...decisionSummary,nextAvailability:{...decisionSummary.nextAvailability,timezone:'invalid'}},
  ])('accepts explicit nulls and rejects malformed decision summaries',async(summary)=>{
    const request=jest.fn().mockResolvedValue({observedAt:'2026-08-12T12:00:00Z',clinics:[{clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Clinic',address:'Address',phone:null,decisionSummary:summary}]});
    const result=createClinicCatalogApi({request} as ApiClient).list('credential');
    if(summary.nextAvailability===null) await expect(result).resolves.toBeDefined(); else await expect(result).rejects.toThrow('INVALID_CLINIC_CATALOG_RESPONSE');
  });
});

import { OwnerClinicCatalogController } from './owner-clinic-catalog.controller';
import { PublicCatalogService } from './public-catalog.service';

describe('OwnerClinicCatalogController',()=>{
  it('requests only online-bookable locations and exposes the bounded projection',async()=>{
    const projection={observedAt:'2026-08-12T12:00:00.000Z',clinics:[{clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Clinic',address:'Address',phone:'+7000',decisionSummary:{nextAvailability:null,informationalPrice:null,confirmation:{mode:'MANUAL'}}}]};
    const listOwnerClinicDecisionCatalog=jest.fn().mockResolvedValue(projection);
    const controller=new OwnerClinicCatalogController({listOwnerClinicDecisionCatalog} as unknown as PublicCatalogService);
    await expect(controller.list()).resolves.toEqual(projection);
    expect(listOwnerClinicDecisionCatalog).toHaveBeenCalledWith(50);
  });
  it('returns the bounded service projection and masks a mismatched location',async()=>{
    const readOwnerClinicServices=jest.fn().mockResolvedValueOnce({observedAt:'2026-08-13T08:00:00.000Z',clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Clinic',address:'Address',phone:null,services:[]}).mockResolvedValueOnce(undefined);
    const controller=new OwnerClinicCatalogController({readOwnerClinicServices} as unknown as PublicCatalogService);
    await expect(controller.detail('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222')).resolves.toEqual(expect.objectContaining({services:[]}));
    await expect(controller.detail('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333')).rejects.toMatchObject({status:404,response:{code:'OWNER_CLINIC_LOCATION_NOT_FOUND'}});
  });
  it('returns bounded availability and masks an invalid context',async()=>{
    const readOwnerAvailability=jest.fn().mockResolvedValueOnce({observedAt:'2026-08-13T08:00:00.000Z',timezone:'Europe/Moscow',horizonEndsAt:'2026-08-27T08:00:00.000Z',slots:[]}).mockResolvedValueOnce(undefined);
    const controller=new OwnerClinicCatalogController({readOwnerAvailability} as unknown as PublicCatalogService);
    await expect(controller.availability('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333')).resolves.toEqual(expect.objectContaining({timezone:'Europe/Moscow',slots:[]}));
    await expect(controller.availability('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555')).rejects.toMatchObject({status:404,response:{code:'OWNER_AVAILABILITY_CONTEXT_NOT_FOUND'}});
    expect(readOwnerAvailability).toHaveBeenNthCalledWith(1,'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',undefined);
    expect(readOwnerAvailability).toHaveBeenNthCalledWith(2,'11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555');
  });
});

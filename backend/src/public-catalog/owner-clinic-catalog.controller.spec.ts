import { OwnerClinicCatalogController } from './owner-clinic-catalog.controller';
import { PublicCatalogService } from './public-catalog.service';

describe('OwnerClinicCatalogController',()=>{
  it('requests only online-bookable locations and exposes the bounded projection',async()=>{
    const listClinicLocations=jest.fn().mockResolvedValue({observedAt:'2026-08-12T12:00:00.000Z',locations:[{clinic:{id:'11111111-1111-4111-8111-111111111111',name:'Clinic'},location:{id:'22222222-2222-4222-8222-222222222222',address:'Address',phone:'+7000',latitude:1,longitude:2},availability:{mode:'READ_ONLY_SNAPSHOT',hasOpenSlots:true,observedAt:'2026-08-12T12:00:00.000Z'}}]});
    const controller=new OwnerClinicCatalogController({listClinicLocations} as unknown as PublicCatalogService);
    await expect(controller.list()).resolves.toEqual({observedAt:'2026-08-12T12:00:00.000Z',clinics:[{clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Clinic',address:'Address',phone:'+7000'}]});
    expect(listClinicLocations).toHaveBeenCalledWith({limit:50,openNow:true});
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
    await expect(controller.availability('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444')).rejects.toMatchObject({status:404,response:{code:'OWNER_AVAILABILITY_CONTEXT_NOT_FOUND'}});
  });

  it('normalizes a bounded specialist selector and rejects an empty selection',async()=>{
    const readOwnerSpecialistDiscovery=jest.fn().mockResolvedValue({observedAt:'2026-08-28T12:00:00.000Z',limit:7,doctors:[]});
    const controller=new OwnerClinicCatalogController({readOwnerSpecialistDiscovery} as unknown as PublicCatalogService);
    await expect(controller.specialistDiscovery({serviceCode:'PRIMARY_EXAM',limit:7})).resolves.toEqual(expect.objectContaining({limit:7,doctors:[]}));
    expect(readOwnerSpecialistDiscovery).toHaveBeenCalledWith({specialtyId:undefined,serviceCode:'PRIMARY_EXAM',limit:7});
    await expect(controller.specialistDiscovery({limit:25})).rejects.toMatchObject({status:400,response:{code:'SPECIALIST_DISCOVERY_SELECTOR_REQUIRED'}});
  });
  it('returns authoritative discovery choices from the same eligible boundary',async()=>{const value={observedAt:'2026-08-29T08:00:00.000Z',specialties:[],services:[]};const readOwnerSpecialistDiscoveryOptions=jest.fn().mockResolvedValue(value);const controller=new OwnerClinicCatalogController({readOwnerSpecialistDiscoveryOptions} as unknown as PublicCatalogService);await expect(controller.specialistDiscoveryOptions()).resolves.toEqual(value);});
});

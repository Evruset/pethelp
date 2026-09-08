import { createClinicServiceApi, parseClinicServiceSnapshot } from './clinic-service-api';
const C='11111111-1111-4111-8111-111111111111',L='22222222-2222-4222-8222-222222222222',S='33333333-3333-4333-8333-333333333333';
const payload={observedAt:'2026-08-13T08:00:00.000Z',clinicId:C,locationId:L,name:'Clinic',address:'Address',phone:null,services:[{serviceId:S,name:'Осмотр',price:{kind:'INFORMATIONAL',amount:'1250.00',currency:'RUB'}}]};
describe('clinic service api',()=>{
  it('uses the scoped route and accepts only the public projection',async()=>{const request=jest.fn().mockResolvedValue(payload);await expect(createClinicServiceApi({request}).read('credential',C,L)).resolves.toEqual(payload);expect(request).toHaveBeenCalledWith(`v1/owner/clinic-catalog/${C}/locations/${L}`,expect.objectContaining({headers:{Authorization:'Bearer credential'}}));});
  it.each([{...payload,ownerId:C},{...payload,services:[{...payload.services[0],paymentStatus:'PAID'}]},{...payload,services:[{...payload.services[0],price:{...payload.services[0].price,amount:'12'}}]}])('fails closed for malformed or extra fields',value=>expect(()=>parseClinicServiceSnapshot(value)).toThrow('INVALID_CLINIC_SERVICE_RESPONSE'));
});

import { createDoctorApi } from './doctor-api';

const clinicId='11111111-1111-4111-8111-111111111111';
const locationId='22222222-2222-4222-8222-222222222222';
const doctorId='33333333-3333-4333-8333-333333333333';
const payload={observedAt:'2026-09-10T10:00:00.000Z',doctors:[{id:doctorId,displayName:'Анна Иванова',title:'Ветеринарный врач',clinic:{id:clinicId,name:'Клиника'},location:{id:locationId,address:'Адрес'},nextAvailableAt:'2026-09-11T10:00:00.000Z',availability:{sourceUpdatedAt:'2026-09-10T09:59:00.000Z',serverNow:'2026-09-10T10:00:00.000Z',freshness:'CURRENT',confirmationMode:'CLINIC_CONFIRMATION'}}],personalization:{applied:false}};

it('reads only the authoritative Owner-compatible doctor projection',async()=>{const request=jest.fn().mockResolvedValue(payload);const result=await createDoctorApi({request}).list('credential',clinicId,locationId);expect(request).toHaveBeenCalledWith(`v1/clinics/${clinicId}/doctors?locationId=${locationId}`,expect.objectContaining({headers:{Authorization:'Bearer credential'}}));expect(result.doctors[0]).toEqual({id:doctorId,displayName:'Анна Иванова',title:'Ветеринарный врач',nextAvailableAt:'2026-09-11T10:00:00.000Z',freshness:'CURRENT'});});

it('fails closed on an expanded doctor shape',async()=>{const request=jest.fn().mockResolvedValue({...payload,doctors:[{...payload.doctors[0],rating:5}]});await expect(createDoctorApi({request}).list('credential',clinicId,locationId)).rejects.toThrow('INVALID_DOCTORS_RESPONSE');});

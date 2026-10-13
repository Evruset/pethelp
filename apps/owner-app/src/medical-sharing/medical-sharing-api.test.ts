import type { ApiClient } from '@/api/client';
import { createMedicalSharingApi, parseAppointments, parseShare, parseSharingContext } from './medical-sharing-api';
import { active, appointment, context, ids, revoked } from './test-fixtures';
describe('medical sharing closed API',()=>{
  it('parses exact Owner context and scoped grants without technical metadata',()=>{
    expect(parseSharingContext(context,ids.appointmentId)).toEqual(context);
    expect(parseShare(active,context)).toEqual(active);
    expect(parseAppointments([{...appointment,presentation:{label:'Запись'},internal:'ignored'}])).toEqual([appointment]);
  });
  it.each([
    {...context,appointmentId:ids.hold},{...context,rawOcr:'private'},
    {...context,resources:[...context.resources,{type:'DRAFT',id:ids.result}]},
    {...context,shares:[{...active,petId:ids.hold}]},
    {...context,resourceDetails:[{type:'DOCUMENT',id:ids.hold,label:'foreign',createdAt:active.createdAt}]},
    {...context,appointment:{...context.appointment,startsAt:'2026-02-30T09:00:00.000Z'}},
  ])('rejects foreign, raw/internal and malformed context %#',value=>expect(()=>parseSharingContext(value,ids.appointmentId)).toThrow('INVALID_MEDICAL_SHARING_RESPONSE'));
  it('uses canonical Owner routes and mutation headers, selects a finite list only',async()=>{
    const request=jest.fn().mockResolvedValueOnce([appointment]).mockResolvedValueOnce(context).mockResolvedValueOnce(active).mockResolvedValueOnce(revoked);
    const api=createMedicalSharingApi({request} as ApiClient);
    await api.appointments('credential');await api.context('credential',ids.appointmentId);
    expect(await api.create('credential',context,active.resources,ids.hold,ids.share)).toEqual(active);
    expect(request.mock.calls[2]).toEqual([`v1/owner/appointments/${ids.appointmentId}/medical-shares`,expect.objectContaining({method:'POST',body:{mode:'SELECTED',resources:active.resources},headers:{Authorization:'Bearer credential','Idempotency-Key':ids.hold,'X-Correlation-ID':ids.share}})]);
    expect(await api.revoke('credential',active,ids.hold,ids.share)).toEqual(revoked);
    expect(request.mock.calls[3][1]).toMatchObject({body:{},headers:{'If-Match':'"1"'}});
    expect(JSON.stringify(request.mock.calls)).not.toMatch(/includeFuture|ownerId|petId|clinicId|locationId/);
  });
  it('does not accept a widened or substituted server mutation result',async()=>{
    const request=jest.fn().mockResolvedValue({...active,resources:context.resources});const api=createMedicalSharingApi({request} as ApiClient);
    await expect(api.create('credential',context,active.resources,ids.hold,ids.share)).rejects.toThrow('INVALID_MEDICAL_SHARING_RESPONSE');
    request.mockResolvedValue({...revoked,id:ids.hold});await expect(api.revoke('credential',active,ids.hold,ids.share)).rejects.toThrow('INVALID_MEDICAL_SHARING_RESPONSE');
  });
});

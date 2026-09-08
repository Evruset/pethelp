import { createBookingApi, parseBookingResult } from './booking-api';
const ids = {
  petId:'11111111-1111-4111-8111-111111111111', clinicId:'22222222-2222-4222-8222-222222222222', locationId:'33333333-3333-4333-8333-333333333333', serviceId:'44444444-4444-4444-8444-444444444444', slotId:'55555555-5555-4555-8555-555555555555',
};
const result = { holdId:'66666666-6666-4666-8666-666666666666',status:'PENDING_CONFIRMATION',slotId:ids.slotId,expiresAt:'2026-08-13T12:00:00.000Z',lastUpdatedAt:'2026-08-13T11:00:00.000Z',correlationId:'77777777-7777-4777-8777-777777777777',serverNow:'2026-08-13T11:00:00.000Z',aggregateVersion:1,confirmationMode:'MANUAL',nextAction:'READ_STATUS'} as const;
describe('booking api',()=>{
  it('submits only authoritative references and the stable idempotency key',async()=>{const request=jest.fn().mockResolvedValue(result);await expect(createBookingApi({request}).create('credential',{...ids,expectedSlotVersion:4},'88888888-8888-4888-8888-888888888888')).resolves.toEqual(result);expect(request).toHaveBeenCalledWith('v1/booking-holds',{method:'POST',body:{...ids,expectedSlotVersion:4},signal:undefined,headers:{Authorization:'Bearer credential','Idempotency-Key':'88888888-8888-4888-8888-888888888888'}});});
  it.each([{...result,state:'MANUAL_CONFIRM_PENDING'},{...result,status:'CONFIRMED'},{...result,confirmationMode:'MIS'},{...result,aggregateVersion:0},{...result,expiresAt:'2026-02-30T12:00:00.000Z'}])('fails closed for a malformed success projection',(value)=>expect(()=>parseBookingResult(value)).toThrow('INVALID_BOOKING_RESPONSE'));
  it('rejects a valid-looking response for another slot',async()=>{const request=jest.fn().mockResolvedValue({...result,slotId:'99999999-9999-4999-8999-999999999999'});await expect(createBookingApi({request}).create('token',{...ids,expectedSlotVersion:4},'88888888-8888-4888-8888-888888888888')).rejects.toThrow('INVALID_BOOKING_RESPONSE');});
});

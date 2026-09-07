import { createActiveBookingStore } from './active-booking-store';

const ownerA='11111111-1111-4111-8111-111111111111';
const ownerB='22222222-2222-4222-8222-222222222222';
const hold='66666666-6666-4666-8666-666666666666';

describe('active booking store',()=>{
  it('restores only the booking bound to the current authoritative owner scope',async()=>{let value:string|null=null;const secure={getItemAsync:jest.fn(async()=>value),setItemAsync:jest.fn(async(_key:string,next:string)=>{value=next;})};const store=createActiveBookingStore(secure);await store.write(ownerA,hold);await expect(store.read(ownerA)).resolves.toBe(hold);await expect(store.read(ownerB)).resolves.toBeNull();});
  it.each(['not-json',JSON.stringify({cacheScope:ownerA,holdId:hold,internalState:'MANUAL_CONFIRM_PENDING'}),JSON.stringify({cacheScope:ownerA,holdId:'bad'})])('fails malformed persistence closed',async(value)=>{const store=createActiveBookingStore({getItemAsync:jest.fn(async()=>value),setItemAsync:jest.fn()});await expect(store.read(ownerA)).resolves.toBeNull();});
});

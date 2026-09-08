import { act, render } from '@testing-library/react-native';
import { BookingStatusScreen } from './BookingStatusScreen';
import { bookingStatusIds, pendingBookingStatus } from './booking-status-test-fixtures';

const mockRead=jest.fn();
jest.mock('./booking-api',()=>({bookingApi:{read:(...args:unknown[])=>mockRead(...args)}}));
jest.mock('@/session/SessionProvider',()=>({useSession:()=>({session:{cacheScope:'11111111-1111-4111-8111-111111111111',opaqueCredential:'credential-a'}})}));

it('keeps bounded polling through the 15-minute decision window and stops at 64 reads',async()=>{jest.useFakeTimers();mockRead.mockResolvedValue(pendingBookingStatus);const view=await render(<BookingStatusScreen holdId={bookingStatusIds.holdId} authorityGeneration="g1" onClose={()=>undefined}/>);await act(async()=>{await Promise.resolve();await Promise.resolve();});expect(view.getByText('Клиника подтверждает запись')).toBeTruthy();for(let index=1;index<64;index+=1){await act(async()=>{jest.advanceTimersByTime(15_000);await Promise.resolve();await Promise.resolve();});}expect(mockRead).toHaveBeenCalledTimes(64);await act(async()=>{jest.advanceTimersByTime(60_000);});expect(mockRead).toHaveBeenCalledTimes(64);await view.unmount();jest.useRealTimers();});

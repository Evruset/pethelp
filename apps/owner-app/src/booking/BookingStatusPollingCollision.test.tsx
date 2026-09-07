import { act, fireEvent, render } from '@testing-library/react-native';
import { BookingStatusScreen } from './BookingStatusScreen';
import { bookingStatusIds, pendingBookingStatus } from './booking-status-test-fixtures';

const mockRead=jest.fn();
jest.mock('./booking-api',()=>({bookingApi:{read:(...args:unknown[])=>mockRead(...args)}}));
jest.mock('@/session/SessionProvider',()=>({useSession:()=>({session:{cacheScope:'11111111-1111-4111-8111-111111111111',opaqueCredential:'credential-a'}})}));

it('continues bounded polling after a manual refresh collides with the scheduled poll',async()=>{jest.useFakeTimers();let resolveManual!:(value:unknown)=>void;mockRead.mockResolvedValueOnce(pendingBookingStatus).mockReturnValueOnce(new Promise(value=>{resolveManual=value;})).mockReturnValueOnce(new Promise(()=>undefined));const view=await render(<BookingStatusScreen holdId={bookingStatusIds.holdId} authorityGeneration="g1" onClose={()=>undefined}/>);await act(async()=>{await Promise.resolve();await Promise.resolve();});expect(view.getByText('Клиника подтверждает запись')).toBeTruthy();fireEvent.press(view.getByText('Обновить статус'));expect(mockRead).toHaveBeenCalledTimes(2);await act(async()=>{jest.advanceTimersByTime(15_000);});expect(mockRead).toHaveBeenCalledTimes(2);await act(async()=>{resolveManual(pendingBookingStatus);await Promise.resolve();await Promise.resolve();});await act(async()=>{jest.advanceTimersByTime(15_000);});expect(mockRead).toHaveBeenCalledTimes(3);await view.unmount();jest.useRealTimers();});

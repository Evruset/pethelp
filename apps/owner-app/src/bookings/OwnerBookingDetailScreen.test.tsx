import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { OwnerBookingDetailScreen } from './OwnerBookingDetailScreen';
import { ownerBookingDetailApi } from './owner-booking-detail-api';
import { ApiError } from '@/api/errors';

jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({ session: { opaqueCredential: 'credential', cacheScope: 'scope' } }) }));
const id = '11111111-1111-4111-8111-111111111111';
const item: any = { holdId:id,bucket:'ACTIVE',version:2,startsAt:'2026-09-20T09:00:00.000Z',endsAt:'2026-09-20T09:30:00.000Z',latestStatusUpdateAt:'2026-09-19T08:00:00.000Z',presentation:{label:'Запись подтверждена',description:'Клиника ждёт вас.',tone:'success'},clinic:{name:'VetHelp',address:'Москва'},location:{address:'Москва'},pet:{name:'Жучка',species:'DOG'},service:{name:'Осмотр',priceAmount:'1200.00',currency:'RUB'},timeline:[],actions:{canCancel:true},cancellation:{canCancel:true,aggregateVersion:2,safeReason:null} };
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions:{queries:{retry:false}} })}>{children}</QueryClientProvider>;

beforeAll(() => Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => '22222222-2222-4222-8222-222222222222' } }));
afterEach(() => jest.restoreAllMocks());

it('reads by identifier, confirms destructive action, and renders only authoritative CANCELLED readback', async () => {
  jest.spyOn(ownerBookingDetailApi,'read').mockResolvedValueOnce(item).mockResolvedValueOnce({ ...item, bucket:'HISTORY', presentation:{label:'Запись отменена',description:'Запись отменена.',tone:'neutral'}, actions:{canCancel:false}, cancellation:{...item.cancellation,canCancel:false}, version:3 });
  jest.spyOn(ownerBookingDetailApi,'cancel').mockResolvedValue(undefined);
  const view=await render(<OwnerBookingDetailScreen bookingId={id} onBack={jest.fn()}/>,{wrapper});
  await waitFor(() => expect(view.getByText('Запись подтверждена')).toBeTruthy()); await act(async () => fireEvent.press(view.getByText('Отменить запись')));
  expect(view.getByText('Отменить запись?')).toBeTruthy(); fireEvent.press(view.getByText('Да, отменить'));
  expect(view.queryByText('Запись отменена')).toBeNull();
  await waitFor(() => expect(view.getByText('Запись отменена')).toBeTruthy()); expect(ownerBookingDetailApi.cancel).toHaveBeenCalledTimes(1); expect(view.queryByText('Отменить запись')).toBeNull();
});

it('refreshes stale state and never fabricates cancellation on conflict', async () => {
  jest.spyOn(ownerBookingDetailApi,'read').mockResolvedValue(item);
  jest.spyOn(ownerBookingDetailApi,'cancel').mockRejectedValue(new ApiError('CONFLICT','stale',409));
  const view=await render(<OwnerBookingDetailScreen bookingId={id} onBack={jest.fn()}/>,{wrapper}); await waitFor(() => expect(view.getByText('Запись подтверждена')).toBeTruthy()); await act(async () => fireEvent.press(view.getByText('Отменить запись'))); fireEvent.press(view.getByText('Да, отменить'));
  await waitFor(() => expect(view.getByText('Запись уже изменилась')).toBeTruthy()); expect(view.queryByText('Запись отменена')).toBeNull(); await waitFor(()=>expect(ownerBookingDetailApi.read).toHaveBeenCalledTimes(2));
});

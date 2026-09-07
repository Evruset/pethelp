import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/api/errors';
import { BookingStatusScreen } from './BookingStatusScreen';
import { bookingStatusIds, pendingBookingStatus } from './booking-status-test-fixtures';

jest.mock('./BookingChangeRequestPanel',()=>({BookingChangeRequestPanel:()=>null}));

const mockRead=jest.fn();
const mockCancel=jest.fn();
jest.mock('./booking-api',()=>({bookingApi:{read:(...args:unknown[])=>mockRead(...args),cancel:(...args:unknown[])=>mockCancel(...args)}}));
jest.mock('@/session/SessionProvider',()=>({useSession:()=>({session:{cacheScope:'11111111-1111-4111-8111-111111111111',opaqueCredential:'credential-a'}})}));

const snapshot = (status:'PENDING_CONFIRMATION'|'CONFIRMED'|'REJECTED'|'CANCELLED'|'EXPIRED', aggregateVersion=1) => ({
  ...pendingBookingStatus,
  status,
  statusCode:status,
  statusTitle:{PENDING_CONFIRMATION:'Клиника подтверждает заявку',CONFIRMED:'Запись подтверждена',REJECTED:'Клиника не подтвердила запись',CANCELLED:'Запись отменена',EXPIRED:'Время ожидания истекло'}[status],
  safeDescription:{PENDING_CONFIRMATION:'Ожидаем подтверждение.',CONFIRMED:'Клиника подтвердила выбранное время.',REJECTED:'Выберите другое доступное время.',CANCELLED:'Эта заявка больше не активна.',EXPIRED:'Проверьте актуальные свободные интервалы.'}[status],
  canCancel:status==='PENDING_CONFIRMATION'||status==='CONFIRMED',
  aggregateVersion,
  nextActionCode:status==='PENDING_CONFIRMATION'?'WAIT':status==='CONFIRMED'?'VIEW_APPOINTMENT':'CHOOSE_ANOTHER_SLOT',
} as const);
const acknowledgement={holdId:bookingStatusIds.holdId,status:'CANCELLED',slotId:bookingStatusIds.slotId,correlationId:'77777777-7777-4777-8777-777777777777',aggregateVersion:2,lastUpdatedAt:'2026-08-13T11:01:00.000Z',serverNow:'2026-08-13T11:01:01.000Z'} as const;
const props={holdId:bookingStatusIds.holdId,authorityGeneration:'authority-a',onClose:jest.fn()};
type View = Awaited<ReturnType<typeof render>>;
const confirmationButton=(view:View)=>view.getAllByRole('button',{name:'Отменить запись'}).at(-1)!;
const openConfirmation=async(view:View)=>{fireEvent.press(view.getByRole('button',{name:'Отменить запись'}));await waitFor(()=>expect(view.getByText('После отмены это время снова станет доступно для записи.')).toBeTruthy());};

describe('owner booking cancellation flow',()=>{
  beforeAll(()=>{Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID:jest.fn(()=> '88888888-8888-4888-8888-888888888888')}});});
  beforeEach(()=>{mockRead.mockReset();mockCancel.mockReset();props.onClose.mockReset();});

  it.each([
    ['PENDING_CONFIRMATION',true],['CONFIRMED',true],['REJECTED',false],['CANCELLED',false],['EXPIRED',false],
  ] as const)('shows cancellation only for an authoritative cancellable %s snapshot',async(status,visible)=>{mockRead.mockResolvedValue(snapshot(status));const view=await render(<BookingStatusScreen {...props}/>);await waitFor(()=>expect(view.queryByText('Отменить запись')!==null).toBe(visible));await view.unmount();});

  it('hides cancellation for a completed-equivalent CONFIRMED snapshot when the server denies eligibility',async()=>{mockRead.mockResolvedValue({...snapshot('CONFIRMED'),canCancel:false});const view=await render(<BookingStatusScreen {...props}/>);await waitFor(()=>expect(view.getByText('Запись подтверждена')).toBeTruthy());expect(view.queryByText('Отменить запись')).toBeNull();await view.unmount();});

  it('requires an explicit destructive confirmation and allows backing out without a command',async()=>{mockRead.mockResolvedValue(snapshot('CONFIRMED'));const view=await render(<BookingStatusScreen {...props}/>);await waitFor(()=>expect(view.getByText('Отменить запись')).toBeTruthy());await openConfirmation(view);expect(view.getByText('Отменить запись?')).toBeTruthy();expect(mockCancel).not.toHaveBeenCalled();fireEvent.press(view.getByText('Не отменять'));await waitFor(()=>expect(view.queryByText('Отменить запись?')).toBeNull());expect(mockCancel).not.toHaveBeenCalled();await view.unmount();});

  it('after a possible-commit timeout reads back first and retries once with the same key only while still cancellable',async()=>{mockRead.mockResolvedValueOnce(snapshot('CONFIRMED')).mockResolvedValueOnce(snapshot('CONFIRMED')).mockResolvedValueOnce(snapshot('CANCELLED',2));mockCancel.mockRejectedValueOnce(new ApiError('TIMEOUT','timeout')).mockResolvedValueOnce(acknowledgement);const view=await render(<BookingStatusScreen {...props}/>);await waitFor(()=>expect(view.getByText('Отменить запись')).toBeTruthy());await openConfirmation(view);fireEvent.press(confirmationButton(view));await waitFor(()=>expect(view.getByText('Запись отменена')).toBeTruthy());expect(mockCancel).toHaveBeenCalledTimes(2);expect(mockRead).toHaveBeenCalledTimes(3);expect(mockCancel.mock.calls[1]).toEqual(mockCancel.mock.calls[0]);await view.unmount();});

  it('does not retry an old expectedVersion when timeout readback reveals a newer confirmed snapshot',async()=>{mockRead.mockResolvedValueOnce(snapshot('PENDING_CONFIRMATION')).mockResolvedValueOnce(snapshot('CONFIRMED',2));mockCancel.mockRejectedValueOnce(new ApiError('TIMEOUT','timeout'));const view=await render(<BookingStatusScreen {...props}/>);await waitFor(()=>expect(view.getByText('Отменить запись')).toBeTruthy());await openConfirmation(view);fireEvent.press(confirmationButton(view));await waitFor(()=>expect(view.getByText('Статус записи изменился. Мы показали последние данные — проверьте их перед новой попыткой.')).toBeTruthy());expect(mockCancel).toHaveBeenCalledTimes(1);expect(view.getByText('Запись подтверждена')).toBeTruthy();await view.unmount();});

  it('refreshes a stale conflict, keeps safe copy, and never exposes the raw code',async()=>{mockRead.mockResolvedValueOnce(snapshot('CONFIRMED')).mockResolvedValueOnce(snapshot('CONFIRMED',2));mockCancel.mockRejectedValueOnce(new ApiError('CONFLICT','raw',409,undefined,'BOOKING_VERSION_STALE'));const view=await render(<BookingStatusScreen {...props}/>);await waitFor(()=>expect(view.getByText('Отменить запись')).toBeTruthy());await openConfirmation(view);fireEvent.press(confirmationButton(view));await waitFor(()=>expect(view.getByText('Статус записи изменился. Мы показали последние данные — проверьте их перед новой попыткой.')).toBeTruthy());expect(view.queryByText('BOOKING_VERSION_STALE')).toBeNull();expect(view.getByText('Отменить запись')).toBeTruthy();await view.unmount();});

  it.each([['REJECTED','Клиника не сможет принять в выбранное время'],['EXPIRED','Клиника не успела подтвердить запись']] as const)('treats authoritative non-cancelled terminal %s readback as a safe conflict, never success',async(status,title)=>{mockRead.mockResolvedValueOnce(snapshot('CONFIRMED')).mockResolvedValueOnce(snapshot(status,2));mockCancel.mockRejectedValueOnce(new ApiError('CONFLICT','raw',409,undefined,'BOOKING_STATE_CONFLICT'));const view=await render(<BookingStatusScreen {...props}/>);await waitFor(()=>expect(view.getByText('Отменить запись')).toBeTruthy());await openConfirmation(view);fireEvent.press(confirmationButton(view));await waitFor(()=>expect(view.getByText(title)).toBeTruthy());expect(view.getByText('Статус записи изменился. Мы показали последние данные — проверьте их перед новой попыткой.')).toBeTruthy();expect(view.queryByText('Запись отменена')).toBeNull();expect(view.queryByRole('button',{name:'Отменить запись'})).toBeNull();await view.unmount();});

  it('preserves the same command identity for SLOT_LOCKED_RETRY after cancellable readback',async()=>{mockRead.mockResolvedValueOnce(snapshot('CONFIRMED')).mockResolvedValueOnce(snapshot('CONFIRMED')).mockResolvedValueOnce(snapshot('CANCELLED',2));mockCancel.mockRejectedValueOnce(new ApiError('CONFLICT','raw',409,undefined,'SLOT_LOCKED_RETRY')).mockResolvedValueOnce(acknowledgement);const view=await render(<BookingStatusScreen {...props}/>);await waitFor(()=>expect(view.getByText('Отменить запись')).toBeTruthy());await openConfirmation(view);fireEvent.press(confirmationButton(view));await waitFor(()=>expect(view.getByText('Запись сейчас обновляется другой операцией. Мы проверили статус — повторите отмену.')).toBeTruthy());const first=mockCancel.mock.calls[0];fireEvent.press(view.getByText('Повторить отмену'));await waitFor(()=>expect(view.getByText('Запись отменена')).toBeTruthy());expect(mockCancel).toHaveBeenCalledTimes(2);expect(mockCancel.mock.calls[1]).toEqual(first);expect(view.queryByText('SLOT_LOCKED_RETRY')).toBeNull();await view.unmount();});

  it('trusts authoritative readback rather than a malformed cancellation acknowledgement',async()=>{mockRead.mockResolvedValueOnce(snapshot('CONFIRMED')).mockResolvedValueOnce(snapshot('CANCELLED',2));mockCancel.mockRejectedValueOnce(new Error('INVALID_BOOKING_CANCELLATION_RESPONSE'));const view=await render(<BookingStatusScreen {...props}/>);await waitFor(()=>expect(view.getByText('Отменить запись')).toBeTruthy());await openConfirmation(view);fireEvent.press(confirmationButton(view));await waitFor(()=>expect(view.getByText('Запись отменена')).toBeTruthy());expect(view.queryByText('INVALID_BOOKING_CANCELLATION_RESPONSE')).toBeNull();await view.unmount();});

  it('single-flights duplicate confirmation and renders CANCELLED only after authoritative readback',async()=>{let resolveCancel!:(value:unknown)=>void;mockRead.mockResolvedValueOnce(snapshot('CONFIRMED')).mockResolvedValueOnce(snapshot('CANCELLED',2));mockCancel.mockReturnValue(new Promise(value=>{resolveCancel=value;}));const view=await render(<BookingStatusScreen {...props}/>);await waitFor(()=>expect(view.getByText('Отменить запись')).toBeTruthy());await openConfirmation(view);fireEvent.press(confirmationButton(view));await waitFor(()=>expect(confirmationButton(view).props.accessibilityState).toMatchObject({disabled:true}));fireEvent.press(confirmationButton(view));expect(mockCancel).toHaveBeenCalledTimes(1);expect(view.queryByText('Запись отменена')).toBeNull();await act(async()=>{resolveCancel(acknowledgement);});await waitFor(()=>expect(view.getByText('Запись отменена')).toBeTruthy());expect(mockRead).toHaveBeenCalledTimes(2);expect(view.queryByText('Отменить запись')).toBeNull();await view.unmount();});

  it('fences late command completion after unmount and dispatches no old-authority readback',async()=>{let resolveCancel!:(value:unknown)=>void;mockRead.mockResolvedValueOnce(snapshot('CONFIRMED'));mockCancel.mockReturnValueOnce(new Promise(value=>{resolveCancel=value;}));const view=await render(<BookingStatusScreen {...props}/>);await waitFor(()=>expect(view.getByText('Отменить запись')).toBeTruthy());await openConfirmation(view);fireEvent.press(confirmationButton(view));await view.unmount();await act(async()=>{resolveCancel(acknowledgement);await Promise.resolve();});expect(mockRead).toHaveBeenCalledTimes(1);});
});

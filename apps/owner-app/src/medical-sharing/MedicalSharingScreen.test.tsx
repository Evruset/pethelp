import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/api/errors';
import { MedicalSharingScreen } from './MedicalSharingScreen';
import { active, appointment, context, revoked } from './test-fixtures';
import type { MedicalSharingApi } from './medical-sharing-api';

let mockSession: {cacheScope:string;opaqueCredential:string}|null;
let mockAppointments=[appointment];
jest.mock('@/session/SessionProvider',()=>({useSession:()=>({session:mockSession})}));
jest.mock('@tanstack/react-query',()=>({useQuery:()=>({data:mockAppointments,isPending:false,isError:false,refetch:jest.fn()})}));
const api={appointments:jest.fn(),context:jest.fn(),create:jest.fn(),revoke:jest.fn()} satisfies MedicalSharingApi;
jest.setTimeout(15000);
async function open(){const view=await render(<MedicalSharingScreen api={api} onBack={jest.fn()}/>);await fireEvent.press(view.getByRole('button',{name:appointment.state==='CONFIRMED'?'Поделиться медицинскими данными':'Просмотреть предоставленный доступ'}));await waitFor(()=>expect(view.getByText('Питомец: Барсик')).toBeTruthy());return view;}
async function prepare(view:Awaited<ReturnType<typeof open>>){await fireEvent.press(view.getByRole('checkbox',{name:/history.pdf/}));await fireEvent.press(view.getByRole('button',{name:'Продолжить к подтверждению'}));expect(view.getByText('Подтвердите передачу выбранных данных')).toBeTruthy();}
describe('Owner medical sharing workflow and accessibility',()=>{
  beforeAll(()=>{let sequence=0;Object.defineProperty(globalThis,'crypto',{configurable:true,value:{randomUUID:()=>`99999999-9999-4999-8999-${String(++sequence).padStart(12,'0')}`}});});
  beforeEach(()=>{jest.clearAllMocks();mockSession={cacheScope:'owner-a',opaqueCredential:'credential-a'};mockAppointments=[appointment];api.context.mockResolvedValue(context);api.create.mockResolvedValue(active);api.revoke.mockResolvedValue(revoked);});
  it('requires explicit selection/confirmation, then server readback and explicit revoke',async()=>{
    const view=await open();expect(view.getByText('Клиника: Добрый ветеринар')).toBeTruthy();
    expect(view.getByRole('button',{name:'Продолжить к подтверждению'}).props.accessibilityState.disabled).toBe(true);
    const checkbox=view.getByRole('checkbox',{name:/history.pdf/});expect(checkbox.props.accessibilityState.checked).toBe(false);expect(checkbox.props.style.minHeight).toBe(48);
    await prepare(view);expect(view.getByRole('checkbox',{name:/history.pdf/}).props.accessibilityState).toEqual({checked:true,disabled:true});
    await fireEvent.press(view.getByRole('button',{name:'Подтвердить передачу'}));await waitFor(()=>expect(view.getByText('Доступ предоставлен — подтверждено сервером')).toBeTruthy());
    expect(api.create.mock.calls[0][2]).toEqual([{type:'DOCUMENT',id:active.resources[0].id}]);
    await fireEvent.press(view.getByRole('button',{name:'Отозвать доступ'}));expect(api.revoke).not.toHaveBeenCalled();expect(view.getByText(/Уже просмотренные или скачанные/)).toBeTruthy();
    await fireEvent.press(view.getByRole('button',{name:'Подтвердить отзыв'}));await waitFor(()=>expect(view.getByText('Доступ отозван — подтверждено сервером')).toBeTruthy());
    expect(api.revoke.mock.calls[0][1]).toEqual(active);expect(view.queryByRole('button',{name:'Отозвать доступ'})).toBeNull();
  });
  it('single-flights requests without optimistic success and retries the identical uncertain command',async()=>{
    let resolve!:(value:typeof active)=>void;api.create.mockReturnValueOnce(new Promise(value=>{resolve=value;})).mockRejectedValueOnce(new ApiError('TIMEOUT','timeout')).mockResolvedValueOnce(active);
    const view=await open();await prepare(view);await fireEvent.press(view.getByRole('button',{name:'Подтвердить передачу'}));
    await waitFor(()=>expect(view.getByRole('button',{name:'Отправляем…'}).props.accessibilityState.disabled).toBe(true));await fireEvent.press(view.getByRole('button',{name:'Отправляем…'}));expect(api.create).toHaveBeenCalledTimes(1);expect(view.queryByText('Активный доступ')).toBeNull();
    await act(async()=>resolve(active));await waitFor(()=>expect(view.getByText('Активный доступ')).toBeTruthy());
    await prepare(view);await fireEvent.press(view.getByRole('button',{name:'Подтвердить передачу'}));await waitFor(()=>expect(view.getByRole('button',{name:'Повторить тот же запрос'})).toBeTruthy());
    expect(view.getByRole('button',{name:'Отмена'}).props.accessibilityState.disabled).toBe(true);await fireEvent.press(view.getByRole('button',{name:'Повторить тот же запрос'}));await waitFor(()=>expect(api.create).toHaveBeenCalledTimes(3));
    expect(api.create.mock.calls[2].slice(0,5)).toEqual(api.create.mock.calls[1].slice(0,5));
  });
  it.each(['CANCELLED_BY_USER','CANCELLED_BY_CLINIC','NO_SHOW'])('terminal appointment %s may view/revoke an old grant but never select new resources',async state=>{
    mockAppointments=[{...appointment,state}];api.context.mockResolvedValue({...context,eligible:false,shares:[active]});
    const view=await render(<MedicalSharingScreen api={api} onBack={jest.fn()}/>);await fireEvent.press(view.getByRole('button',{name:'Просмотреть предоставленный доступ'}));await waitFor(()=>expect(view.getByText('Активный доступ')).toBeTruthy());
    expect(view.queryAllByRole('checkbox')).toHaveLength(0);expect(view.queryByRole('button',{name:'Продолжить к подтверждению'})).toBeNull();expect(view.getByRole('button',{name:'Отозвать доступ'})).toBeTruthy();
  });
  it.each(['CONFIRMED','RESCHEDULE_PROPOSED','COMPLETED'])('eligible appointment %s has the explicit create entry',async state=>{
    mockAppointments=[{...appointment,state}];const view=await open();expect(view.getByRole('button',{name:'Продолжить к подтверждению'})).toBeTruthy();expect(api.create).not.toHaveBeenCalled();
  });
  it.each(['BOOKING_STATE_CONFLICT','MEDICAL_SHARE_NOT_FOUND','IDEMPOTENCY_CONFLICT'])('fails %s closed and refreshes server authority',async code=>{
    api.create.mockRejectedValueOnce(new ApiError('CONFLICT','conflict',409,undefined,code));const view=await open();await prepare(view);await fireEvent.press(view.getByRole('button',{name:'Подтвердить передачу'}));await waitFor(()=>expect(view.queryByText('Питомец: Барсик')).toBeNull());expect(view.queryByText('Активный доступ')).toBeNull();
    await fireEvent.press(view.getByRole('button',{name:'Обновить данные доступа'}));await waitFor(()=>expect(view.getByText('Питомец: Барсик')).toBeTruthy());expect(api.context).toHaveBeenCalledTimes(2);
  });
  it('refresh may add selectable resources but never widens existing grant readback',async()=>{
    api.context.mockResolvedValueOnce({...context,resources:active.resources,resourceDetails:context.resourceDetails.filter(item=>item.type==='DOCUMENT'),shares:[active]}).mockResolvedValue({...context,shares:[active]});const view=await open();expect(view.getAllByText(/history.pdf/)).toHaveLength(2);expect(view.queryAllByText(/Результат приёма ·/)).toHaveLength(0);
    await fireEvent.press(view.getByRole('button',{name:'Обновить данные доступа'}));await waitFor(()=>expect(view.getAllByText(/Результат приёма ·/)).toHaveLength(1));expect(view.getAllByText(/history.pdf/)).toHaveLength(2);expect(api.create).not.toHaveBeenCalled();
  });
  it('rejects foreign context without displaying pet data',async()=>{
    api.context.mockResolvedValue({...context,petId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});const view=await render(<MedicalSharingScreen api={api} onBack={jest.fn()}/>);await fireEvent.press(view.getByRole('button',{name:'Поделиться медицинскими данными'}));await waitFor(()=>expect(view.getByText(/Не удалось загрузить данные доступа/)).toBeTruthy());expect(view.queryByText('Питомец: Барсик')).toBeNull();
  });
  it('accessibility escape cancels confirmation without submitting',async()=>{
    const view=await open();await prepare(view);await fireEvent(view.getByLabelText('Подтверждение доступа'),'accessibilityEscape');expect(view.queryByText('Подтвердите передачу выбранных данных')).toBeNull();expect(api.create).not.toHaveBeenCalled();
  });
  it('session change discards old scope and ignores late mutation success',async()=>{
    let resolve!:(value:typeof active)=>void;api.create.mockReturnValue(new Promise(value=>{resolve=value;}));const view=await open();await prepare(view);await fireEvent.press(view.getByRole('button',{name:'Подтвердить передачу'}));await waitFor(()=>expect(api.create).toHaveBeenCalledTimes(1));
    mockSession=null;await view.rerender(<MedicalSharingScreen api={api} onBack={jest.fn()}/>);await act(async()=>resolve(active));expect(view.queryByText('Питомец: Барсик')).toBeNull();expect(view.queryByText('Доступ предоставлен — подтверждено сервером')).toBeNull();expect(view.getByText('Для доступа к записям войдите в аккаунт')).toBeTruthy();
  });
});

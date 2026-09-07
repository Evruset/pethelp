import { fireEvent, render } from '@testing-library/react-native';
import { ClinicCatalogScreen, formatNextAvailability } from './ClinicCatalogScreen';

const mockUseQuery=jest.fn();
jest.mock('@tanstack/react-query',()=>({useQuery:(input:unknown)=>mockUseQuery(input)}));
jest.mock('@/session/SessionProvider',()=>({useSession:()=>({session:{cacheScope:'owner',opaqueCredential:'token'}})}));

describe('ClinicCatalogScreen',()=>{
  const decisionSummary={nextAvailability:{startsAt:'2026-08-14T08:00:00.000Z',localDate:'2026-08-14',localTime:'11:00',timezone:'Europe/Moscow'},informationalPrice:{kind:'FROM',amount:'1250.00',currency:'RUB'},confirmation:{mode:'MANUAL'}};
  it('renders content and hands off only clinic/location identity',async()=>{
    const onOpenClinic=jest.fn();
    mockUseQuery.mockReturnValue({isPending:false,isError:false,data:{observedAt:'2026-08-13T08:00:00.000Z',clinics:[{clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Clinic',address:'Address',phone:'+7000',decisionSummary}]}});
    const screen=await render(<ClinicCatalogScreen onClose={jest.fn()} onOpenClinic={onOpenClinic}/>);
    const clinicAction=screen.getByRole('button',{name:'Clinic. Address. Открыть клинику'});
    fireEvent.press(clinicAction);
    expect(onOpenClinic).toHaveBeenCalledWith({clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222'});
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.queryByText('Без выдуманных рейтингов')).toBeNull();
    expect(screen.queryByText('Без неподтверждённого расстояния')).toBeNull();
    expect(screen.getByText('Завтра, 11:00')).toBeTruthy();
    expect(screen.getByText(/от 1.?250 ₽/)).toBeTruthy();
    expect(screen.getByText('Подтверждение клиникой')).toBeTruthy();
    expect(screen.getByText('После отправки клиника подтвердит запись.')).toBeTruthy();
    for(const raw of ['MANUAL','FROM','RUB','2026-08-14T08:00:00.000Z','Europe/Moscow'])expect(screen.queryByText(raw)).toBeNull();
  });
  it('formats supplied clinic-local dates without converting through device timezone',()=>{const next={startsAt:'2026-08-13T21:30:00.000Z',localDate:'2026-08-14',localTime:'00:30',timezone:'Europe/Moscow'},observedAt='2026-08-13T22:00:00.000Z';expect(formatNextAvailability(next,observedAt)).toBe('Сегодня, 00:30');expect(formatNextAvailability({...next,localDate:'2026-08-15',localTime:'10:00'},observedAt)).toBe('Завтра, 10:00');expect(formatNextAvailability({...next,localDate:'2026-09-12',localTime:'14:30'},observedAt)).toBe('12 сентября, 14:30');});
  it('omits unavailable decision facts without fabricating price or time',async()=>{mockUseQuery.mockReturnValue({isPending:false,isError:false,data:{observedAt:'2026-08-13T08:00:00.000Z',clinics:[{clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Clinic',address:'Address',phone:null,decisionSummary:{nextAvailability:null,informationalPrice:null,confirmation:{mode:'MANUAL'}}}]}});const screen=await render(<ClinicCatalogScreen onClose={jest.fn()} onOpenClinic={jest.fn()}/>);expect(screen.queryByText(/0 ₽|Цена уточняется|Ближайшее время/)).toBeNull();expect(screen.getByText('Подтверждение клиникой')).toBeTruthy();});
  it.each([
    [{isPending:true,isError:false},'Загружаем клиники'],
    [{isPending:false,isError:false,data:{clinics:[]}},'Сейчас нет клиник для онлайн-записи'],
    [{isPending:false,isError:true,refetch:jest.fn()},'Не удалось загрузить клиники'],
  ])('renders deterministic state %#',async(state,label)=>{mockUseQuery.mockReturnValue(state);expect((await render(<ClinicCatalogScreen onClose={jest.fn()} onOpenClinic={jest.fn()}/>)).getByText(label)).toBeTruthy();});
  it('retries a technical failure',async()=>{const refetch=jest.fn();mockUseQuery.mockReturnValue({isPending:false,isError:true,refetch});const screen=await render(<ClinicCatalogScreen onClose={jest.fn()} onOpenClinic={jest.fn()}/>);fireEvent.press(screen.getByText('Повторить'));expect(refetch).toHaveBeenCalledTimes(1);});
  it.each([[[],'Сейчас нет клиник для онлайн-записи'],[[{clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Stale',address:'Stale address',phone:null,decisionSummary}],'Stale']])('never renders stale content as current on technical failure',async(clinics,staleText)=>{mockUseQuery.mockReturnValue({isPending:false,isError:true,refetch:jest.fn(),data:{observedAt:'2026-08-13T08:00:00.000Z',clinics}});const screen=await render(<ClinicCatalogScreen onClose={jest.fn()} onOpenClinic={jest.fn()}/>);expect(screen.queryByText(staleText)).toBeNull();expect(screen.getByText('Не удалось загрузить клиники')).toBeTruthy();});
});

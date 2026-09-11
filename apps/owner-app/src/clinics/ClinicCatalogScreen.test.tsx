import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ClinicCatalogScreen } from './ClinicCatalogScreen';

const mockUseQuery=jest.fn();
jest.mock('@tanstack/react-query',()=>({useQuery:(input:unknown)=>mockUseQuery(input)}));
jest.mock('@/session/SessionProvider',()=>({useSession:()=>({session:{cacheScope:'owner',opaqueCredential:'token'}})}));

describe('ClinicCatalogScreen',()=>{
  it('renders content and hands off only clinic/location identity',async()=>{
    const onOpenClinic=jest.fn();
    mockUseQuery.mockReturnValue({isPending:false,isError:false,data:{clinics:[{clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Clinic',address:'Address',phone:'+7000'}]}});
    const screen=await render(<ClinicCatalogScreen onClose={jest.fn()} onOpenClinic={onOpenClinic}/>);
    expect(screen.queryByRole('button',{name:'Сегодня'})).toBeNull();
    expect(screen.queryByRole('button',{name:'Цена'})).toBeNull();
    expect(screen.queryByRole('button',{name:'Ближе'})).toBeNull();
    expect(screen.queryByRole('button',{name:'Уверенность'})).toBeNull();
    expect(screen.getByText('Clinic')).toBeTruthy();expect(screen.getByText('Address')).toBeTruthy();expect(screen.getByText('+7000')).toBeTruthy();
    expect(screen.getByText('Филиал · Address')).toBeTruthy();
    fireEvent.press(screen.getByText('Открыть клинику'));
    expect(onOpenClinic).toHaveBeenCalledWith({clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222'});
  });

  it('truthfully filters the bounded catalog by clinic or branch address',async()=>{
    mockUseQuery.mockReturnValue({isPending:false,isError:false,data:{clinics:[
      {clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'VetHelp Demo Center',address:'Тверская, 1',phone:null},
      {clinicId:'11111111-1111-4111-8111-111111111111',locationId:'33333333-3333-4333-8333-333333333333',name:'VetHelp Demo Center',address:'Арбат, 2',phone:null},
    ]}});
    const screen=await render(<ClinicCatalogScreen onClose={jest.fn()} onOpenClinic={jest.fn()}/>);
    expect(screen.getByText('Филиал · Тверская, 1')).toBeTruthy();
    expect(screen.getByText('Филиал · Арбат, 2')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Поиск по клинике или адресу'),'Арбат');
    await waitFor(()=>expect(screen.queryByText('Филиал · Тверская, 1')).toBeNull());
    expect(screen.getByText('Филиал · Арбат, 2')).toBeTruthy();
  });

  it('opens a browse-first catalog without pretending pet selection is required',async()=>{
    mockUseQuery.mockReturnValue({isPending:false,isError:false,data:{clinics:[]}});
    const screen=await render(<ClinicCatalogScreen mode="browse" onClose={jest.fn()} onOpenClinic={jest.fn()}/>);
    expect(screen.getByText('Клиники VetHelp')).toBeTruthy();
    expect(screen.getByText(/питомца попросим выбрать только когда/i)).toBeTruthy();
  });

  it('restores a retained clinic selection after Back',async()=>{
    const locationId='22222222-2222-4222-8222-222222222222';
    mockUseQuery.mockReturnValue({isPending:false,isError:false,data:{clinics:[{clinicId:'11111111-1111-4111-8111-111111111111',locationId,name:'Clinic',address:'Address',phone:null}]}});
    const screen=await render(<ClinicCatalogScreen initialSelectedLocationId={locationId} onClose={jest.fn()} onOpenClinic={jest.fn()}/>);
    expect(screen.getByText('Clinic')).toBeTruthy();
  });

  it('keeps nearest-time entry truthful until service inventory is known',async()=>{
    mockUseQuery.mockReturnValue({isPending:false,isError:false,data:{clinics:[]}});
    const screen=await render(<ClinicCatalogScreen mode="time" onClose={jest.fn()} onOpenClinic={jest.fn()}/>);
    expect(screen.getByText('Где искать ближайшее время')).toBeTruthy();
    expect(screen.getByText('Точное свободное время появится после выбора клиники и услуги.')).toBeTruthy();
  });

  it.each([
    [{isPending:true,isError:false},'Загружаем клиники'],
    [{isPending:false,isError:false,data:{clinics:[]}},'Сейчас нет клиник для онлайн-записи'],
    [{isPending:false,isError:true,refetch:jest.fn()},'Не удалось загрузить клиники'],
  ])('renders deterministic state %#',async(state,label)=>{mockUseQuery.mockReturnValue(state);expect((await render(<ClinicCatalogScreen onClose={jest.fn()} onOpenClinic={jest.fn()}/>)).getByText(label)).toBeTruthy();});
  it('retries a technical failure',async()=>{const refetch=jest.fn();mockUseQuery.mockReturnValue({isPending:false,isError:true,refetch});const screen=await render(<ClinicCatalogScreen onClose={jest.fn()} onOpenClinic={jest.fn()}/>);fireEvent.press(screen.getByText('Повторить'));expect(refetch).toHaveBeenCalledTimes(1);});
  it.each([[[],'Сейчас нет клиник для онлайн-записи'],[[{clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Stale',address:'Stale address',phone:null}],'Stale']])('never renders stale content as current on technical failure',async(clinics,staleText)=>{mockUseQuery.mockReturnValue({isPending:false,isError:true,refetch:jest.fn(),data:{clinics}});const screen=await render(<ClinicCatalogScreen onClose={jest.fn()} onOpenClinic={jest.fn()}/>);expect(screen.queryByText(staleText)).toBeNull();expect(screen.getByText('Не удалось загрузить клиники')).toBeTruthy();});
});

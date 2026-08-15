import { fireEvent, render } from '@testing-library/react-native';
import { ClinicCatalogScreen } from './ClinicCatalogScreen';

const mockUseQuery=jest.fn();
jest.mock('@tanstack/react-query',()=>({useQuery:(input:unknown)=>mockUseQuery(input)}));
jest.mock('@/session/SessionProvider',()=>({useSession:()=>({session:{cacheScope:'owner',opaqueCredential:'token'}})}));

describe('ClinicCatalogScreen',()=>{
  it('renders content and hands off only clinic/location identity',async()=>{
    const onOpenClinic=jest.fn();
    mockUseQuery.mockReturnValue({isPending:false,isError:false,data:{clinics:[{clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Clinic',address:'Address',phone:'+7000'}]}});
    const screen=await render(<ClinicCatalogScreen onClose={jest.fn()} onOpenClinic={onOpenClinic}/>);
    fireEvent.press(screen.getByText('Открыть клинику'));
    expect(onOpenClinic).toHaveBeenCalledWith({clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222'});
  });
  it.each([
    [{isPending:true,isError:false},'Загружаем клиники'],
    [{isPending:false,isError:false,data:{clinics:[]}},'Сейчас нет клиник для онлайн-записи'],
    [{isPending:false,isError:true,refetch:jest.fn()},'Не удалось загрузить клиники'],
  ])('renders deterministic state %#',async(state,label)=>{mockUseQuery.mockReturnValue(state);expect((await render(<ClinicCatalogScreen onClose={jest.fn()} onOpenClinic={jest.fn()}/>)).getByText(label)).toBeTruthy();});
  it('retries a technical failure',async()=>{const refetch=jest.fn();mockUseQuery.mockReturnValue({isPending:false,isError:true,refetch});const screen=await render(<ClinicCatalogScreen onClose={jest.fn()} onOpenClinic={jest.fn()}/>);fireEvent.press(screen.getByText('Повторить'));expect(refetch).toHaveBeenCalledTimes(1);});
  it.each([[[],'Сейчас нет клиник для онлайн-записи'],[[{clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Stale',address:'Stale address',phone:null}],'Stale']])('never renders stale content as current on technical failure',async(clinics,staleText)=>{mockUseQuery.mockReturnValue({isPending:false,isError:true,refetch:jest.fn(),data:{clinics}});const screen=await render(<ClinicCatalogScreen onClose={jest.fn()} onOpenClinic={jest.fn()}/>);expect(screen.queryByText(staleText)).toBeNull();expect(screen.getByText('Не удалось загрузить клиники')).toBeTruthy();});
});

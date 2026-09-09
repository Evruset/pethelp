import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PetDiaryScreen } from './PetDiaryScreen';

const PET_A='11111111-1111-4111-8111-111111111111';
const PET_B='22222222-2222-4222-8222-222222222222';
const RESULT_A='33333333-3333-4333-8333-333333333333';
const RESULT_B='44444444-4444-4444-8444-444444444444';
const mockRefetch=jest.fn();
let mockQueryState:Record<string,unknown>;
let mockQueryOptions:Record<string,unknown>;

jest.mock('@tanstack/react-query',()=>({useQuery:(options:Record<string,unknown>)=>{mockQueryOptions=options;return mockQueryState;}}));
jest.mock('@/session/SessionProvider',()=>({useSession:()=>({session:{cacheScope:'owner-a',opaqueCredential:'credential-a'}})}));

const entry=(overrides:Record<string,unknown>={})=>({
  visit:{visitId:'55555555-5555-4555-8555-555555555555',occurredAt:'2026-06-10T08:00:00.000Z',clinic:{name:'Добрый ветеринар'},location:{address:'ул. Мира, 1'},service:{name:'Осмотр'},doctor:{name:'Анна Петрова'}},
  result:{resultId:RESULT_A,publishedAt:'2026-08-20T08:00:00.000Z',content:'Состояние стабильное.'},
  amendments:[],
  ...overrides,
});

describe('PetDiaryScreen',()=>{
  beforeEach(()=>{mockRefetch.mockReset();mockQueryState={isPending:false,isError:false,data:{petId:PET_A,clinicalEntries:[]},refetch:mockRefetch};});

  it('uses an owner-and-pet-scoped query and renders the neutral empty state',async()=>{
    const view=await render(<PetDiaryScreen petId={PET_A} petName="Рекс" onBack={jest.fn()} onSwitchPet={jest.fn()}/>);
    expect(mockQueryOptions.queryKey).toEqual(['owner','owner-a','pet-diary',PET_A]);
    expect(view.getByText('Здесь появятся результаты приёмов после публикации клиникой.')).toBeTruthy();
  });

  it('keeps backend result order and uses the visit date instead of publication date',async()=>{
    mockQueryState={...mockQueryState,data:{petId:PET_A,clinicalEntries:[entry(),entry({visit:{...entry().visit,visitId:'66666666-6666-4666-8666-666666666666',occurredAt:'2026-05-01T08:00:00.000Z'},result:{resultId:RESULT_B,publishedAt:'2026-09-01T08:00:00.000Z',content:'Второй результат.'}})]}};
    const view=await render(<PetDiaryScreen petId={PET_A} petName="Рекс" onBack={jest.fn()} onSwitchPet={jest.fn()}/>);
    const text=view.getAllByRole('button').map((node)=>node.props.accessibilityLabel).filter(Boolean);
    expect(text[1]).toContain('10 июня 2026');
    expect(text[2]).toContain('1 мая 2026');
    expect(view.queryByText(/20 августа|1 сентября/)).toBeNull();
  });

  it('shows original content before amendments and preserves amendment order',async()=>{
    mockQueryState={...mockQueryState,data:{petId:PET_A,clinicalEntries:[entry({amendments:[{amendmentId:'77777777-7777-4777-8777-777777777777',publishedAt:'2026-06-11T08:00:00.000Z',content:'Первое уточнение.'},{amendmentId:'88888888-8888-4888-8888-888888888888',publishedAt:'2026-06-12T08:00:00.000Z',content:'Второе уточнение.'}]})]}};
    const view=await render(<PetDiaryScreen petId={PET_A} petName="Рекс" onBack={jest.fn()} onSwitchPet={jest.fn()}/>);
    fireEvent.press(view.getByLabelText(/Открыть результат приёма/));
    await waitFor(()=>expect(view.getByText('Исходный результат')).toBeTruthy());
    const all=view.toJSON(); const serialized=JSON.stringify(all);
    expect(serialized.indexOf('Состояние стабильное.')).toBeLessThan(serialized.indexOf('Первое уточнение.'));
    expect(serialized.indexOf('Первое уточнение.')).toBeLessThan(serialized.indexOf('Второе уточнение.'));
    expect(view.getByText('Исходный результат остаётся частью истории приёма. Уточнения опубликованы позже и не являются отдельными приёмами.')).toBeTruthy();
  });

  it('omits absent optional visit facts without exposing identifiers',async()=>{
    mockQueryState={...mockQueryState,data:{petId:PET_A,clinicalEntries:[entry({visit:{...entry().visit,location:null,service:null,doctor:null}})]}};
    const view=await render(<PetDiaryScreen petId={PET_A} petName="Рекс" onBack={jest.fn()} onSwitchPet={jest.fn()}/>);
    expect(view.getByText('Добрый ветеринар')).toBeTruthy();
    expect(view.queryByText(RESULT_A)).toBeNull();
  });

  it('shows the loading state',async()=>{
    mockQueryState={isPending:true,isError:false,data:undefined,refetch:mockRefetch};
    const loading=await render(<PetDiaryScreen petId={PET_A} petName="Рекс" onBack={jest.fn()} onSwitchPet={jest.fn()}/>);
    expect(loading.getByText('Загружаем дневник')).toBeTruthy();
  });

  it('retries a technical error',async()=>{
    mockQueryState={isPending:false,isError:true,data:undefined,refetch:mockRefetch};
    const error=await render(<PetDiaryScreen petId={PET_A} petName="Рекс" onBack={jest.fn()} onSwitchPet={jest.fn()}/>);
    fireEvent.press(error.getByText('Повторить')); expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('does not render foreign-pet data',async()=>{
    mockQueryState={isPending:false,isError:false,data:{petId:PET_B,clinicalEntries:[entry()]},refetch:mockRefetch};
    const foreign=await render(<PetDiaryScreen petId={PET_A} petName="Рекс" onBack={jest.fn()} onSwitchPet={jest.fn()}/>);
    expect(foreign.getByText('Дневник недоступен')).toBeTruthy();
    expect(foreign.queryByText('Состояние стабильное.')).toBeNull();
  });

  it('clears selected detail when the selected pet changes',async()=>{
    mockQueryState={...mockQueryState,data:{petId:PET_A,clinicalEntries:[entry()]}};
    const view=await render(<PetDiaryScreen petId={PET_A} petName="Рекс" onBack={jest.fn()} onSwitchPet={jest.fn()}/>);
    fireEvent.press(view.getByLabelText(/Открыть результат приёма/));
    await waitFor(()=>expect(view.getByText('Исходный результат')).toBeTruthy());
    mockQueryState={...mockQueryState,data:{petId:PET_B,clinicalEntries:[]}};
    await view.rerender(<PetDiaryScreen petId={PET_B} petName="Луна" onBack={jest.fn()} onSwitchPet={jest.fn()}/>);
    await waitFor(()=>expect(view.queryByText('Исходный результат')).toBeNull());
    expect(view.getByText('Дневник: Луна')).toBeTruthy();
  });
});

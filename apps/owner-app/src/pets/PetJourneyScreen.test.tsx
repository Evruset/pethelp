import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { PetJourneyScreen } from './PetJourneyScreen';

const mockJourney = { active: true, pets: [] as {petId:string;name:string;species:'DOG'|'CAT'|'OTHER';createdAt:string;updatedAt:string}[], selectedPetId: null as string|null, selectionStale: false, loading: false, error: false, creating: false, createError: false, start: jest.fn(), cancel: jest.fn(), select: jest.fn(), retry: jest.fn(), continueSelection: jest.fn(), create: jest.fn().mockResolvedValue(undefined) };
jest.mock('./PetJourneyProvider', () => ({ usePetJourney: () => mockJourney }));

beforeEach(() => { mockJourney.pets=[]; mockJourney.selectedPetId=null; mockJourney.selectionStale=false; mockJourney.loading=false; mockJourney.error=false; mockJourney.creating=false; jest.clearAllMocks(); });

it('keeps loading distinct', async () => {
  mockJourney.loading=true; const loading=await render(<PetJourneyScreen />); expect(loading.getByText('Загружаем питомцев')).toBeTruthy();
});
it('keeps technical failure distinct and retryable', async () => {
  mockJourney.error=true; const failed=await render(<PetJourneyScreen />); expect(failed.getByText('Не удалось загрузить питомцев')).toBeTruthy(); await act(async()=>fireEvent.press(failed.getByText('Повторить'))); expect(mockJourney.retry).toHaveBeenCalled();
});
it('renders a true empty state', async () => {
  const empty=await render(<PetJourneyScreen />); expect(empty.getByText('У вас пока нет питомцев')).toBeTruthy();
});

it('creates from the zero state and leaves selection authoritative to the provider', async () => {
  const screen=await render(<PetJourneyScreen />); await act(async()=>fireEvent.press(screen.getByText('Добавить питомца')));
  await act(async()=>fireEvent.changeText(screen.getByLabelText('Имя питомца'),'  Мурка  ')); await act(async()=>fireEvent.press(screen.getByText('CAT'))); await act(async()=>fireEvent.press(screen.getByText('Сохранить питомца')));
  await waitFor(() => expect(mockJourney.create).toHaveBeenCalledWith({ name:'Мурка', species:'CAT' }));
});

it('shows exactly one selected pet in an N list and permits explicit change', async () => {
  mockJourney.pets=[
    {petId:'11111111-1111-4111-8111-111111111111',name:'Ася',species:'CAT',createdAt:'2026-01-01',updatedAt:'2026-01-01'},
    {petId:'22222222-2222-4222-8222-222222222222',name:'Рекс',species:'DOG',createdAt:'2026-01-02',updatedAt:'2026-01-02'},
  ]; mockJourney.selectedPetId=mockJourney.pets[0].petId;
  const screen=await render(<PetJourneyScreen />); const radios=screen.getAllByRole('radio'); expect(radios.filter((item)=>item.props.accessibilityState?.selected)).toHaveLength(1); await act(async()=>fireEvent.press(screen.getByText('Рекс'))); expect(mockJourney.select).toHaveBeenCalledWith(mockJourney.pets[1].petId);
});

it('announces stale selection and hands exactly one selected pet to continuation', async () => {
  mockJourney.selectionStale=true; const stale=await render(<PetJourneyScreen />); expect(stale.getByText(/больше недоступен/)).toBeTruthy(); await stale.unmount();
  mockJourney.selectionStale=false; mockJourney.selectedPetId='11111111-1111-4111-8111-111111111111'; mockJourney.pets=[{petId:mockJourney.selectedPetId,name:'Ася',species:'CAT',createdAt:'2026-01-01',updatedAt:'2026-01-01'}];
  const selected=await render(<PetJourneyScreen />); await act(async()=>fireEvent.press(selected.getByText('Продолжить'))); expect(mockJourney.continueSelection).toHaveBeenCalledTimes(1);
});

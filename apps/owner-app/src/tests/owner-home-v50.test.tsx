import { fireEvent, render } from '@testing-library/react-native';
import { OwnerHome } from '@/app/(app)';

const PET={petId:'22222222-2222-4222-8222-222222222222',name:'Барни',species:'DOG' as const,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'};

it('renders the Care Normal hierarchy and keeps authoritative workflow actions', async () => {
  const onBook=jest.fn(),onDiary=jest.fn(),onLogout=jest.fn();
  const view=await render(<OwnerHome onBook={onBook} onDiary={onDiary} onLogout={onLogout} currentPet={PET} petCount={1}/>);
  expect(view.getByLabelText('Основная навигация')).toBeTruthy();
  expect(view.getByRole('header',{name:'Что важно сегодня'})).toBeTruthy();
  expect(view.getByText('Барни')).toBeTruthy();
  expect(view.getByText('Запись появится здесь')).toBeTruthy();
  fireEvent.press(view.getByText('Записаться')); fireEvent.press(view.getAllByText('Открыть дневник')[0]); fireEvent.press(view.getByText('Выйти'));
  expect(onBook).toHaveBeenCalledTimes(1); expect(onDiary).toHaveBeenCalledTimes(1); expect(onLogout).toHaveBeenCalledTimes(1);
});

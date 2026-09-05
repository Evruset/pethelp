import { fireEvent, render } from '@testing-library/react-native';
import { OwnerHome } from '@/app/(app)';

const PET={petId:'22222222-2222-4222-8222-222222222222',name:'Барни',species:'DOG' as const,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'};

it('renders the V50 Home composition and keeps authoritative workflow actions', async () => {
  const onBook=jest.fn(),onDiary=jest.fn(),onLogout=jest.fn();
  const view=await render(<OwnerHome onBook={onBook} onDiary={onDiary} onLogout={onLogout} currentPet={PET} petCount={1}/>);
  expect(view.getByLabelText('Основная навигация')).toBeTruthy();
  expect(view.getByRole('header',{name:'Доброе утро!'})).toBeTruthy();
  expect(view.getByText('Найти клинику для Барни')).toBeTruthy();
  expect(view.getByText('Польза сразу')).toBeTruthy();
  expect(view.getByText('Подберём подходящую клинику для Барни')).toBeTruthy();
  expect(view.getByText('Выбрать клинику')).toBeTruthy();
  expect(view.getByText('Найти время')).toBeTruthy();
  expect(view.queryByText('Следующий шаг')).toBeNull();
  expect(view.getAllByText('Барни').length).toBeGreaterThan(0);
  expect(view.getByText('Ближайших записей пока нет')).toBeTruthy();
  expect(view.queryByText(/Home пока/)).toBeNull();
  expect(view.queryByText(/подтверждённый профиль/)).toBeNull();
  fireEvent.press(view.getAllByText('Записаться')[0]); fireEvent.press(view.getAllByText('Дневник')[0]); fireEvent.press(view.getByText('Выйти'));
  expect(onBook).toHaveBeenCalledTimes(1); expect(onDiary).toHaveBeenCalledTimes(1); expect(onLogout).toHaveBeenCalledTimes(1);
});

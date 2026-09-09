import { fireEvent, render } from '@testing-library/react-native';
import { OwnerHome } from '@/app/(app)';

const PET={petId:'22222222-2222-4222-8222-222222222222',name:'Барни',species:'DOG' as const,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'};

it('renders the V50 Home composition and keeps authoritative workflow actions', async () => {
  const onBook=jest.fn(),onClinics=jest.fn(),onFindTime=jest.fn(),onDiary=jest.fn(),onLogout=jest.fn();
  const view=await render(<OwnerHome onBook={onBook} onClinics={onClinics} onFindTime={onFindTime} onDiary={onDiary} onLogout={onLogout} currentPet={PET} petCount={1}/>);
  expect(view.getByLabelText('Основная навигация')).toBeTruthy();
  expect(view.getByRole('header',{name:'Здравствуйте!'})).toBeTruthy();
  expect(view.queryByText(/Доброе утро/)).toBeNull();
  expect(view.getByText('Что нужно Барни сейчас?')).toBeTruthy();
  expect(view.getByText('Польза сразу')).toBeTruthy();
  expect(view.getByText('Сравните варианты для Барни без звонка')).toBeTruthy();
  expect(view.getByText('Выбрать клинику')).toBeTruthy();
  expect(view.getByText('Найти время')).toBeTruthy();
  expect(view.queryByText('Следующий шаг')).toBeNull();
  expect(view.getAllByText('Барни').length).toBeGreaterThan(0);
  expect(view.queryByText('Ближайших записей пока нет')).toBeNull();
  expect(view.getByText('Нужна новая запись?')).toBeTruthy();
  expect(view.queryByText(/Home пока/)).toBeNull();
  expect(view.queryByText(/подтверждённый профиль/)).toBeNull();
  fireEvent.press(view.getAllByText('Записаться')[0]);
  fireEvent.press(view.getByText('Начать запись'));
  fireEvent.press(view.getAllByText('Выбрать клинику')[0]);
  fireEvent.press(view.getAllByText('Найти время')[0]);
  fireEvent.press(view.getAllByText('Дневник')[0]);
  fireEvent.press(view.getByText('Выйти'));
  expect(onBook).toHaveBeenCalledTimes(2);
  expect(onClinics).toHaveBeenCalledTimes(1);
  expect(onFindTime).toHaveBeenCalledTimes(1);
  expect(onDiary).toHaveBeenCalledTimes(1);
  expect(onLogout).toHaveBeenCalledTimes(1);
});

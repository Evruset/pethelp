import { fireEvent, render } from '@testing-library/react-native';
import { OwnerHome } from '@/app/(app)';

it('renders the Care Normal hierarchy and keeps authoritative workflow actions', async () => {
  const onBook=jest.fn(),onDiary=jest.fn(),onLogout=jest.fn();
  const view=await render(<OwnerHome onBook={onBook} onDiary={onDiary} onLogout={onLogout}/>);
  expect(view.getByLabelText('Основная навигация')).toBeTruthy();
  expect(view.getByRole('header',{name:'Что важно сегодня'})).toBeTruthy();
  expect(view.getByText('Ваш питомец')).toBeTruthy();
  fireEvent.press(view.getByText('Начать запись')); fireEvent.press(view.getByText('Открыть дневник')); fireEvent.press(view.getByText('Выйти'));
  expect(onBook).toHaveBeenCalledTimes(1); expect(onDiary).toHaveBeenCalledTimes(1); expect(onLogout).toHaveBeenCalledTimes(1);
});

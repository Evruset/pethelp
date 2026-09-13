import { fireEvent, render } from '@testing-library/react-native';
import { OwnerPetsScreen } from './OwnerPetsScreen';

const pet = { petId: 'pet-1', name: 'Луна', species: 'CAT' as const, createdAt: '2026-01-01', updatedAt: '2026-01-01' };

it('keeps the global pet profile distinct from a journey selector', async () => {
  const onDiary = jest.fn();
  const view = await render(<OwnerPetsScreen pets={[pet]} loading={false} error={false} onHome={jest.fn()} onClinics={jest.fn()} onDiary={onDiary} onRetry={jest.fn()} />);
  expect(view.getByRole('header', { name: 'Питомцы' })).toBeTruthy();
  expect(view.getByText('Здоровье питомца')).toBeTruthy();
  expect(view.getByText('Кошка')).toBeTruthy();
  fireEvent.press(view.getByText('Открыть дневник'));
  expect(onDiary).toHaveBeenCalledWith(pet);
});

import { fireEvent, render } from '@testing-library/react-native';
import { OwnerHome } from '@/app/(app)/index';

describe('OwnerHome V50 navigation', () => {
  it('keeps booking, clinic browsing, nearest time and diary as different actions', async () => {
    const onBook = jest.fn();
    const onClinics = jest.fn();
    const onFindTime = jest.fn();
    const onDiary = jest.fn();

    const screen = await render(
      <OwnerHome
        onBook={onBook}
        onClinics={onClinics}
        onFindTime={onFindTime}
        onDiary={onDiary}
        onLogout={jest.fn()}
      />,
    );

    fireEvent.press(screen.getAllByText('Записаться')[0]);
    expect(onBook).toHaveBeenCalledTimes(1);
    expect(onClinics).not.toHaveBeenCalled();
    expect(onFindTime).not.toHaveBeenCalled();

    fireEvent.press(screen.getAllByText('Выбрать клинику')[0]);
    expect(onClinics).toHaveBeenCalledTimes(1);
    expect(onBook).toHaveBeenCalledTimes(1);
    expect(onFindTime).not.toHaveBeenCalled();

    fireEvent.press(screen.getAllByText('Найти время')[0]);
    expect(onFindTime).toHaveBeenCalledTimes(1);
    expect(onBook).toHaveBeenCalledTimes(1);
    expect(onClinics).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getAllByText('Дневник')[0]);
    expect(onDiary).toHaveBeenCalledTimes(1);
  });
});

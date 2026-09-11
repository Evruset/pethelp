import { fireEvent, render } from '@testing-library/react-native';
import { OwnerHome } from '@/app/(app)/index';
import type { OwnerHomeSnapshot } from './owner-home-api';

const PET={id:'22222222-2222-4222-8222-222222222222',name:'Барни',species:'DOG' as const,breed:null,photoUrl:null};
const SNAPSHOT:OwnerHomeSnapshot={schemaVersion:1,serverNow:'2026-09-10T08:00:00.000Z',pets:[PET],selectedPet:PET,selectionSource:'DEFAULT',nextAction:{type:'START_PLANNED_CARE',priority:'LOW',sourceType:'PET',sourceId:PET.id,title:'Спланируйте заботу о питомце',description:'Выберите клинику.',deadlineAt:null,actionCode:'OPEN_CATALOG'},activeCare:null};

describe('OwnerHome V50 navigation', () => {
  it('keeps booking, clinics, bookings, nearest time, pets and diary as different actions', async () => {
    const onBook = jest.fn();
    const onClinics = jest.fn();
    const onBookings = jest.fn();
    const onFindTime = jest.fn();
    const onDiary = jest.fn();
    const onPets = jest.fn();

    const screen = await render(
      <OwnerHome
        onBook={onBook}
        onClinics={onClinics}
        onBookings={onBookings}
        onPets={onPets}
        onFindTime={onFindTime}
        onDiary={onDiary}
        onLogout={jest.fn()}
        snapshot={SNAPSHOT}
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

    fireEvent.press(screen.getByRole('button', { name: 'Записи' }));
    expect(onBookings).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByRole('button', { name: /Питомцы/ }));
    expect(onPets).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getAllByText('Дневник')[0]);
    expect(onDiary).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });
});

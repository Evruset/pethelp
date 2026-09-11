import { fireEvent, render } from '@testing-library/react-native';
import { OwnerHome } from '@/app/(app)';
import type { OwnerHomeSnapshot } from './owner-home-api';

const PET={id:'22222222-2222-4222-8222-222222222222',name:'Барни',species:'DOG' as const,breed:null,photoUrl:null};
const ATTENTION:OwnerHomeSnapshot={schemaVersion:1,serverNow:'2026-09-10T08:00:00.000Z',pets:[PET],selectedPet:PET,selectionSource:'DEFAULT',nextAction:{type:'BOOKING_REQUIRES_ACTION',priority:'NORMAL',sourceType:'BOOKING_HOLD',sourceId:'33333333-3333-4333-8333-333333333333',title:'Запись требует внимания',description:'Подтвердите изменения.',deadlineAt:'2026-09-12T08:00:00.000Z',actionCode:'OPEN_APPOINTMENT'},activeCare:{sourceType:'BOOKING_HOLD',sourceId:'33333333-3333-4333-8333-333333333333',statusCode:'OWNER_ACTION_REQUIRED',title:'Добрый ветеринар',description:'Подтвердите изменения.',startsAt:'2026-09-12T08:00:00.000Z',deadlineAt:'2026-09-12T08:00:00.000Z',clinicName:'Добрый ветеринар',petId:PET.id,actionCode:'OPEN_APPOINTMENT'}};

it('renders server-authored attention without inventing unsupported navigation',async()=>{
  const onAction=jest.fn();
  const view=await render(<OwnerHome onBook={jest.fn()} onClinics={jest.fn()} onPets={jest.fn()} onFindTime={jest.fn()} onDiary={jest.fn()} onLogout={jest.fn()} snapshot={ATTENTION} onHomeAction={onAction}/>);
  expect(view.getByText('Запись требует внимания')).toBeTruthy();
  expect(view.getByText('Подтвердите изменения.')).toBeTruthy();
  expect(view.getByText('Важно')).toBeTruthy();
  expect(view.getByText(/12 сентября 2026/)).toBeTruthy();
  expect(view.queryByText(/OPEN_APPOINTMENT|33333333/)).toBeNull();
  expect(onAction).not.toHaveBeenCalled();
  await view.unmount();
});

it('retains the last snapshot on refresh failure with bounded retry',async()=>{
  const retry=jest.fn();
  const view=await render(<OwnerHome onBook={jest.fn()} onClinics={jest.fn()} onPets={jest.fn()} onFindTime={jest.fn()} onDiary={jest.fn()} onLogout={jest.fn()} snapshot={ATTENTION} homeError onRetryHome={retry}/>);
  expect(view.getByText('Запись требует внимания')).toBeTruthy();
  expect(view.getByText(/последняя сохранённая информация/)).toBeTruthy();
  fireEvent.press(view.getByText('Повторить обновление'));
  expect(retry).toHaveBeenCalledTimes(1);
  await view.unmount();
});

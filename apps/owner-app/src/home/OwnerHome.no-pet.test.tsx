import { fireEvent, render } from '@testing-library/react-native';
import { OwnerHome } from '@/app/(app)';
import type { OwnerHomeSnapshot } from './owner-home-api';

const EMPTY:OwnerHomeSnapshot={schemaVersion:1,serverNow:'2026-09-10T08:00:00.000Z',pets:[],selectedPet:null,selectionSource:'NONE',nextAction:{type:'NONE',priority:'LOW',sourceType:'NONE',sourceId:null,title:'Добавьте питомца',description:'Создайте профиль питомца, чтобы начать планировать помощь.',deadlineAt:null,actionCode:'ADD_PET'},activeCare:null};

it('renders the server-authored no-pet state and wires the existing Pet journey',async()=>{
  const onAction=jest.fn();
  const view=await render(<OwnerHome onBook={jest.fn()} onClinics={jest.fn()} onPets={jest.fn()} onFindTime={jest.fn()} onDiary={jest.fn()} onLogout={jest.fn()} snapshot={EMPTY} onHomeAction={onAction}/>);
  expect(view.getAllByText('Добавьте питомца').length).toBeGreaterThan(0);
  fireEvent.press(view.getByRole('button',{name:'Добавить питомца'}));
  expect(onAction).toHaveBeenCalledWith('ADD_PET');
  await view.unmount();
});

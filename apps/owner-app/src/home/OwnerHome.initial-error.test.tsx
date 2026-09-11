import { render } from '@testing-library/react-native';
import { OwnerHome } from '@/app/(app)';

it('renders a hard initial error without a static booking claim',async()=>{
  const view=await render(<OwnerHome onBook={jest.fn()} onClinics={jest.fn()} onPets={jest.fn()} onFindTime={jest.fn()} onDiary={jest.fn()} onLogout={jest.fn()} homeError/>);
  expect(view.getByText('Не удалось загрузить следующий шаг')).toBeTruthy();
  expect(view.queryByText('Нужна новая запись?')).toBeNull();
  await view.unmount();
});

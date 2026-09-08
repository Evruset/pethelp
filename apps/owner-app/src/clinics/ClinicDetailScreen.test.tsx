import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ClinicDetailScreen } from './ClinicDetailScreen';

const mockUseQuery = jest.fn();
jest.mock('@tanstack/react-query', () => ({ useQuery: (...args: unknown[]) => mockUseQuery(...args) }));
jest.mock('@/session/SessionProvider', () => ({ useSession: () => ({ session: { cacheScope: 'owner-a', opaqueCredential: 'credential-a' } }) }));

const data = { observedAt: '2026-09-07T12:00:00.000Z', clinicId: '11111111-1111-4111-8111-111111111111', locationId: '22222222-2222-4222-8222-222222222222', name: 'Клиника', address: 'Москва', phone: '+7 495 000-00-00', services: [{ serviceId: '33333333-3333-4333-8333-333333333333', name: 'Осмотр', price: { kind: 'INFORMATIONAL', amount: '1000.00', currency: 'RUB' } }] };

it('renders an authority-backed clinic decision state before service selection', async () => {
  mockUseQuery.mockReturnValue({ isPending: false, isError: false, data, refetch: jest.fn() });
  const onChooseService = jest.fn();
  const view = await render(<ClinicDetailScreen clinic={{ clinicId: data.clinicId, locationId: data.locationId }} onBack={jest.fn()} onChooseService={onChooseService} />);
  expect(view.getAllByText('Клиника').length).toBeGreaterThan(0);
  expect(view.getByText('Москва')).toBeTruthy();
  expect(view.queryByText(/рейтинг|отзыв|врач|км/i)).toBeNull();
  fireEvent.press(view.getByText('Выбрать услугу'));
  await waitFor(() => expect(onChooseService).toHaveBeenCalledTimes(1));
});

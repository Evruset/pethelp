import { render } from '@testing-library/react-native';

import PublicHomeScreen from '@/app/(public)/index';

jest.mock('@/auth/AuthJourneyProvider', () => ({
  useAuthJourney: () => ({
    phase: 'idle', phone: '', code: '', challenge: null, message: null, resumedIntent: null,
    start: jest.fn(), cancel: jest.fn(), setPhone: jest.fn(), setCode: jest.fn(), requestOtp: jest.fn(), verifyOtp: jest.fn(), resendOtp: jest.fn(), consumeResumedIntent: jest.fn(),
  }),
}));

it('resolves the public placeholder route', async () => {
  const view = await render(<PublicHomeScreen />);
  expect(view.getByLabelText('Публичный вход')).toBeTruthy();
  expect(view.getByText('Вы можете начать запись до входа.')).toBeTruthy();
});

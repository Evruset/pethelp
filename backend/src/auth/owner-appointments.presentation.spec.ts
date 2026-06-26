import { ownerAppointmentPresentation } from './owner-appointments.service';

describe('ownerAppointmentPresentation', () => {
  it('does not infer that a past confirmed visit was completed', () => {
    expect(ownerAppointmentPresentation('CONFIRMED', 'HISTORY')).toEqual({
      code: 'VISIT_TIME_PASSED',
      label: 'Время визита прошло',
      description:
        'Клиника пока не передала отметку о фактическом визите. Детали записи сохранены в истории.',
      tone: 'neutral',
    });
  });

  it('does not expose a syncing status in history', () => {
    expect(ownerAppointmentPresentation('UNKNOWN_STATE', 'HISTORY')).toMatchObject({
      code: 'HISTORY_RECORDED',
      label: 'Запись завершена',
      tone: 'neutral',
    });
  });

  it('keeps an alternative proposal actionable while it is active', () => {
    expect(ownerAppointmentPresentation('ALTERNATIVE_PENDING', 'ACTIVE')).toMatchObject({
      code: 'ALTERNATIVE_TIME_REQUIRED',
      label: 'Нужно выбрать время',
      tone: 'warning',
    });
  });
});

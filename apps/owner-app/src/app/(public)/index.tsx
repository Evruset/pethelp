import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { useAuthJourney } from '@/auth/AuthJourneyProvider';
import { BodyText, Button, Field, GhostButton, InlineBanner, Screen, StateMessage } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';

const COPY = {
  INVALID_PHONE: 'Введите номер в международном формате, например +79991234567.',
  INVALID_OTP: 'Код не подошёл. Проверьте цифры и попробуйте снова.',
  EXPIRED: 'Срок действия кода истёк. Запросите новый код.',
  RATE_LIMITED: 'Сейчас повторить нельзя. Попробуйте после указанного времени.',
  DELIVERY_UNAVAILABLE: 'Не удалось подтвердить отправку кода. Повторите попытку позже.',
  TEMPORARY_FAILURE: 'Не удалось выполнить операцию. Проверьте соединение и повторите.',
  CHALLENGE_CONFLICT: 'Этот код больше не активен. Начните вход заново.',
} as const;

export default function PublicHomeScreen() {
  const auth = useAuthJourney();
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (auth.phase !== 'otp') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [auth.phase]);

  if (auth.phase === 'idle') return (
    <Screen title="VetHelp" accessibilityLabel="Публичный вход" subtitle="Забота о питомце начинается с удобной записи.">
      <View accessibilityElementsHidden style={{ alignSelf: 'center', width: 112, height: 112, borderRadius: 56, backgroundColor: t.color.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 42, height: 35, borderRadius: 20, backgroundColor: t.color.accent }} />
        <View style={{ position: 'absolute', top: 26, left: 25, width: 18, height: 18, borderRadius: 9, backgroundColor: t.color.accent }} />
        <View style={{ position: 'absolute', top: 18, left: 47, width: 18, height: 18, borderRadius: 9, backgroundColor: t.color.accent }} />
        <View style={{ position: 'absolute', top: 26, right: 25, width: 18, height: 18, borderRadius: 9, backgroundColor: t.color.accent }} />
      </View>
      <View style={{ gap: t.spacing.sm, paddingVertical: t.spacing.sm }}><BodyText>Вы можете начать запись до входа.</BodyText><BodyText>Выберите питомца, клинику и удобное время — остальное мы покажем шаг за шагом.</BodyText><BodyText secondary>Войти можно во время записи. Начатый путь сохранится.</BodyText></View>
      <Button label="Начать запись" onPress={() => auth.start({ kind: 'START_BOOKING' })} />
      <GhostButton label="Войти" onPress={() => auth.start()} />
    </Screen>
  );

  const otpPhase = auth.phase === 'otp' || auth.phase === 'verifying' || auth.phase === 'resending' || auth.phase === 'conflict';
  const loading = auth.phase === 'requesting' || auth.phase === 'verifying' || auth.phase === 'resending';
  const resendAt = auth.challenge ? Date.parse(auth.challenge.resendAvailableAt) : Number.POSITIVE_INFINITY;
  const resendSeconds = now === 0 ? 1 : Math.max(0, Math.ceil((resendAt - now) / 1_000));
  const expired = auth.challenge ? now > 0 && now >= Date.parse(auth.challenge.expiresAt) : false;

  return (
    <Screen title={otpPhase ? 'Введите код' : 'Вход'} accessibilityLabel="Вход по телефону" subtitle={otpPhase ? `Введите 6 цифр из сообщения на номер •••• ${auth.phone.replace(/\D/g, '').slice(-2)}. Никому не сообщайте этот код.` : 'Используем номер только для безопасного входа в VetHelp.'} backAction={loading ? undefined : auth.cancel}>
      {!otpPhase ? (
        <>
          <Field label="Номер телефона"
            autoComplete="tel"
            keyboardType="phone-pad"
            editable={!loading}
            value={auth.phone}
            onChangeText={auth.setPhone}
            placeholder="+7 999 123-45-67"
            hint="Международный формат, например +79991234567"
          />
          <Button label={loading ? 'Получаем код…' : 'Получить код'} disabled={loading} onPress={() => { void auth.requestOtp(); }} />
        </>
      ) : (
        <>
          <Field label="Код из сообщения"
            autoComplete="one-time-code"
            keyboardType="number-pad"
            editable={!loading && auth.phase !== 'conflict'}
            value={auth.code}
            onChangeText={auth.setCode}
            maxLength={6}
            placeholder="000000"
            style={{ textAlign: 'center', fontSize: 28, lineHeight: 34, letterSpacing: 10, fontWeight: '700' }}
          />
          <Button label={loading ? 'Проверяем…' : 'Подтвердить'} disabled={loading || expired || auth.phase === 'conflict'} onPress={() => { void auth.verifyOtp(); }} />
          <GhostButton label={resendSeconds > 0 ? `Отправить снова через ${resendSeconds} с` : 'Отправить снова'} disabled={loading || resendSeconds > 0 || auth.phase === 'conflict'} onPress={() => { void auth.resendOtp(); }} />
          <GhostButton label={auth.phase === 'conflict' ? 'Начать вход заново' : 'Отменить вход'} disabled={loading} onPress={auth.phase === 'conflict' ? () => auth.start() : auth.cancel} />
        </>
      )}
      {loading ? <StateMessage kind="submitting" title="Выполняем вход" /> : null}
      {auth.message ? <InlineBanner tone="critical" title={COPY[auth.message]} body={auth.attemptsRemaining !== undefined ? `Осталось попыток: ${auth.attemptsRemaining}.` : undefined} /> : null}
      {auth.retryAt ? <Text style={{ ...t.typography.caption, color: t.color.textSecondary }}>{`Повторить после ${new Date(auth.retryAt).toLocaleTimeString()}`}</Text> : null}
    </Screen>
  );
}

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { useAuthJourney } from '@/auth/AuthJourneyProvider';

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
    <View accessibilityLabel="Публичный вход">
      <Text>VetHelp</Text>
      <Text>Вы можете начать запись до входа.</Text>
      <Pressable accessibilityRole="button" onPress={() => auth.start({ kind: 'START_BOOKING' })}><Text>Начать запись</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => auth.start()}><Text>Войти</Text></Pressable>
    </View>
  );

  const otpPhase = auth.phase === 'otp' || auth.phase === 'verifying' || auth.phase === 'resending' || auth.phase === 'conflict';
  const loading = auth.phase === 'requesting' || auth.phase === 'verifying' || auth.phase === 'resending';
  const resendAt = auth.challenge ? Date.parse(auth.challenge.resendAvailableAt) : Number.POSITIVE_INFINITY;
  const resendSeconds = now === 0 ? 1 : Math.max(0, Math.ceil((resendAt - now) / 1_000));
  const expired = auth.challenge ? now > 0 && now >= Date.parse(auth.challenge.expiresAt) : false;

  return (
    <View accessibilityLabel="Вход по телефону">
      <Text>{otpPhase ? 'Введите код' : 'Вход по телефону'}</Text>
      {!otpPhase ? (
        <>
          <TextInput
            accessibilityLabel="Номер телефона"
            autoComplete="tel"
            keyboardType="phone-pad"
            editable={!loading}
            value={auth.phone}
            onChangeText={auth.setPhone}
            placeholder="+79991234567"
          />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading }} disabled={loading} onPress={() => { void auth.requestOtp(); }}>
            <Text>Получить код</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            accessibilityLabel="Код из сообщения"
            autoComplete="one-time-code"
            keyboardType="number-pad"
            editable={!loading && auth.phase !== 'conflict'}
            value={auth.code}
            onChangeText={auth.setCode}
            maxLength={6}
          />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading || expired || auth.phase === 'conflict' }} disabled={loading || expired || auth.phase === 'conflict'} onPress={() => { void auth.verifyOtp(); }}>
            <Text>Подтвердить</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: loading || resendSeconds > 0 || auth.phase === 'conflict' }} disabled={loading || resendSeconds > 0 || auth.phase === 'conflict'} onPress={() => { void auth.resendOtp(); }}>
            <Text>{resendSeconds > 0 ? `Отправить снова через ${resendSeconds} с` : 'Отправить снова'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={loading} onPress={auth.phase === 'conflict' ? () => auth.start() : auth.cancel}>
            <Text>{auth.phase === 'conflict' ? 'Начать вход заново' : 'Отменить вход'}</Text>
          </Pressable>
        </>
      )}
      {loading ? <View accessibilityLabel="Выполняем вход" accessibilityRole="progressbar"><ActivityIndicator /></View> : null}
      {auth.message ? <Text accessibilityRole="alert">{COPY[auth.message]}{auth.attemptsRemaining !== undefined ? ` Осталось попыток: ${auth.attemptsRemaining}.` : ''}</Text> : null}
      {auth.retryAt ? <Text>{`Повторить после ${new Date(auth.retryAt).toLocaleTimeString()}`}</Text> : null}
      {!otpPhase ? <Pressable accessibilityRole="button" onPress={auth.cancel}><Text>Назад</Text></Pressable> : null}
    </View>
  );
}

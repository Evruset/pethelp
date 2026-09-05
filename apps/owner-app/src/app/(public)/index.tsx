import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { useAuthJourney } from '@/auth/AuthJourneyProvider';
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

const c = t.ownerHome;

function Brand() {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View accessibilityElementsHidden style={{ width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: c.blue }}><Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '800' }}>✦</Text></View><Text style={{ color: c.ink, fontSize: 20, lineHeight: 24, fontWeight: '800' }}>VetHelp</Text></View>;
}

function ActionButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress(): void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 48, borderRadius: 13, borderWidth: secondary ? 1 : 0, borderColor: c.border, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: disabled ? '#DDE5F1' : secondary ? '#FFFFFF' : pressed ? c.bluePressed : c.blue, opacity: pressed && secondary ? 0.7 : 1 })}><Text style={{ color: disabled ? c.muted : secondary ? c.blue : '#FFFFFF', fontSize: 16, lineHeight: 20, fontWeight: '700' }}>{label}</Text></Pressable>;
}

function AuthCanvas({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const desktop = width >= 768;
  return <View style={{ flex: 1, backgroundColor: c.canvas }}><ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled"><View style={{ flex: 1, width: '100%', maxWidth: c.desktopMaxWidth, alignSelf: 'center', padding: desktop ? 24 : 12, gap: desktop ? 24 : 16 }}><View style={{ minHeight: 64, paddingHorizontal: desktop ? 18 : 4, borderRadius: desktop ? 18 : 0, borderWidth: desktop ? 1 : 0, borderColor: c.border, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...(desktop ? t.shadow.card : {}) }}><Brand /><Text style={{ color: c.muted, fontSize: 14, fontWeight: '600' }}>Личный кабинет владельца</Text></View><View style={{ flex: 1, flexDirection: desktop ? 'row' : 'column', alignItems: 'stretch', gap: desktop ? 28 : 18, paddingHorizontal: desktop ? 34 : 0, paddingVertical: desktop ? 42 : 10 }}><View style={{ flex: desktop ? 1.1 : undefined, justifyContent: 'center', gap: 16 }}><View style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: c.blueSoft }}><Text style={{ color: c.blue, fontSize: 13, fontWeight: '800' }}>ЗАБОТА РЯДОМ</Text></View><Text style={{ maxWidth: 650, color: c.ink, fontSize: desktop ? 48 : 34, lineHeight: desktop ? 54 : 40, fontWeight: '800' }}>Здоровье питомца — в одном месте</Text><Text style={{ maxWidth: 570, color: c.muted, fontSize: desktop ? 18 : 16, lineHeight: desktop ? 27 : 23 }}>Найдите клинику, запишитесь на приём и возвращайтесь к истории заботы в VetHelp.</Text>{desktop ? <View style={{ flexDirection: 'row', gap: 12, paddingTop: 8 }}><Text style={{ color: c.blue, fontWeight: '700' }}>Клиники</Text><Text style={{ color: c.muted }}>•</Text><Text style={{ color: c.blue, fontWeight: '700' }}>Запись</Text><Text style={{ color: c.muted }}>•</Text><Text style={{ color: c.blue, fontWeight: '700' }}>Дневник</Text></View> : null}</View><View style={{ flex: desktop ? 0.9 : undefined, justifyContent: 'center' }}>{children}</View></View></View></ScrollView></View>;
}

function AuthCard({ children, label }: { children: ReactNode; label: string }) {
  return <View accessibilityLabel={label} style={{ width: '100%', maxWidth: 500, alignSelf: 'center', padding: 22, gap: 16, borderRadius: 24, borderWidth: 1, borderColor: c.border, backgroundColor: '#FFFFFF', ...t.shadow.card }}>{children}</View>;
}

export default function PublicHomeScreen() {
  const auth = useAuthJourney();
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (auth.phase !== 'otp') return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [auth.phase]);

  if (auth.phase === 'idle') return <AuthCanvas><AuthCard label="Публичный вход"><Text style={{ color: c.blue, fontSize: 13, lineHeight: 17, fontWeight: '800' }}>ЛИЧНЫЙ КАБИНЕТ ВЛАДЕЛЬЦА</Text><Text accessibilityRole="header" style={{ color: c.ink, fontSize: 30, lineHeight: 36, fontWeight: '800' }}>Начните заботу о питомце</Text><Text style={{ color: c.muted, fontSize: 16, lineHeight: 23 }}>Вы можете начать запись до входа.</Text><Text style={{ color: c.muted, fontSize: 15, lineHeight: 22 }}>Авторизация потребуется, чтобы сохранить выбор и открыть личный кабинет.</Text><View style={{ gap: 10, paddingTop: 4 }}><ActionButton label="Начать запись" onPress={() => auth.start({ kind: 'START_BOOKING' })} /><ActionButton label="Войти" secondary onPress={() => auth.start()} /></View></AuthCard></AuthCanvas>;

  const otpPhase = auth.phase === 'otp' || auth.phase === 'verifying' || auth.phase === 'resending' || auth.phase === 'conflict';
  const loading = auth.phase === 'requesting' || auth.phase === 'verifying' || auth.phase === 'resending';
  const resendAt = auth.challenge ? Date.parse(auth.challenge.resendAvailableAt) : Number.POSITIVE_INFINITY;
  const resendSeconds = now === 0 ? 1 : Math.max(0, Math.ceil((resendAt - now) / 1_000));
  const expired = auth.challenge ? now > 0 && now >= Date.parse(auth.challenge.expiresAt) : false;

  return <AuthCanvas><AuthCard label="Вход по телефону">
      <Text style={{ color: c.blue, fontSize: 13, lineHeight: 17, fontWeight: '800' }}>БЕЗОПАСНЫЙ ВХОД</Text>
      <Text accessibilityRole="header" style={{ color: c.ink, fontSize: 30, lineHeight: 36, fontWeight: '800' }}>{otpPhase ? 'Введите код' : 'Вход по телефону'}</Text>
      <Text style={{ color: c.muted, fontSize: 15, lineHeight: 22 }}>{otpPhase ? 'Введите шестизначный код подтверждения.' : 'Мы используем номер только для безопасного доступа к личному кабинету.'}</Text>
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
            placeholderTextColor="#8A98AD"
            style={{ minHeight: 50, paddingHorizontal: 16, borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSoft, color: c.ink, fontSize: 16 }}
          />
          <ActionButton label="Получить код" disabled={loading} onPress={() => { void auth.requestOtp(); }} />
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
            placeholder="000000"
            placeholderTextColor="#8A98AD"
            style={{ minHeight: 50, paddingHorizontal: 16, borderRadius: 13, borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceSoft, color: c.ink, fontSize: 18, letterSpacing: 5, textAlign: 'center' }}
          />
          <ActionButton label="Подтвердить" disabled={loading || expired || auth.phase === 'conflict'} onPress={() => { void auth.verifyOtp(); }} />
          <ActionButton label={resendSeconds > 0 ? `Отправить снова через ${resendSeconds} с` : 'Отправить снова'} secondary disabled={loading || resendSeconds > 0 || auth.phase === 'conflict'} onPress={() => { void auth.resendOtp(); }} />
          <ActionButton label={auth.phase === 'conflict' ? 'Начать вход заново' : 'Отменить вход'} secondary disabled={loading} onPress={auth.phase === 'conflict' ? () => auth.start() : auth.cancel} />
        </>
      )}
      {loading ? <View accessibilityLabel="Выполняем вход" accessibilityRole="progressbar"><ActivityIndicator /></View> : null}
      {auth.message ? <View style={{ padding: 13, borderRadius: 12, backgroundColor: c.redSoft }}><Text accessibilityRole="alert" style={{ color: c.red, fontSize: 14, lineHeight: 20 }}>{COPY[auth.message]}{auth.attemptsRemaining !== undefined ? ` Осталось попыток: ${auth.attemptsRemaining}.` : ''}</Text></View> : null}
      {auth.retryAt ? <Text style={{ color: c.muted, fontSize: 14 }}>{`Повторить после ${new Date(auth.retryAt).toLocaleTimeString()}`}</Text> : null}
      {!otpPhase ? <ActionButton label="Назад" secondary onPress={auth.cancel} /> : null}
    </AuthCard></AuthCanvas>;
}

import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { useSession } from '@/session/SessionProvider';
import { BackAction, BodyText, Button, ConfirmationModal, InlineBanner, LargeTitleHeader, OwnerAppFrame, Screen, SectionTitle, StateMessage, StatusBadge } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { formatBookingStart } from './OwnerBookingsScreen';
import { isStaleCancellation, ownerBookingDetailApi, type OwnerBookingDetail } from './owner-booking-detail-api';

const randomKey = () => globalThis.crypto?.randomUUID?.() ?? '00000000-0000-4000-8000-000000000001';
const tone = (value: OwnerBookingDetail['presentation']['tone']) => value === 'danger' ? 'critical' : value;
const species = (value: string) => value === 'DOG' ? 'Собака' : value === 'CAT' ? 'Кошка' : 'Питомец';

export function OwnerBookingDetailScreen({ bookingId, onBack }: { bookingId: string; onBack(): void }) {
  const { session } = useSession();
  const cache = useQueryClient();
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<'stale' | 'network' | null>(null);
  const key = useRef(randomKey());
  const query = useQuery({
    queryKey: ['owner', session?.cacheScope, 'booking-detail', bookingId],
    enabled: Boolean(session),
    queryFn: ({ signal }) => ownerBookingDetailApi.read(session!.opaqueCredential, bookingId, signal),
  });

  const cancel = async () => {
    if (cancelling || !session || !query.data?.actions.canCancel) return;
    setCancelling(true); setNotice(null);
    try {
      await ownerBookingDetailApi.cancel(session.opaqueCredential, bookingId, query.data.cancellation.aggregateVersion, key.current);
      await query.refetch();
      await cache.invalidateQueries({ queryKey: ['owner', session.cacheScope, 'bookings'] });
      setConfirming(false);
    } catch (error) {
      const stale = isStaleCancellation(error);
      setNotice(stale ? 'stale' : 'network');
      if (stale) await query.refetch();
    } finally { setCancelling(false); }
  };

  if (query.isPending) return <Screen title="Детали записи" backAction={onBack}><StateMessage kind="loading" title="Загружаем запись" /></Screen>;
  if (query.isError || !query.data) return <Screen title="Детали записи" backAction={onBack}><StateMessage kind="error" title="Запись недоступна" body="Она могла измениться или больше не доступна в вашем профиле." action={<Button label="Повторить" onPress={() => { void query.refetch(); }} />} /></Screen>;
  const item = query.data;
  const facts = <View style={{ flexDirection: desktop ? 'row' : 'column', flexWrap: desktop ? 'wrap' : 'nowrap', gap: t.spacing.sm }}>
    <Fact desktop={desktop} label="Питомец" value={`${item.pet.name} · ${species(item.pet.species)}`} />
    <Fact desktop={desktop} label="Клиника" value={item.clinic.name} />
    <Fact desktop={desktop} label="Адрес" value={item.location.address} />
    {item.service.name ? <Fact desktop={desktop} label="Услуга" value={item.service.name} /> : null}
    <Fact desktop={desktop} label="Дата и время" value={formatBookingStart(item.startsAt)} />
    {item.service.priceAmount && item.service.currency ? <Fact desktop={desktop} label="Стоимость" value={`${item.service.priceAmount} ${item.service.currency}`} /> : null}
  </View>;
  return <OwnerAppFrame wide><ScrollView contentContainerStyle={{ width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: desktop ? 28 : 14, paddingTop: desktop ? 20 : 12, paddingBottom: 48, gap: desktop ? 18 : 14 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <BackAction onPress={onBack} label="К списку записей" />
    <LargeTitleHeader title="Детали записи" subtitle={`${item.clinic.name} · ${item.pet.name}`} eyebrow="Запись" />
    <View style={{ flexDirection: desktop ? 'row' : 'column', alignItems: desktop ? 'center' : 'stretch', gap: desktop ? 24 : t.spacing.md, padding: desktop ? t.spacing.xl : t.spacing.lg, borderRadius: t.radius.section, backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.separator, ...t.shadow.card }}>
      <View style={{ flex: 1, minWidth: 0, gap: t.spacing.sm }}>
        <StatusBadge label={item.presentation.label} tone={tone(item.presentation.tone)} />
        {item.service.name ? <Text accessibilityRole="header" style={{ ...t.typography.sectionTitle, fontSize: desktop ? 24 : 20, lineHeight: desktop ? 30 : 25, color: t.color.textPrimary }}>{item.service.name}</Text> : null}
        <BodyText>{item.presentation.description}</BodyText>
      </View>
      {item.actions.canCancel ? <View style={{ width: desktop ? 210 : '100%' }}><Button label="Отменить запись" variant="destructive" disabled={cancelling} onPress={() => setConfirming(true)} /></View> : null}
    </View>
    {notice === 'stale' ? <InlineBanner tone="warning" title="Запись уже изменилась" body="Мы обновили актуальный статус. Проверьте доступные действия." /> : null}
    {notice === 'network' ? <InlineBanner tone="warning" title="Не удалось отменить запись" body="Статус не изменён. Проверьте соединение и повторите попытку." /> : null}
    <View style={{ flexDirection: desktop ? 'row' : 'column', alignItems: 'flex-start', gap: desktop ? 18 : 14 }}>
      <View style={{ flex: desktop ? 1.55 : undefined, width: desktop ? undefined : '100%', minWidth: 0, gap: t.spacing.sm, padding: t.spacing.lg, borderRadius: t.radius.section, backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.separator }}><SectionTitle>О записи</SectionTitle>{facts}</View>
      {item.timeline.length ? <View style={{ flex: desktop ? 0.85 : undefined, width: desktop ? undefined : '100%', minWidth: 0, gap: t.spacing.sm, padding: t.spacing.lg, borderRadius: t.radius.section, backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.separator }}>
        <SectionTitle>История</SectionTitle>
        {item.timeline.map((event, index) => <View key={`${event.occurredAt}-${index}`} style={{ gap: 2, paddingVertical: 4 }}><Text style={{ ...t.typography.label, color: t.color.textPrimary }}>{event.title}</Text><Text style={{ ...t.typography.caption, color: t.color.textSecondary }}>{event.description}</Text></View>)}
      </View> : null}
    </View>
    <ConfirmationModal visible={confirming} title="Отменить запись?" body="Клиника увидит отмену, а выбранное время снова станет доступно." confirmLabel={cancelling ? 'Отменяем…' : 'Да, отменить'} busy={cancelling} onConfirm={() => { void cancel(); }} onCancel={() => { if (!cancelling) setConfirming(false); }} />
  </ScrollView></OwnerAppFrame>;
}

function Fact({ label, value, desktop }: { label: string; value: string; desktop: boolean }) {
  return <View style={{ width: desktop ? '48.8%' : '100%', minHeight: 64, justifyContent: 'center', gap: 2, padding: t.spacing.md, borderRadius: t.radius.card, backgroundColor: t.color.background }}><Text style={{ ...t.typography.caption, color: t.color.textSecondary }}>{label}</Text><Text style={{ ...t.typography.body, color: t.color.textPrimary }}>{value}</Text></View>;
}

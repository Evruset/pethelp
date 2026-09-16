import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { useSession } from '@/session/SessionProvider';
import { BodyText, Button, ConfirmationModal, InlineBanner, Screen, SectionTitle, StateMessage, StatusBadge } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { formatBookingStart } from './OwnerBookingsScreen';
import { isStaleCancellation, ownerBookingDetailApi, type OwnerBookingDetail } from './owner-booking-detail-api';

const randomKey = () => globalThis.crypto?.randomUUID?.() ?? '00000000-0000-4000-8000-000000000001';
const tone = (value: OwnerBookingDetail['presentation']['tone']) => value === 'danger' ? 'critical' : value;
const species = (value: string) => value === 'DOG' ? 'Собака' : value === 'CAT' ? 'Кошка' : 'Питомец';

export function OwnerBookingDetailScreen({ bookingId, onBack }: { bookingId: string; onBack(): void }) {
  const { session } = useSession();
  const cache = useQueryClient();
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
  return <Screen title="Детали записи" subtitle="Актуальные данные клиники" backAction={onBack}>
    <View style={{ gap: t.spacing.sm, padding: t.spacing.lg, borderRadius: t.radius.section, backgroundColor: t.color.surface, borderWidth: 1, borderColor: t.color.separator }}>
      <StatusBadge label={item.presentation.label} tone={tone(item.presentation.tone)} />
      <BodyText>{item.presentation.description}</BodyText>
    </View>
    {notice === 'stale' ? <InlineBanner tone="warning" title="Запись уже изменилась" body="Мы обновили актуальный статус. Проверьте доступные действия." /> : null}
    {notice === 'network' ? <InlineBanner tone="warning" title="Не удалось отменить запись" body="Статус не изменён. Проверьте соединение и повторите попытку." /> : null}
    <View style={{ gap: t.spacing.sm }}><SectionTitle>О записи</SectionTitle>
      <Fact label="Питомец" value={`${item.pet.name} · ${species(item.pet.species)}`} />
      <Fact label="Клиника" value={item.clinic.name} />
      <Fact label="Адрес" value={item.location.address} />
      {item.service.name ? <Fact label="Услуга" value={item.service.name} /> : null}
      <Fact label="Дата и время" value={formatBookingStart(item.startsAt)} />
      {item.service.priceAmount && item.service.currency ? <Fact label="Стоимость" value={`${item.service.priceAmount} ${item.service.currency}`} /> : null}
    </View>
    {item.timeline.length ? <View style={{ gap: t.spacing.sm }}><SectionTitle>История</SectionTitle>{item.timeline.map((event, index) => <View key={`${event.occurredAt}-${index}`} style={{ gap: 2 }}><Text style={{ ...t.typography.label, color: t.color.textPrimary }}>{event.title}</Text><Text style={{ ...t.typography.caption, color: t.color.textSecondary }}>{event.description}</Text></View>)}</View> : null}
    {item.actions.canCancel ? <Button label="Отменить запись" variant="destructive" disabled={cancelling} onPress={() => setConfirming(true)} /> : null}
    <ConfirmationModal visible={confirming} title="Отменить запись?" body="Клиника увидит отмену, а выбранное время снова станет доступно." confirmLabel={cancelling ? 'Отменяем…' : 'Да, отменить'} busy={cancelling} onConfirm={() => { void cancel(); }} onCancel={() => { if (!cancelling) setConfirming(false); }} />
  </Screen>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={{ minHeight: 44, gap: 2, padding: t.spacing.md, borderRadius: t.radius.card, backgroundColor: t.color.background }}><Text style={{ ...t.typography.caption, color: t.color.textSecondary }}>{label}</Text><Text style={{ ...t.typography.body, color: t.color.textPrimary }}>{value}</Text></View>;
}

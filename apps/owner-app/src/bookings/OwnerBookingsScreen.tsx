import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { OwnerGlobalNav } from '@/navigation/OwnerGlobalNav';
import { useSession } from '@/session/SessionProvider';
import { Button, InlineBanner, OwnerAppFrame, StateMessage, StatusBadge } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import {
  mergeOwnerBookingsPages,
  ownerBookingsApi,
  type OwnerBookingSummary,
  type OwnerBookingTone,
} from './owner-bookings-api';

const h = t.ownerHome;

const speciesLabel = (species: OwnerBookingSummary['pet']['species']) =>
  species === 'DOG' ? 'Собака' : species === 'CAT' ? 'Кошка' : 'Питомец';

const statusTone = (tone: OwnerBookingTone): 'success' | 'warning' | 'critical' | 'info' | 'neutral' =>
  tone === 'danger' ? 'critical' : tone;

export function formatBookingStart(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function OwnerBookingsScreen({
  onHome,
  onClinics,
  onPets,
  onOpenBooking = () => {},
}: {
  onHome(): void;
  onClinics(): void;
  onPets(): void;
  onOpenBooking?(bookingId: string): void;
}) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const [tab, setTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');
  const query = useInfiniteQuery({
    queryKey: ['owner', session?.cacheScope, 'bookings'],
    enabled: Boolean(session),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => ownerBookingsApi.list(session!.opaqueCredential, pageParam, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const merged = mergeOwnerBookingsPages(query.data?.pages ?? []);
  const total = merged.requiresAction.length + merged.active.length + merged.history.length;
  const hasSnapshot = Boolean(query.data);

  return (
    <OwnerAppFrame wide>
      <View style={{ flex: 1, backgroundColor: h.canvas }}>
        {desktop ? (
          <OwnerGlobalNav
            desktop
            active="BOOKINGS"
            onHome={onHome}
            onClinics={onClinics}
            onBookings={() => {}}
            onPets={onPets}
          />
        ) : null}
        <ScrollView
          contentContainerStyle={{
            width: '100%',
            maxWidth: 1120,
            alignSelf: 'center',
            paddingHorizontal: desktop ? 28 : 14,
            paddingTop: desktop ? 20 : 12,
            paddingBottom: 48,
            gap: 16,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ flexDirection: desktop ? 'row' : 'column', alignItems: desktop ? 'center' : 'stretch', justifyContent: 'space-between', gap: 12 }}>
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ ...t.typography.caption, color: h.bluePressed, fontWeight: '800', textTransform: 'uppercase' }}>Записи</Text>
              <Text accessibilityRole="header" style={{ fontSize: desktop ? 36 : 30, lineHeight: desktop ? 42 : 36, fontWeight: '800', color: h.ink }}>
                Мои записи
              </Text>
              <Text style={{ ...t.typography.secondaryBody, color: h.ink }}>
                Актуальные статусы приходят от VetHelp и клиники. Разделы и порядок определяет сервер.
              </Text>
            </View>
            {hasSnapshot ? (
              <View style={{ minWidth: desktop ? 150 : undefined }}>
                <Button label={query.isRefetching ? 'Обновляем…' : 'Обновить'} variant="secondary" disabled={query.isRefetching} onPress={() => { void query.refetch(); }} />
              </View>
            ) : null}
          </View>

          {query.isPending ? <StateMessage kind="loading" title="Загружаем записи" /> : null}
          {query.isError && !hasSnapshot ? (
            <StateMessage
              kind="error"
              title="Не удалось загрузить записи"
              body="Проверьте соединение и повторите попытку."
              action={<Button label="Повторить" onPress={() => { void query.refetch(); }} />}
            />
          ) : null}

          {query.isRefetchError && hasSnapshot ? (
            <InlineBanner
              tone="warning"
              title="Не удалось обновить записи"
              body="Показываем последний успешно полученный список."
              action={<Button label="Повторить" variant="secondary" onPress={() => { void query.refetch(); }} />}
            />
          ) : null}

          {!query.isPending && hasSnapshot && total === 0 ? (
            <StateMessage
              kind="empty"
              title="Записей пока нет"
              body="Выберите клинику, услугу и подходящее время."
              action={<Button label="Найти клинику" onPress={onClinics} />}
            />
          ) : null}

          {hasSnapshot && total > 0 ? (
            <View style={{ flexDirection: desktop ? 'row' : 'column', alignItems: 'flex-start', gap: desktop ? 22 : 14 }}>
              <View style={{ flex: 1, width: desktop ? undefined : '100%', minWidth: 0, gap: 14, padding: desktop ? 18 : 0, borderRadius: desktop ? t.radius.section : 0, backgroundColor: desktop ? t.color.surface : 'transparent', borderWidth: desktop ? 1 : 0, borderColor: h.border }}>
                <View accessibilityRole="tablist" style={{ alignSelf: desktop ? 'flex-start' : 'stretch', flexDirection: 'row', padding: 4, borderRadius: t.radius.control, backgroundColor: h.blueSoft }}>
                  <BookingTab label="Активные" selected={tab === 'ACTIVE'} onPress={() => setTab('ACTIVE')} />
                  <BookingTab label="История" selected={tab === 'HISTORY'} onPress={() => setTab('HISTORY')} />
                </View>
                {tab === 'ACTIVE' ? <>
                  <BookingSection title="Требуют внимания" rows={merged.requiresAction} desktop={desktop} onOpenBooking={onOpenBooking} />
                  <BookingSection title="Предстоящие" rows={merged.active} desktop={desktop} onOpenBooking={onOpenBooking} />
                  {merged.requiresAction.length + merged.active.length === 0 && !query.hasNextPage ? <StateMessage kind="empty" title="Активных записей нет" body="Завершённые и отменённые записи доступны в истории." /> : null}
                </> : <>
                  <BookingSection title="История" rows={merged.history} desktop={desktop} onOpenBooking={onOpenBooking} />
                  {merged.history.length === 0 && !query.hasNextPage ? <StateMessage kind="empty" title="История пока пуста" body="Здесь появятся завершённые и отменённые записи." /> : null}
                </>}
              </View>
              {desktop ? <View style={{ width: 320, gap: 12, padding: 20, borderRadius: t.radius.section, backgroundColor: t.color.surface, borderWidth: 1, borderColor: h.border }}>
                <Text style={{ ...t.typography.caption, color: h.bluePressed, fontWeight: '800', textTransform: 'uppercase' }}>Новая запись</Text>
                <Text accessibilityRole="header" style={{ ...t.typography.sectionTitle, color: h.ink }}>Нужна помощь питомцу?</Text>
                <Text style={{ ...t.typography.secondaryBody, color: h.muted }}>Выберите клинику, услугу и подходящее время.</Text>
                <Button label="Найти клинику" onPress={onClinics} />
              </View> : null}
            </View>
          ) : null}

          {query.isFetchNextPageError ? (
            <InlineBanner
              tone="warning"
              title="Не удалось загрузить следующую страницу"
              body="Уже загруженные записи остаются на экране."
            />
          ) : null}
          {query.hasNextPage ? (
            <Button
              label={query.isFetchingNextPage ? 'Загружаем…' : 'Показать ещё'}
              variant="secondary"
              disabled={query.isFetchingNextPage}
              onPress={() => { void query.fetchNextPage(); }}
            />
          ) : null}
        </ScrollView>
        {!desktop ? (
          <OwnerGlobalNav
            desktop={false}
            active="BOOKINGS"
            onHome={onHome}
            onClinics={onClinics}
            onBookings={() => {}}
            onPets={onPets}
          />
        ) : null}
      </View>
    </OwnerAppFrame>
  );
}

function BookingTab({ label, selected, onPress }: { label: string; selected: boolean; onPress(): void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, minWidth: 108, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: t.radius.control, backgroundColor: selected ? t.color.surface : 'transparent', opacity: pressed ? 0.7 : 1, ...(selected ? t.shadow.card : {}) })}><Text style={{ ...t.typography.button, color: selected ? h.bluePressed : h.ink }}>{label}</Text></Pressable>;
}

function BookingSection({ title, rows, desktop, onOpenBooking }: { title: string; rows: readonly OwnerBookingSummary[]; desktop: boolean; onOpenBooking(bookingId: string): void }) {
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: 9 }}>
      <Text accessibilityRole="header" style={{ ...t.typography.sectionTitle, color: h.ink }}>{title}</Text>
      <View style={{ gap: 10 }}>
        {rows.map((row) => <BookingCard key={row.holdId} row={row} desktop={desktop} onOpen={() => onOpenBooking(row.holdId)} />)}
      </View>
    </View>
  );
}

function BookingCard({ row, desktop, onOpen }: { row: OwnerBookingSummary; desktop: boolean; onOpen(): void }) {
  const when = formatBookingStart(row.startsAt);
  return (
    <View
      accessible
      accessibilityLabel={`${row.presentation.label}. ${row.clinic.name}. ${row.pet.name}. ${when}.`}
      style={{
        padding: 14,
        gap: desktop ? 14 : 9,
        borderWidth: 1,
        borderColor: h.border,
        borderRadius: 20,
        backgroundColor: '#fff',
        flexDirection: desktop ? 'row' : 'column',
        alignItems: desktop ? 'center' : 'stretch',
        ...t.shadow.card,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 9 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <Text style={{ flex: 1, ...t.typography.sectionTitle, color: h.ink }}>{when}</Text>
          <StatusBadge label={row.presentation.label} tone={statusTone(row.presentation.tone)} />
        </View>
        <Text style={{ ...t.typography.body, color: h.ink, fontWeight: '600' }}>{row.pet.name} · {speciesLabel(row.pet.species)}</Text>
        <Text style={{ ...t.typography.secondaryBody, color: h.muted }}>{row.clinic.name} · {row.clinic.address}</Text>
        <Text style={{ ...t.typography.caption, color: h.muted }}>{row.presentation.description}</Text>
      </View>
      <View style={{ width: desktop ? 184 : '100%' }}>
        <Button label="Подробнее" variant="secondary" onPress={onOpen} />
      </View>
    </View>
  );
}

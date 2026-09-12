import { useInfiniteQuery } from '@tanstack/react-query';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';

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
}: {
  onHome(): void;
  onClinics(): void;
  onPets(): void;
}) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
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
              <Text style={{ ...t.typography.caption, color: h.blue, fontWeight: '800', textTransform: 'uppercase' }}>Записи</Text>
              <Text accessibilityRole="header" style={{ fontSize: desktop ? 36 : 30, lineHeight: desktop ? 42 : 36, fontWeight: '800', color: h.ink }}>
                Мои записи
              </Text>
              <Text style={{ ...t.typography.secondaryBody, color: h.muted }}>
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

          <BookingSection title="Требуют внимания" rows={merged.requiresAction} />
          <BookingSection title="Предстоящие" rows={merged.active} />
          <BookingSection title="История" rows={merged.history} />

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

function BookingSection({ title, rows }: { title: string; rows: readonly OwnerBookingSummary[] }) {
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: 9 }}>
      <Text accessibilityRole="header" style={{ ...t.typography.sectionTitle, color: h.ink }}>{title}</Text>
      <View style={{ gap: 10 }}>
        {rows.map((row) => <BookingCard key={row.holdId} row={row} />)}
      </View>
    </View>
  );
}

function BookingCard({ row }: { row: OwnerBookingSummary }) {
  const when = formatBookingStart(row.startsAt);
  return (
    <View
      accessible
      accessibilityLabel={`${row.presentation.label}. ${row.clinic.name}. ${row.pet.name}. ${when}.`}
      style={{
        padding: 16,
        gap: 10,
        borderWidth: 1,
        borderColor: h.border,
        borderRadius: 20,
        backgroundColor: '#fff',
        ...t.shadow.card,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ ...t.typography.sectionTitle, color: h.ink }}>{row.clinic.name}</Text>
          <Text style={{ ...t.typography.caption, color: h.muted }}>{row.clinic.address}</Text>
        </View>
        <StatusBadge label={row.presentation.label} tone={statusTone(row.presentation.tone)} />
      </View>
      <Text style={{ ...t.typography.secondaryBody, color: h.ink }}>{row.presentation.description}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        <Fact text={when} />
        <Fact text={`${row.pet.name} · ${speciesLabel(row.pet.species)}`} />
      </View>
    </View>
  );
}

function Fact({ text }: { text: string }) {
  return (
    <View style={{ minHeight: 34, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: h.blueSoft }}>
      <Text style={{ ...t.typography.caption, color: h.ink, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/session/SessionProvider';
import { BodyText, Button, Card, GhostButton, InsetSection, Screen, SectionTitle, SkeletonCard, StateMessage, StatusPill } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { petDiaryApi, type PetClinicalDiaryEntry } from './pet-api';

type DiaryApi = Pick<typeof petDiaryApi, 'read'>;

const visitDate = (value: string) => new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(value));

function VisitContext({ entry }: { entry: PetClinicalDiaryEntry }) {
  const details = [entry.visit.service?.name, entry.visit.doctor?.name, entry.visit.location?.address].filter(Boolean);
  return <View style={{ gap: t.spacing.xs }}>
    <BodyText>{entry.visit.clinic.name}</BodyText>
    {details.map((detail) => <BodyText key={detail} secondary>{detail}</BodyText>)}
  </View>;
}

function ResultDetail({ petName, entry, onBack }: { petName: string; entry: PetClinicalDiaryEntry; onBack(): void }) {
  return <Screen title="Результат приёма" subtitle={`${petName} · ${visitDate(entry.visit.occurredAt)}`} backAction={onBack}>
    <InsetSection title="Приём">
      <View style={{ padding: t.spacing.lg, gap: t.spacing.sm }}><VisitContext entry={entry} /></View>
    </InsetSection>
    <InsetSection title="Исходный результат">
      <View style={{ padding: t.spacing.lg }}><BodyText>{entry.result.content}</BodyText></View>
    </InsetSection>
    {entry.amendments.length > 0 ? <View style={{ gap: t.spacing.md }}>
      <SectionTitle>Уточнения к результату</SectionTitle>
      <BodyText secondary>Исходный результат остаётся частью истории приёма. Уточнения опубликованы позже и не являются отдельными приёмами.</BodyText>
      {entry.amendments.map((amendment) => <Card key={amendment.amendmentId}>
        <BodyText>Уточнение к результату</BodyText>
        <BodyText secondary>{amendment.content}</BodyText>
      </Card>)}
    </View> : null}
  </Screen>;
}

export function PetDiaryScreen({ petId, petName, onBack, onSwitchPet, api = petDiaryApi }: { petId: string; petName: string; onBack(): void; onSwitchPet(): void; api?: DiaryApi }) {
  const { session } = useSession();
  const [selection, setSelection] = useState<{ petId: string; resultId: string } | null>(null);
  const query = useQuery({
    queryKey: ['owner', session?.cacheScope, 'pet-diary', petId],
    enabled: Boolean(session),
    queryFn: ({ signal }) => api.read(session!.opaqueCredential, petId, signal),
  });
  const data = !query.isError && query.data?.petId === petId ? query.data : undefined;
  const selected = selection?.petId === petId ? data?.clinicalEntries.find((entry) => entry.result.resultId === selection.resultId) : undefined;

  if (selected) return <ResultDetail petName={petName} entry={selected} onBack={() => setSelection(null)} />;

  return <Screen title={`Дневник: ${petName}`} subtitle="Опубликованные клиникой результаты приёмов." backAction={onBack}>
    <Button label="Выбрать другого питомца" variant="secondary" onPress={onSwitchPet} />
    {query.isPending ? <View style={{ gap: t.spacing.md }}><StateMessage kind="loading" title="Загружаем дневник" /><SkeletonCard /><SkeletonCard /></View> : null}
    {query.isError || (query.data && query.data.petId !== petId) ? <StateMessage kind="error" title="Дневник недоступен" body="Не удалось безопасно загрузить результаты. Повторите попытку." action={<Button label="Повторить" onPress={() => { void query.refetch(); }} />} /> : null}
    {data?.clinicalEntries.length === 0 ? <StateMessage kind="empty" title="В дневнике пока нет результатов" body="Здесь появятся результаты приёмов после публикации клиникой." /> : null}
    {data?.clinicalEntries.map((entry) => <Pressable
      key={entry.result.resultId}
      accessibilityRole="button"
      accessibilityLabel={`Открыть результат приёма ${visitDate(entry.visit.occurredAt)}, ${entry.visit.clinic.name}`}
      onPress={() => setSelection({ petId, resultId: entry.result.resultId })}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: t.spacing.sm }}>
          <Text style={{ ...t.typography.sectionTitle, color: t.color.textPrimary, flex: 1 }}>{visitDate(entry.visit.occurredAt)}</Text>
          {entry.amendments.length > 0 ? <StatusPill label={`Уточнений: ${entry.amendments.length}`} tone="info" /> : null}
        </View>
        <VisitContext entry={entry} />
        <Text numberOfLines={3} style={{ ...t.typography.secondaryBody, color: t.color.textSecondary }}>{entry.result.content}</Text>
      </Card>
    </Pressable>)}
    <GhostButton label="Назад" onPress={onBack} />
  </Screen>;
}

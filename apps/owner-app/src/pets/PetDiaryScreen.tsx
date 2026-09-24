import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { useSession } from '@/session/SessionProvider';
import { Button, OwnerAppFrame, StateMessage, StatusPill } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { v50ReferenceAssets } from '@/ui/v50-reference-assets';
import { petDiaryApi, type PetClinicalDiaryEntry } from './pet-api';

type DiaryApi = Pick<typeof petDiaryApi, 'read'>;

const visitDate = (value: string) => new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric',
}).format(new Date(value));

function VisitContext({ entry }: { entry: PetClinicalDiaryEntry }) {
  const details = [entry.visit.service?.name, entry.visit.doctor?.name, entry.visit.location?.address].filter(Boolean);
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ ...t.typography.body, fontWeight: '700', color: t.ownerHome.ink }}>{entry.visit.clinic.name}</Text>
      {details.map((detail) => (
        <Text key={detail} style={{ ...t.typography.caption, color: t.ownerHome.muted }}>{detail}</Text>
      ))}
    </View>
  );
}

function DiarySurface({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ padding: 18, gap: 10, borderWidth: 1, borderColor: t.ownerHome.border, borderRadius: 20, backgroundColor: t.ownerHome.surface, ...t.shadow.card }}>
      {children}
    </View>
  );
}

function ResultDetail({ petName, entry, onBack }: { petName: string; entry: PetClinicalDiaryEntry; onBack(): void }) {
  const { width } = useWindowDimensions();
  const desktop = width >= 860;
  return (
    <OwnerAppFrame wide>
      <ScrollView
        style={{ flex: 1, backgroundColor: t.ownerHome.canvas }}
        contentContainerStyle={{ width: '100%', maxWidth: 980, alignSelf: 'center', paddingHorizontal: desktop ? 28 : 14, paddingVertical: desktop ? 28 : 16, gap: 14 }}
      >
        <View style={{ gap: 6 }}>
          <Text style={{ ...t.typography.caption, color: t.ownerHome.bluePressed, fontWeight: '800', textTransform: 'uppercase' }}>Дневник · опубликованный результат</Text>
          <Text accessibilityRole="header" style={{ fontSize: desktop ? 34 : 28, lineHeight: desktop ? 40 : 34, fontWeight: '800', color: t.ownerHome.ink }}>Результат приёма</Text>
          <Text style={{ ...t.typography.secondaryBody, color: t.ownerHome.ink }}>{petName} · {visitDate(entry.visit.occurredAt)}</Text>
        </View>

        <DiarySurface>
          <Text style={{ ...t.typography.caption, color: t.ownerHome.muted, textTransform: 'uppercase', fontWeight: '700' }}>Приём</Text>
          <VisitContext entry={entry} />
        </DiarySurface>

        <DiarySurface>
          <Text style={{ ...t.typography.sectionTitle, color: t.ownerHome.ink }}>Исходный результат</Text>
          <Text style={{ ...t.typography.body, color: t.ownerHome.ink }}>{entry.result.content}</Text>
        </DiarySurface>

        {entry.amendments.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ ...t.typography.sectionTitle, color: t.ownerHome.ink }}>Уточнения к результату</Text>
            <Text style={{ ...t.typography.secondaryBody, color: t.ownerHome.ink }}>
              Исходный результат остаётся частью истории приёма. Уточнения опубликованы позже и не являются отдельными приёмами.
            </Text>
            {entry.amendments.map((amendment) => (
              <DiarySurface key={amendment.amendmentId}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ ...t.typography.caption, color: t.ownerHome.blue, fontWeight: '800' }}>Уточнение к результату</Text>
                  <Text style={{ ...t.typography.caption, color: t.ownerHome.muted }}>Опубликовано {visitDate(amendment.publishedAt)}</Text>
                </View>
                <Text style={{ ...t.typography.body, color: t.ownerHome.ink }}>{amendment.content}</Text>
              </DiarySurface>
            ))}
          </View>
        ) : null}

        <Button label="Назад к дневнику" variant="secondary" onPress={onBack} />
      </ScrollView>
    </OwnerAppFrame>
  );
}

export function PetDiaryScreen({ petId, petName, onBack, onSwitchPet, api = petDiaryApi }: { petId: string; petName: string; onBack(): void; onSwitchPet(): void; api?: DiaryApi }) {
  const { session } = useSession();
  const { width } = useWindowDimensions();
  const desktop = width >= 860;
  const [selection, setSelection] = useState<{ petId: string; resultId: string } | null>(null);
  const query = useQuery({
    queryKey: ['owner', session?.cacheScope, 'pet-diary', petId],
    enabled: Boolean(session),
    queryFn: ({ signal }) => api.read(session!.opaqueCredential, petId, signal),
  });
  const data = !query.isError && query.data?.petId === petId ? query.data : undefined;
  const selected = selection?.petId === petId ? data?.clinicalEntries.find((entry) => entry.result.resultId === selection.resultId) : undefined;

  if (selected) return <ResultDetail petName={petName} entry={selected} onBack={() => setSelection(null)} />;

  return (
    <OwnerAppFrame wide>
      <ScrollView
        style={{ flex: 1, backgroundColor: t.ownerHome.canvas }}
        contentContainerStyle={{ width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: desktop ? 28 : 14, paddingVertical: desktop ? 28 : 16, gap: 14 }}
      >
        <View style={{ minHeight: desktop ? 210 : 172, borderRadius: 24, overflow: 'hidden', backgroundColor: '#EAF2FF', flexDirection: desktop ? 'row' : 'column' }}>
          <View style={{ flex: 1.05, padding: desktop ? 26 : 18, justifyContent: 'center', gap: 7 }}>
            <Text style={{ ...t.typography.caption, color: t.ownerHome.bluePressed, fontWeight: '800', textTransform: 'uppercase' }}>История заботы</Text>
            <Text accessibilityRole="header" style={{ fontSize: desktop ? 34 : 28, lineHeight: desktop ? 40 : 34, fontWeight: '800', color: t.ownerHome.ink }}>Дневник: {petName}</Text>
            <Text style={{ ...t.typography.secondaryBody, color: t.ownerHome.ink }}>
              Опубликованные клиникой результаты приёмов. Один результат сохраняется как исходный, поздние уточнения идут отдельно.
            </Text>
            <Text style={{ ...t.typography.caption, color: t.ownerHome.ink }}>
              Документы и результаты остаются с питомцем — их не нужно искать заново перед следующим визитом.
            </Text>
          </View>
          <Image
            accessibilityLabel="Ветеринарный приём питомца"
            source={v50ReferenceAssets.clinicDiagnostic}
            resizeMode="cover"
            style={{ width: desktop ? 340 : '100%', height: desktop ? 210 : 124 }}
          />
        </View>

        <View style={{ alignItems: 'flex-start' }}>
          <Button label="Выбрать другого питомца" variant="secondary" onPress={onSwitchPet} />
        </View>

        {query.isPending ? <StateMessage kind="loading" title="Загружаем дневник" /> : null}
        {query.isError || (query.data && query.data.petId !== petId) ? (
          <StateMessage
            kind="error"
            title="Дневник недоступен"
            body="Не удалось безопасно загрузить результаты. Повторите попытку."
            action={<Button label="Повторить" onPress={() => { void query.refetch(); }} />}
          />
        ) : null}
        {data?.clinicalEntries.length === 0 ? (
          <StateMessage
            kind="empty"
            title="В дневнике пока нет результатов"
            body="Здесь появятся результаты приёмов после публикации клиникой."
          />
        ) : null}

        {data?.clinicalEntries.length ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 10 }}>
              <DiarySurface><Text style={{ ...t.typography.caption, color: t.ownerHome.muted }}>Опубликовано приёмов</Text><Text style={{ fontSize: 28, fontWeight: '800', color: t.ownerHome.ink }}>{data.clinicalEntries.length}</Text></DiarySurface>
              <DiarySurface><Text style={{ ...t.typography.caption, color: t.ownerHome.muted }}>История питомца</Text><Text style={{ ...t.typography.body, fontWeight: '700', color: t.ownerHome.ink }}>Результаты и уточнения в одном месте</Text></DiarySurface>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
              <Text style={{ ...t.typography.sectionTitle, color: t.ownerHome.ink }}>Приёмы</Text>
              <Text style={{ ...t.typography.caption, color: t.ownerHome.ink }}>История публикаций клиники</Text>
            </View>
            {data.clinicalEntries.map((entry) => (
              <Pressable
                key={entry.result.resultId}
                accessibilityRole="button"
                accessibilityLabel={`Открыть результат приёма ${visitDate(entry.visit.occurredAt)}, ${entry.visit.clinic.name}`}
                onPress={() => setSelection({ petId, resultId: entry.result.resultId })}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <DiarySurface>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ ...t.typography.caption, color: t.ownerHome.blue, fontWeight: '800', textTransform: 'uppercase' }}>Опубликованный результат</Text>
                      <Text style={{ ...t.typography.sectionTitle, color: t.ownerHome.ink }}>{visitDate(entry.visit.occurredAt)}</Text>
                    </View>
                    {entry.amendments.length > 0 ? <StatusPill label={`Уточнений: ${entry.amendments.length}`} tone="info" /> : null}
                  </View>
                  <VisitContext entry={entry} />
                  <Text numberOfLines={3} style={{ ...t.typography.secondaryBody, color: t.ownerHome.muted }}>{entry.result.content}</Text>
                  <Text style={{ ...t.typography.label, color: t.ownerHome.blue }}>Открыть результат ›</Text>
                </DiarySurface>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Button label="Назад" variant="ghost" onPress={onBack} />
      </ScrollView>
    </OwnerAppFrame>
  );
}

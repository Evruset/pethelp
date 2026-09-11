import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button, Field, OwnerAppFrame, StateMessage } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { v50ReferenceAssets } from '@/ui/v50-reference-assets';
import { BookingProgress } from '@/booking/BookingProgress';
import { usePetJourney } from './PetJourneyProvider';
import type { PetSpecies } from './pet-api';

export type PetJourneyPurpose = 'booking' | 'time' | 'diary';

const purposeCopy: Record<PetJourneyPurpose, { eyebrow: string; title: string; body: string; cancel: string }> = {
  booking: {
    eyebrow: 'Запись в клинику',
    title: 'Кого записываем?',
    body: 'Выберите питомца. Его профиль используем для этой записи и следующих визитов.',
    cancel: 'Отменить запись',
  },
  time: {
    eyebrow: 'Поиск времени',
    title: 'Для кого ищем ближайшее время?',
    body: 'После выбора питомца перейдём к клинике и опубликованным свободным слотам.',
    cancel: 'Закрыть поиск',
  },
  diary: {
    eyebrow: 'Дневник питомца',
    title: 'Чей дневник открыть?',
    body: 'Результаты приёмов и рекомендации хранятся отдельно для каждого питомца.',
    cancel: 'Вернуться на главную',
  },
};

const speciesLabel = (species: PetSpecies) =>
  species === 'DOG' ? 'Собака' : species === 'CAT' ? 'Кошка' : 'Другой вид';

export function PetJourneyScreen({
  purpose = 'booking',
  onCancel,
}: {
  purpose?: PetJourneyPurpose;
  onCancel?(): void;
}) {
  const journey = usePetJourney();
  const { width } = useWindowDimensions();
  const desktop = width >= 860;
  const copy = purposeCopy[purpose];
  const [creatingForm, setCreatingForm] = useState(false);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('DOG');
  const normalized = name.trim();
  const invalid = Array.from(normalized).length < 1 || Array.from(normalized).length > 120;
  const cancelJourney = () => {
    journey.cancel();
    onCancel?.();
  };

  return (
    <OwnerAppFrame wide>
      <ScrollView
        style={{ flex: 1, backgroundColor: t.ownerHome.canvas }}
        contentContainerStyle={{
          width: '100%',
          maxWidth: 1180,
          alignSelf: 'center',
          paddingHorizontal: desktop ? 24 : 12,
          paddingTop: desktop ? 14 : 10,
          paddingBottom: desktop ? 42 : 92,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {purpose !== 'diary' ? <BookingProgress current={1} /> : null}
        <View
          style={{
            minHeight: desktop ? 154 : undefined,
            borderWidth: 1,
            borderColor: t.ownerHome.border,
            borderRadius: 18,
            overflow: 'hidden',
            backgroundColor: t.ownerHome.surface,
            flexDirection: desktop ? 'row' : 'column',
            ...t.shadow.card,
          }}
        >
          <View style={{ flex: 1, padding: desktop ? 18 : 16, justifyContent: 'center', gap: 5 }}>
            <Text style={{ ...t.typography.caption, color: t.ownerHome.blue, fontWeight: '800', textTransform: 'uppercase' }}>
              {copy.eyebrow}
            </Text>
            <Text accessibilityRole="header" style={{ fontSize: desktop ? 30 : 26, lineHeight: desktop ? 35 : 31, fontWeight: '800', color: t.ownerHome.ink }}>
              {copy.title}
            </Text>
            <Text style={{ ...t.typography.secondaryBody, color: t.ownerHome.muted, maxWidth: 620 }}>{copy.body}</Text>
          </View>
          <View style={{ width: desktop ? 280 : '100%', height: desktop ? 154 : 132, backgroundColor: t.ownerHome.blueSoft }}>
            <Image
              accessibilityLabel="Питомец на приёме у ветеринара"
              source={v50ReferenceAssets.vetExam}
              resizeMode="cover"
              style={{ width: '100%', height: '100%' }}
            />
            <View style={{ position: 'absolute', left: 7, bottom: 7, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9, backgroundColor: 'rgba(24,37,65,.82)' }}>
              <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700' }}>Забота о питомце</Text>
            </View>
          </View>
        </View>

        {journey.loading ? <StateMessage kind="loading" title="Загружаем питомцев" /> : null}
        {journey.error ? (
          <StateMessage
            kind="error"
            title="Не удалось загрузить питомцев"
            action={<Button label="Повторить" onPress={journey.retry} />}
          />
        ) : null}

        {!journey.loading && !journey.error ? (
          <View style={{ gap: 10 }}>
            {journey.pets.length === 0 && !creatingForm ? (
              <View style={{ padding: 16, gap: 8, borderWidth: 1, borderColor: t.ownerHome.border, borderRadius: 16, backgroundColor: t.ownerHome.surface }}>
                <Text style={{ ...t.typography.sectionTitle, color: t.ownerHome.ink }}>У вас пока нет питомцев</Text>
                <Text style={{ ...t.typography.secondaryBody, color: t.ownerHome.muted }}>
                  Добавьте профиль один раз — имя и вид питомца будут доступны в следующих записях.
                </Text>
                <View style={{ maxWidth: 240 }}>
                  <Button label="Добавить питомца" onPress={() => setCreatingForm(true)} />
                </View>
              </View>
            ) : null}

            {journey.pets.length > 0 && !creatingForm ? (
              <View accessibilityRole="radiogroup" accessibilityLabel="Выбор питомца" style={{ gap: 8 }}>
                {journey.pets.map((pet) => {
                  const selected = journey.selectedPetId === pet.petId;
                  return (
                    <Pressable
                      key={pet.petId}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => journey.select(pet.petId)}
                      style={({ pressed }) => ({
                        minHeight: 76,
                        paddingHorizontal: 13,
                        paddingVertical: 10,
                        borderWidth: selected ? 2 : 1,
                        borderColor: selected ? t.ownerHome.blue : t.ownerHome.border,
                        borderRadius: 16,
                        backgroundColor: selected ? t.ownerHome.blueSoft : t.ownerHome.surface,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        opacity: pressed ? 0.72 : 1,
                        ...t.shadow.card,
                      })}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 16,
                          backgroundColor: '#FFF1E2',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 22, fontWeight: '800', color: '#9A622F' }}>
                          {pet.name.trim().slice(0, 1).toUpperCase() || '•'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ fontSize: 18, lineHeight: 22, fontWeight: '800', color: t.ownerHome.ink }}>{pet.name}</Text>
                        <Text style={{ ...t.typography.caption, color: t.ownerHome.muted }}>{speciesLabel(pet.species)}</Text>
                      </View>
                      <Text style={{ ...t.typography.label, color: selected ? t.ownerHome.blue : t.ownerHome.muted }}>
                        {selected ? 'Выбран' : 'Выбрать'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {journey.pets.length > 0 && !creatingForm ? (
              <View style={{ flexDirection: desktop ? 'row' : 'column', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ maxWidth: 220 }}>
                  <Button label="Добавить ещё" variant="secondary" onPress={() => setCreatingForm(true)} />
                </View>
                <View style={{ minWidth: desktop ? 220 : undefined, gap: 8 }}>
                  {journey.selectedPetId ? (
                    <Button label="Продолжить" onPress={journey.continueSelection} />
                  ) : (
                    <Text style={{ ...t.typography.secondaryBody, color: t.ownerHome.muted }}>Выберите одного питомца, чтобы продолжить</Text>
                  )}
                </View>
              </View>
            ) : null}

            {journey.selectionStale ? (
              <StateMessage kind="error" title="Выбранный питомец больше недоступен. Выберите другого или добавьте нового." />
            ) : null}

            {creatingForm ? (
              <View style={{ padding: desktop ? 18 : 14, gap: 10, borderWidth: 1, borderColor: t.ownerHome.border, borderRadius: 16, backgroundColor: t.ownerHome.surface }}>
                <Text style={{ ...t.typography.sectionTitle, color: t.ownerHome.ink }}>Новый питомец</Text>
                <Field
                  label="Имя питомца"
                  value={name}
                  onChangeText={setName}
                  error={name.length > 0 && invalid ? 'Введите от 1 до 120 символов' : undefined}
                />
                <View accessibilityRole="radiogroup" accessibilityLabel="Вид питомца" style={{ flexDirection: desktop ? 'row' : 'column', gap: 8 }}>
                  {(['DOG', 'CAT', 'OTHER'] as PetSpecies[]).map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: species === value }}
                      onPress={() => setSpecies(value)}
                      style={({ pressed }) => ({
                        flex: desktop ? 1 : undefined,
                        minHeight: 44,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: species === value ? 2 : 1,
                        borderColor: species === value ? t.ownerHome.blue : t.ownerHome.border,
                        backgroundColor: species === value ? t.ownerHome.blueSoft : t.ownerHome.surface,
                        justifyContent: 'center',
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Text style={{ ...t.typography.label, color: t.ownerHome.ink }}>{value}</Text>
                    </Pressable>
                  ))}
                </View>
                {journey.createError ? <StateMessage kind="error" title="Не удалось сохранить питомца. Повторите попытку." /> : null}
                <Button
                  label={journey.creating ? 'Сохраняем…' : 'Сохранить питомца'}
                  disabled={invalid || journey.creating}
                  onPress={() => {
                    void journey
                      .create({ name: normalized, species })
                      .then(() => setCreatingForm(false))
                      .catch(() => undefined);
                  }}
                />
                <Button label="Отмена" variant="secondary" disabled={journey.creating} onPress={() => setCreatingForm(false)} />
              </View>
            ) : null}

            {!creatingForm ? (
              <View style={{ paddingTop: 2, alignItems: 'flex-start' }}>
                <Button label={copy.cancel} variant="secondary" onPress={cancelJourney} />
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </OwnerAppFrame>
  );
}

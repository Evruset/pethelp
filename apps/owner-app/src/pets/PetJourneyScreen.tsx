import { useState } from 'react';
import { View } from 'react-native';
import { BodyText, Button, Field, InsetSection, ListRow, Screen, Skeleton, StateMessage } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { usePetJourney } from './PetJourneyProvider';
import type { PetSpecies } from './pet-api';

export function PetJourneyScreen() {
  const journey = usePetJourney();
  const [creatingForm, setCreatingForm] = useState(false);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('DOG');
  const normalized = name.trim(); const invalid = Array.from(normalized).length < 1 || Array.from(normalized).length > 120;
  if (journey.loading) return <Screen title="Выберите питомца" subtitle="Кого записываем в клинику?"><StateMessage kind="loading" title="Загружаем питомцев" body="Карточки появятся здесь без изменения шага." /><InsetSection title="Ваши питомцы"><Skeleton height={68} /><Skeleton height={1} /><Skeleton height={68} /></InsetSection></Screen>;
  if (journey.error) return <Screen title="Выберите питомца" subtitle="Кого записываем в клинику?"><StateMessage kind="error" title="Не удалось загрузить питомцев" body="Проверьте соединение и попробуйте ещё раз." action={<Button label="Повторить" onPress={journey.retry} />} /></Screen>;
  return <Screen title="Выберите питомца" subtitle="Кого записываем в клинику?" backAction={journey.cancel}>
    {journey.pets.length === 0 && !creatingForm ? <StateMessage kind="empty" title="У вас пока нет питомцев" body="Добавьте питомца — имя и вид помогут клинике подготовиться к визиту." action={<Button label="Добавить питомца" onPress={() => setCreatingForm(true)} />} /> : null}
    {journey.pets.length > 0 && !creatingForm ? <InsetSection title="Мои питомцы">{journey.pets.map((pet, index) => <View key={pet.petId}>{index > 0 ? <View style={{ height: 1, backgroundColor: t.color.separator, marginLeft: t.spacing.lg }} /> : null}<ListRow title={pet.name} subtitle={pet.species === 'DOG' ? 'Собака' : pet.species === 'CAT' ? 'Кошка' : 'Другой вид'} selected={journey.selectedPetId === pet.petId} onPress={() => journey.select(pet.petId)} /></View>)}</InsetSection> : null}
    {journey.pets.length > 0 && !creatingForm ? <Button label="Добавить ещё" variant="secondary" onPress={() => setCreatingForm(true)} /> : null}
    {journey.selectionStale ? <StateMessage kind="error" title="Выбранный питомец больше недоступен. Выберите другого или добавьте нового." /> : null}
    {creatingForm ? <View style={{ gap: t.spacing.lg }}><InsetSection title="Новый питомец"><View style={{ padding: t.spacing.lg, gap: t.spacing.lg }}><Field label="Имя питомца" value={name} onChangeText={setName} placeholder="Например, Марс" error={name.length > 0 && invalid ? 'Введите от 1 до 120 символов' : undefined} />
      <View accessibilityRole="radiogroup" style={{ gap: t.spacing.sm }}><BodyText secondary>Вид питомца</BodyText>{(['DOG','CAT','OTHER'] as PetSpecies[]).map((value) => <ListRow key={value} title={value === 'DOG' ? 'Собака' : value === 'CAT' ? 'Кошка' : 'Другой вид'} selected={species === value} onPress={() => setSpecies(value)} />)}</View></View></InsetSection>
      {journey.createError ? <StateMessage kind="error" title="Не удалось сохранить питомца. Повторите попытку." /> : null}
      <Button label={journey.creating ? 'Сохраняем…' : 'Сохранить питомца'} disabled={invalid || journey.creating} onPress={() => { void journey.create({ name: normalized, species }).then(() => setCreatingForm(false)).catch(() => undefined); }} />
      <Button label="Отмена" variant="ghost" disabled={journey.creating} onPress={() => setCreatingForm(false)} /></View> : null}
    {journey.selectedPetId ? <Button label="Продолжить" onPress={journey.continueSelection} /> : journey.pets.length > 0 && !creatingForm ? <BodyText secondary>Выберите одного питомца, чтобы продолжить.</BodyText> : null}
    {!creatingForm ? <Button label="Отменить запись" variant="ghost" onPress={journey.cancel} /> : null}
  </Screen>;
}

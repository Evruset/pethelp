import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Field, Screen, StateMessage } from '@/ui/primitives';
import { usePetJourney } from './PetJourneyProvider';
import type { PetSpecies } from './pet-api';

export function PetJourneyScreen() {
  const journey = usePetJourney();
  const [creatingForm, setCreatingForm] = useState(false);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('DOG');
  const normalized = name.trim(); const invalid = Array.from(normalized).length < 1 || Array.from(normalized).length > 120;
  if (journey.loading) return <Screen title="Выберите питомца"><StateMessage kind="loading" title="Загружаем питомцев" /></Screen>;
  if (journey.error) return <Screen title="Выберите питомца"><StateMessage kind="error" title="Не удалось загрузить питомцев" action={<Button label="Повторить" onPress={journey.retry} />} /></Screen>;
  return <Screen title="Выберите питомца">
    {journey.pets.length === 0 && !creatingForm ? <StateMessage kind="empty" title="У вас пока нет питомцев" action={<Button label="Добавить питомца" onPress={() => setCreatingForm(true)} />} /> : null}
    {journey.pets.map((pet) => <Card key={pet.petId} selected={journey.selectedPetId === pet.petId} onPress={() => journey.select(pet.petId)}><Text>{pet.name}</Text><Text>{pet.species === 'DOG' ? 'Собака' : pet.species === 'CAT' ? 'Кошка' : 'Другой вид'}</Text></Card>)}
    {journey.pets.length > 0 && !creatingForm ? <Button label="Добавить ещё" onPress={() => setCreatingForm(true)} /> : null}
    {journey.selectionStale ? <StateMessage kind="error" title="Выбранный питомец больше недоступен. Выберите другого или добавьте нового." /> : null}
    {creatingForm ? <View style={{ gap: 12 }}><Field label="Имя питомца" value={name} onChangeText={setName} error={name.length > 0 && invalid ? 'Введите от 1 до 120 символов' : undefined} />
      <View accessibilityRole="radiogroup" style={{ gap: 8 }}>{(['DOG','CAT','OTHER'] as PetSpecies[]).map((value) => <Card key={value} selected={species === value} onPress={() => setSpecies(value)}><Text>{value}</Text></Card>)}</View>
      {journey.createError ? <StateMessage kind="error" title="Не удалось сохранить питомца. Повторите попытку." /> : null}
      <Button label={journey.creating ? 'Сохраняем…' : 'Сохранить питомца'} disabled={invalid || journey.creating} onPress={() => { void journey.create({ name: normalized, species }).then(() => setCreatingForm(false)).catch(() => undefined); }} />
      <Button label="Отмена" disabled={journey.creating} onPress={() => setCreatingForm(false)} /></View> : null}
    {journey.selectedPetId ? <Button label="Продолжить" onPress={journey.continueSelection} /> : <Text>Выберите одного питомца, чтобы продолжить</Text>}
    <Button label="Отменить запись" onPress={journey.cancel} />
  </Screen>;
}

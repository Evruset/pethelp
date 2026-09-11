import { useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Button, OwnerAppFrame, StateMessage } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import type { Pet } from './pet-api';
import { OwnerGlobalNav } from '@/navigation/OwnerGlobalNav';

const species = (value: Pet['species']) => value === 'DOG' ? 'Собака' : value === 'CAT' ? 'Кошка' : 'Питомец';

export function OwnerPetsScreen({ pets, loading, error, onHome, onClinics, onBookings, onDiary, onRetry }: {
  pets: Pet[]; loading: boolean; error: boolean; onHome(): void; onClinics(): void; onBookings(): void;
  onDiary(pet: Pet): void; onRetry(): void;
}) {
  const { width } = useWindowDimensions();
  const desktop = width >= 900;
  const [selectedId, setSelectedId] = useState<string | null>(pets.length === 1 ? pets[0].petId : null);
  const selected = pets.find((pet) => pet.petId === selectedId) ?? (pets.length === 1 ? pets[0] : null);
  return (
    <OwnerAppFrame wide>
      <View style={{ flex: 1, backgroundColor: t.ownerHome.canvas }}>
        {desktop ? <OwnerGlobalNav desktop active="PETS" onHome={onHome} onPets={() => {}} onClinics={onClinics} onBookings={onBookings} /> : null}
        <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: desktop ? 28 : 14, paddingBottom: 48, gap: 14 }}>
          <View style={{ gap: 5 }}>
            <Text style={{ ...t.typography.caption, color: t.ownerHome.blue, fontWeight: '800', textTransform: 'uppercase' }}>Мои питомцы</Text>
            <Text accessibilityRole="header" style={{ fontSize: desktop ? 36 : 30, lineHeight: desktop ? 42 : 36, fontWeight: '800', color: t.ownerHome.ink }}>Питомцы</Text>
            <Text style={{ ...t.typography.secondaryBody, color: t.ownerHome.muted }}>Профили питомцев и их опубликованная клиническая история.</Text>
          </View>
          {loading ? <StateMessage kind="loading" title="Загружаем питомцев" /> : null}
          {error ? <StateMessage kind="error" title="Не удалось загрузить питомцев" action={<Button label="Повторить" onPress={onRetry} />} /> : null}
          {!loading && !error && pets.length === 0 ? <StateMessage kind="empty" title="Питомцев пока нет" body="Добавить питомца можно в начале записи." /> : null}
          <View accessibilityRole="radiogroup" accessibilityLabel="Питомцы" style={{ flexDirection: desktop ? 'row' : 'column', flexWrap: 'wrap', gap: 10 }}>
            {pets.map((pet) => {
              const active = selected?.petId === pet.petId;
              return <Pressable key={pet.petId} accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => setSelectedId(pet.petId)} style={({ pressed }) => ({ width: desktop ? 340 : '100%', minHeight: 116, padding: 16, borderRadius: 20, borderWidth: active ? 2 : 1, borderColor: active ? t.ownerHome.blue : t.ownerHome.border, backgroundColor: active ? t.ownerHome.blueSoft : '#fff', opacity: pressed ? .72 : 1, flexDirection: 'row', alignItems: 'center', gap: 14, ...t.shadow.card })}>
                <View style={{ width: 62, height: 62, borderRadius: 22, backgroundColor: '#FFF1E2', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 28, fontWeight: '800', color: '#9A622F' }}>{pet.name.slice(0,1).toUpperCase()}</Text></View>
                <View style={{ flex: 1, gap: 3 }}><Text style={{ ...t.typography.sectionTitle, color: t.ownerHome.ink }}>{pet.name}</Text><Text style={{ ...t.typography.caption, color: t.ownerHome.muted }}>{species(pet.species)}</Text><Text style={{ ...t.typography.caption, color: t.ownerHome.muted }}>Дневник здоровья</Text></View>
              </Pressable>;
            })}
          </View>
          {selected ? <View style={{ padding: 18, gap: 10, borderRadius: 20, borderWidth: 1, borderColor: t.ownerHome.border, backgroundColor: '#fff' }}><Text style={{ ...t.typography.caption, color: t.ownerHome.blue, fontWeight: '800', textTransform: 'uppercase' }}>Здоровье питомца</Text><Text style={{ ...t.typography.sectionTitle, color: t.ownerHome.ink }}>{selected.name}</Text><View style={{ padding: 12, borderRadius: 14, backgroundColor: t.ownerHome.blueSoft }}><Text style={{ ...t.typography.label, color: t.ownerHome.ink }}>История приёмов</Text><Text style={{ ...t.typography.caption, color: t.ownerHome.muted }}>Опубликованные результаты и уточнения клиники</Text></View><Button label="Открыть дневник" onPress={() => onDiary(selected)} /></View> : null}
        </ScrollView>
        {!desktop ? <OwnerGlobalNav desktop={false} active="PETS" onHome={onHome} onPets={() => {}} onClinics={onClinics} onBookings={onBookings} /> : null}
      </View>
    </OwnerAppFrame>
  );
}

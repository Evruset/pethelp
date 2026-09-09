import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useSession } from '@/session/SessionProvider';
import { useAuthJourney } from '@/auth/AuthJourneyProvider';
import { usePetJourney } from '@/pets/PetJourneyProvider';
import { PetJourneyScreen } from '@/pets/PetJourneyScreen';
import { PetDiaryScreen } from '@/pets/PetDiaryScreen';
import { ClinicCatalogScreen } from '@/clinics/ClinicCatalogScreen';
import type { ClinicCatalogHandoff } from '@/clinics/clinic-catalog-api';
import { ClinicServiceScreen } from '@/clinics/ClinicServiceScreen';
import type { ClinicServiceHandoff } from '@/clinics/clinic-service-api';
import { AvailabilityScreen } from '@/clinics/AvailabilityScreen';
import type { AvailabilityHandoff } from '@/clinics/availability-api';
import { BookingReviewScreen } from '@/booking/BookingReviewScreen';

export default function AuthenticatedHomeScreen() {
  const {session}=useSession();
  return <AuthorityScopedHome key={`${session?.cacheScope}:${session?.opaqueCredential}`}/>;
}

function AuthorityScopedHome() {
  const [authorityGeneration]=useState(()=>`${Date.now()}-${Math.random()}`);
  const [openedClinic,setOpenedClinic]=useState<ClinicCatalogHandoff|null>(null);
  const [selectedService,setSelectedService]=useState<ClinicServiceHandoff|null>(null);
  const [selectedAvailability,setSelectedAvailability]=useState<AvailabilityHandoff|null>(null);
  const { error, logout, session } = useSession();
  const { resumedIntent, consumeResumedIntent } = useAuthJourney();
  const pets = usePetJourney();
  const [petIntent, setPetIntent] = useState<'booking' | 'diary' | null>(null);
  if(selectedAvailability&&pets.continuedPetId)return <BookingReviewScreen petId={pets.continuedPetId} context={selectedAvailability} authorityGeneration={authorityGeneration} onBack={()=>setSelectedAvailability(null)} onConflict={()=>{setSelectedAvailability(null);setSelectedService(null);}}/>;
  if(selectedService)return <AvailabilityScreen key={`${authorityGeneration}:${selectedService.clinicId}:${selectedService.locationId}:${selectedService.serviceId}`} authorityGeneration={authorityGeneration} context={selectedService} onBack={()=>setSelectedService(null)} onContinue={setSelectedAvailability}/>;
  if(openedClinic)return <ClinicServiceScreen key={`${session?.opaqueCredential}:${openedClinic.clinicId}:${openedClinic.locationId}`} clinic={openedClinic} onBack={()=>setOpenedClinic(null)} onContinue={setSelectedService}/>;
  if(pets.continuedPetId && petIntent === 'diary') return <PetDiaryScreen petId={pets.continuedPetId} petName={pets.pets.find((pet) => pet.petId === pets.continuedPetId)?.name ?? 'Питомец'} onBack={() => { pets.cancel(); setPetIntent(null); }} onSwitchPet={pets.start} />;
  if(pets.continuedPetId)return <ClinicCatalogScreen onClose={() => { pets.cancel(); setPetIntent(null); }} onOpenClinic={setOpenedClinic}/>;
  if (pets.active) return <PetJourneyScreen />;
  return (
    <View accessibilityLabel="Личный кабинет">
      <Text>VetHelp</Text>
      {resumedIntent?.kind === 'START_BOOKING' ? (
        <View accessibilityLabel="Восстановленный сценарий записи">
          <Text>Вход выполнен. Продолжите запись.</Text>
          <Pressable accessibilityRole="button" onPress={() => { consumeResumedIntent(); pets.start(); }}><Text>Продолжить запись</Text></Pressable>
        </View>
      ) : null}
      {error === 'SESSION_CLEANUP_FAILED' ? <Text accessibilityRole="alert">Не удалось завершить выход. Повторите попытку.</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => { setPetIntent('booking'); pets.start(); }}><Text>Начать запись</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { setPetIntent('diary'); pets.start(); }}><Text>Открыть дневник</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { void logout(); }}>
        <Text>Выйти</Text>
      </Pressable>
    </View>
  );
}
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { useSession } from '@/session/SessionProvider';
import { useAuthJourney } from '@/auth/AuthJourneyProvider';
import { usePetJourney } from '@/pets/PetJourneyProvider';
import { PetJourneyScreen } from '@/pets/PetJourneyScreen';
import { ClinicServiceScreen } from '@/clinics/ClinicServiceScreen';
import type { ClinicServiceHandoff } from '@/clinics/clinic-service-api';
import { AvailabilityScreen } from '@/clinics/AvailabilityScreen';
import type { AvailabilityHandoff } from '@/clinics/availability-api';
import { BookingReviewScreen } from '@/booking/BookingReviewScreen';
import { BookingStatusScreen } from '@/booking/BookingStatusScreen';
import { activeBookingStore } from '@/booking/active-booking-store';
import { BodyText, Button, GhostButton, InlineBanner, InsetSection, Screen, StatusPill } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { SpecialistDiscoveryScreen } from '@/discovery/SpecialistDiscoveryScreen';
import type { SpecialistDiscoverySelection } from '@/discovery/specialist-discovery-api';
import { PetDiaryScreen } from '@/pets/PetDiaryScreen';

export default function AuthenticatedHomeScreen() {
  const {session}=useSession();
  return <AuthorityScopedHome key={`${session?.cacheScope}:${session?.opaqueCredential}`}/>;
}

function AuthorityScopedHome() {
  const router=useRouter();
  const [authorityGeneration]=useState(()=>`${Date.now()}-${Math.random()}`);
  const [openedClinic,setOpenedClinic]=useState<{clinicId:string;locationId:string}|null>(null);
  const [selectedService,setSelectedService]=useState<ClinicServiceHandoff|null>(null);
  const [selectedAvailability,setSelectedAvailability]=useState<AvailabilityHandoff|null>(null);
  const [discoverySelection,setDiscoverySelection]=useState<SpecialistDiscoverySelection|null>(null);
  const [activeBookingId,setActiveBookingId]=useState<string|null>(null);
  const [bookingOpen,setBookingOpen]=useState(false);
  const [petIntent,setPetIntent]=useState<'booking'|'diary'|null>(null);
  const { error, logout, session } = useSession();
  const { resumedIntent, consumeResumedIntent } = useAuthJourney();
  const pets = usePetJourney();
  const interactionGeneration=useRef(0);
  const beginBooking=()=>{interactionGeneration.current+=1;setPetIntent('booking');pets.start();};
  const beginDiary=()=>{interactionGeneration.current+=1;setPetIntent('diary');pets.start();};
  const cacheScope=session?.cacheScope;
  useEffect(()=>{let current=true;const requestGeneration=interactionGeneration.current;if(cacheScope)void activeBookingStore.read(cacheScope).then((holdId)=>{if(current&&interactionGeneration.current===requestGeneration&&holdId){setActiveBookingId(holdId);setBookingOpen(true);}});return()=>{current=false;};},[cacheScope]);
  if(activeBookingId&&bookingOpen)return <BookingStatusScreen key={`${authorityGeneration}:${activeBookingId}`} holdId={activeBookingId} authorityGeneration={authorityGeneration} onClose={()=>setBookingOpen(false)}/>;
  if(selectedAvailability&&pets.continuedPetId)return <BookingReviewScreen petId={pets.continuedPetId} context={selectedAvailability} authorityGeneration={authorityGeneration} onBack={()=>setSelectedAvailability(null)} onConflict={()=>setSelectedAvailability(null)} onCreated={(holdId)=>{setOpenedClinic(null);setSelectedService(null);setSelectedAvailability(null);setDiscoverySelection(null);pets.cancel();setActiveBookingId(holdId);setBookingOpen(false);router.push(`/booking/${holdId}` as Href);}}/>;
  if(selectedService)return <AvailabilityScreen key={`${authorityGeneration}:${selectedService.clinicId}:${selectedService.locationId}:${selectedService.serviceId}`} authorityGeneration={authorityGeneration} context={selectedService} preferredSlot={discoverySelection&&discoverySelection.serviceId===selectedService.serviceId?{slotId:discoverySelection.slotId,expectedVersion:discoverySelection.expectedSlotVersion}:undefined} onBack={()=>setSelectedService(null)} onContinue={setSelectedAvailability}/>;
  if(openedClinic)return <ClinicServiceScreen key={`${session?.opaqueCredential}:${openedClinic.clinicId}:${openedClinic.locationId}`} clinic={openedClinic} preferredServiceId={discoverySelection?.serviceId} onBack={()=>{setOpenedClinic(null);setDiscoverySelection(null);}} onContinue={setSelectedService}/>;
  if(pets.continuedPetId&&petIntent==='diary')return <PetDiaryScreen key={`${session?.cacheScope}:${pets.continuedPetId}`} petId={pets.continuedPetId} petName={pets.pets.find((pet)=>pet.petId===pets.continuedPetId)?.name??'Питомец'} onBack={()=>{pets.cancel();setPetIntent(null);}} onSwitchPet={()=>pets.start()}/>;
  if(pets.continuedPetId)return <SpecialistDiscoveryScreen onClose={()=>{pets.cancel();setPetIntent(null);}} onContinue={(selection)=>{setDiscoverySelection(selection);setOpenedClinic({clinicId:selection.clinicId,locationId:selection.locationId});}}/>;
  if (pets.active) return <PetJourneyScreen />;
  return (
    <Screen title="VetHelp" accessibilityLabel="Личный кабинет" subtitle="Запись к ветеринару — спокойно и по шагам.">
      {resumedIntent?.kind === 'START_BOOKING' ? (
        <InlineBanner title="Продолжим запись" body="Вход выполнен. Продолжите запись." action={<Button label="Продолжить запись" onPress={() => { consumeResumedIntent(); beginBooking(); }} />} />
      ) : null}
      {error === 'SESSION_CLEANUP_FAILED' ? <InlineBanner tone="critical" title="Не удалось завершить выход" body="Повторите попытку. Текущая сессия остаётся защищённой." /> : null}
      <View style={{ padding: t.spacing.xl, gap: t.spacing.md, borderRadius: t.radius.section, backgroundColor: t.color.accentSoft }}>
        <StatusPill label="Онлайн-запись" tone="success" />
        <BodyText>Найдите клинику, выберите услугу и отправьте заявку на удобное время.</BodyText>
        <Button label="Начать запись" onPress={beginBooking} />
      </View>
      <InsetSection title="Дневник питомца"><View style={{ padding: t.spacing.lg, gap: t.spacing.sm }}><BodyText secondary>Результаты завершённых приёмов и последующие уточнения клиники.</BodyText><Button label="Открыть дневник" variant="secondary" onPress={beginDiary} /></View></InsetSection>
      {activeBookingId ? <InsetSection title="Текущая запись"><View style={{ padding: t.spacing.lg, gap: t.spacing.sm }}><StatusPill label="Есть активная заявка" tone="info" /><BodyText secondary>Откройте карточку, чтобы увидеть актуальный статус или отменить запись, если это разрешено клиникой.</BodyText><Button label="Открыть текущую заявку" variant="secondary" onPress={()=>setBookingOpen(true)} /></View></InsetSection> : null}
      <InsetSection title="Аккаунт"><View style={{ padding: t.spacing.sm }}><GhostButton label="Выйти" onPress={() => { void logout(); }} /></View></InsetSection>
    </Screen>
  );
}

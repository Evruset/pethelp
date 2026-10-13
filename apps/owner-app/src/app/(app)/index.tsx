import { useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/session/SessionProvider';
import { useAuthJourney } from '@/auth/AuthJourneyProvider';
import { usePetJourney } from '@/pets/PetJourneyProvider';
import { PetJourneyScreen } from '@/pets/PetJourneyScreen';
import { petApi } from '@/pets/pet-api';
import { ClinicCatalogScreen } from '@/clinics/ClinicCatalogScreen';
import type { ClinicCatalogHandoff } from '@/clinics/clinic-catalog-api';
import { ClinicServiceScreen } from '@/clinics/ClinicServiceScreen';
import type { ClinicServiceHandoff } from '@/clinics/clinic-service-api';
import { AvailabilityScreen } from '@/clinics/AvailabilityScreen';
import type { AvailabilityHandoff } from '@/clinics/availability-api';
import { BookingReviewScreen } from '@/booking/BookingReviewScreen';
import { PetDiaryScreen } from '@/pets/PetDiaryScreen';
import { MedicalSharingScreen } from '@/medical-sharing/MedicalSharingScreen';
import { OwnerAppointmentsScreen, AppointmentCard } from '@/appointments/OwnerAppointmentsScreen';
import { appointmentsApi } from '@/appointments/appointments-api';
import {PetIdentity} from '@/ui/PetIdentity';
import { Button, Card, Screen, StateMessage } from '@/ui/primitives';

export default function AuthenticatedHomeScreen() {
  const {session}=useSession();
  return <AuthorityScopedHome key={`${session?.cacheScope}:${session?.opaqueCredential}`}/>;
}
function AuthorityScopedHome() {
  const [authorityGeneration,setAuthorityGeneration]=useState(()=>`${Date.now()}-${Math.random()}`);
  const [openedClinic,setOpenedClinic]=useState<ClinicCatalogHandoff|null>(null);
  const [selectedService,setSelectedService]=useState<ClinicServiceHandoff|null>(null);
  const [selectedAvailability,setSelectedAvailability]=useState<AvailabilityHandoff|null>(null);
  const [petIntent,setPetIntent]=useState<'BOOKING'|'DIARY'|null>(null);
  const [sharing,setSharing]=useState(false);
  const [appointments,setAppointments]=useState<{ holdId?: string; petId?: string } | null>(null);
  const [viewedPet,setViewedPet]=useState<string | null>(null);
  const { error, logout, session } = useSession();
  const { resumedIntent, consumeResumedIntent } = useAuthJourney();
  const pets = usePetJourney();
  const petQuery = useQuery({ queryKey: ['owner', session?.cacheScope, 'pets'], enabled: Boolean(session), queryFn: ({ signal }) => petApi.list(session!.opaqueCredential, signal) });
  const appointmentQuery = useQuery({ queryKey: ['owner', session?.cacheScope, 'appointments'], enabled: Boolean(session), queryFn: ({ signal }) => appointmentsApi.list(session!.opaqueCredential, signal) });
  const home = () => { setOpenedClinic(null); setSelectedService(null); setSelectedAvailability(null); setPetIntent(null); setAppointments(null); setViewedPet(null); pets.cancel(); };
  const book = () => { setAuthorityGeneration(`${Date.now()}-${Math.random()}`); home(); consumeResumedIntent(); setPetIntent('BOOKING'); pets.start(); };
  const openAppointment = (holdId: string) => { home(); void appointmentQuery.refetch(); setAppointments({ holdId }); };
  const diaryPet = !petQuery.isError ? petQuery.data?.find(pet => pet.petId === viewedPet || petIntent === 'DIARY' && pet.petId === pets.continuedPetId) : undefined;
  if(sharing)return <MedicalSharingScreen onBack={()=>setSharing(false)}/>;
  if(appointments)return <OwnerAppointmentsScreen initialHoldId={appointments.holdId} petId={appointments.petId} onBack={home} onBook={book}/>;
  if(diaryPet)return <PetDiaryScreen key={diaryPet.petId} petId={diaryPet.petId} petName={diaryPet.name} species={diaryPet.species} createdAt={diaryPet.createdAt} appointments={!appointmentQuery.isError?appointmentQuery.data:undefined} onBack={home} onSwitchPet={()=>{setViewedPet(null);setPetIntent('DIARY');pets.start();}} onAppointments={()=>{setAppointments({petId:diaryPet.petId});}} onBook={book}/>;
  if(selectedAvailability&&pets.continuedPetId)return <BookingReviewScreen petId={pets.continuedPetId} context={selectedAvailability} authorityGeneration={authorityGeneration} onBack={()=>setSelectedAvailability(null)} onConflict={()=>{setSelectedAvailability(null);setSelectedService(null);}} onDone={()=>{home();void appointmentQuery.refetch();}} onOpenAppointment={openAppointment}/>;
  if(selectedService)return <AvailabilityScreen key={`${authorityGeneration}:${selectedService.clinicId}:${selectedService.locationId}:${selectedService.serviceId}`} authorityGeneration={authorityGeneration} context={selectedService} onBack={()=>setSelectedService(null)} onContinue={setSelectedAvailability}/>;
  if(openedClinic)return <ClinicServiceScreen key={`${session?.opaqueCredential}:${openedClinic.clinicId}:${openedClinic.locationId}`} clinic={openedClinic} onBack={()=>setOpenedClinic(null)} onContinue={setSelectedService}/>;
  if(petIntent==='BOOKING'&&pets.continuedPetId)return <ClinicCatalogScreen onClose={pets.start} onOpenClinic={setOpenedClinic}/>;
  if (pets.active) return <PetJourneyScreen />;
  const next = !appointmentQuery.isError ? appointmentQuery.data?.filter(item => item.bucket !== 'HISTORY').sort((a,b) => a.startsAt.localeCompare(b.startsAt))[0] : undefined;
  return <Screen title="VetHelp" footer={<View style={{flexDirection:'row',gap:12}}><View style={{flex:1}}><Button label="Записи" accessibilityLabel="Все мои записи" variant="secondary" onPress={()=>setAppointments({})}/></View><View style={{flex:1}}><Button label="Питомцы" accessibilityLabel="Управлять питомцами" variant="secondary" onPress={()=>{setPetIntent('DIARY');pets.start();}}/></View></View>}>
    <Text style={{ fontSize: 16, lineHeight:24, color: '#52655e' }}>Питомцы, записи и результаты — всё под рукой.</Text>
    {resumedIntent?.kind === 'START_BOOKING' ? <StateMessage kind="empty" title="Вход выполнен. Продолжите запись." action={<Button label="Продолжить запись" onPress={book}/>}/> : null}
    {error === 'SESSION_CLEANUP_FAILED' ? <Text accessibilityRole="alert">Не удалось завершить выход. Повторите попытку.</Text> : null}
    <Button label="Записать питомца" onPress={book}/>{!appointmentQuery.isError&&appointmentQuery.data?.some(item=>item.bucket==='REQUIRES_ACTION')?<Card><Text style={{fontWeight:'700'}}>Есть записи, требующие внимания</Text><Text>Проверьте предложения клиники и актуальный статус.</Text><Button label="Посмотреть записи" variant="secondary" onPress={()=>setAppointments({})}/></Card>:null}
    <View style={{ gap: 12 }}><Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '600' }}>Ближайшая запись</Text>
      {appointmentQuery.isPending ? <StateMessage kind="loading" title="Проверяем записи"/> : null}
      {appointmentQuery.isError ? <StateMessage kind="error" title="Не удалось обновить ближайшую запись" action={<Button label="Обновить" variant="secondary" onPress={()=>{void appointmentQuery.refetch();}}/>}/> : null}
      {next ? <AppointmentCard appointment={next} onPress={()=>openAppointment(next.holdId)}/> : appointmentQuery.isSuccess ? <Card><Text>Предстоящих записей пока нет. Выберите клинику и удобное время.</Text></Card> : null}

    </View>
    <View style={{ gap: 12 }}><Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: '600' }}>Мои питомцы</Text>
      {petQuery.isPending ? <StateMessage kind="loading" title="Загружаем питомцев"/> : null}
      {petQuery.isError ? <StateMessage kind="error" title="Не удалось загрузить питомцев" action={<Button label="Повторить" onPress={()=>{void petQuery.refetch();}}/>}/> : null}
      {!petQuery.isError ? petQuery.data?.slice(0,3).map(pet => <Card key={pet.petId}><View style={{ gap: 8 }}><PetIdentity name={pet.name} species={pet.species}/><Text style={{color:'#52655e'}}>Карточка, записи и опубликованные результаты</Text><Button label={`Карточка и дневник: ${pet.name}`} variant="secondary" onPress={()=>setViewedPet(pet.petId)}/></View></Card>) : null}
      {petQuery.isSuccess && petQuery.data.length === 0 ? <StateMessage kind="empty" title="Добавьте первого питомца, чтобы записаться в клинику"/> : null}
      {petQuery.isSuccess&&petQuery.data.length>3?<Text>Показаны 3 из {petQuery.data.length} питомцев. Все карточки доступны в разделе управления.</Text>:null}
    </View>
    <Button label="Доступ клиник к медицинским данным" variant="secondary" onPress={()=>setSharing(true)}/>
    <Button label="Выйти" variant="ghost" onPress={()=>{void logout();}}/>
  </Screen>;
}

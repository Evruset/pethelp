import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

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
import { Button, Card, OwnerAppFrame, StatusBadge } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';

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
  const beginBooking=()=>{setPetIntent('booking');pets.start();};
  const openDiary=()=>{setPetIntent('diary');pets.start();};
  return <OwnerHome onBook={beginBooking} onDiary={openDiary} onLogout={()=>{void logout();}} resumed={resumedIntent?.kind==='START_BOOKING'} onResume={()=>{consumeResumedIntent();pets.start();}} cleanupError={error==='SESSION_CLEANUP_FAILED'}/>;
}

export function OwnerHome({onBook,onDiary,onLogout,resumed=false,onResume,cleanupError=false}:{onBook():void;onDiary():void;onLogout():void;resumed?:boolean;onResume?():void;cleanupError?:boolean}) {
  const {width}=useWindowDimensions(); const desktop=Platform.OS==='web'&&width>=900;
  const nav=[['Главная',undefined,true],['Клиники',onBook,false],['Дневник',onDiary,false]] as const;
  return <OwnerAppFrame wide><View style={{flex:1}}>
    <View accessibilityLabel="Основная навигация" style={{minHeight:64,paddingHorizontal:desktop?t.spacing.xl:t.spacing.lg,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:t.color.separator}}><Text style={{...t.typography.sectionTitle,color:t.color.accent}}>VetHelp</Text><View style={{flexDirection:'row',gap:t.spacing.xs}}>{nav.map(([label,action,active])=><Pressable key={label} accessibilityRole="button" accessibilityState={{selected:active}} onPress={action} style={{minHeight:44,justifyContent:'center',paddingHorizontal:t.spacing.md,borderRadius:t.radius.control,backgroundColor:active?t.color.accentSoft:'transparent'}}><Text style={{...t.typography.label,color:active?t.color.accent:t.color.textSecondary}}>{label}</Text></Pressable>)}</View></View>
    <ScrollView contentContainerStyle={{padding:desktop?t.spacing.xxl:t.spacing.lg,gap:t.spacing.xl,maxWidth:t.layout.desktopMaxWidth,width:'100%',alignSelf:'center'}}>
      <View accessibilityLabel="Личный кабинет" style={{gap:t.spacing.xs}}><Text style={{...t.typography.label,color:t.color.accent,textTransform:'uppercase',letterSpacing:.8}}>Забота о питомце</Text><Text accessibilityRole="header" style={{...(desktop?t.typography.largeTitle:t.typography.title),color:t.color.textPrimary}}>Что важно сегодня</Text><Text style={{...t.typography.secondaryBody,color:t.color.textSecondary}}>Запись в клинику и история здоровья — рядом, без лишних шагов.</Text></View>
      {resumed?<Card><StatusBadge label="Запись не потеряна" tone="info"/><Text style={{...t.typography.sectionTitle,color:t.color.textPrimary}}>Продолжите выбор клиники</Text><Button label="Продолжить запись" onPress={onResume??onBook}/></Card>:null}
      {cleanupError?<Text accessibilityRole="alert" style={{color:t.color.critical}}>Не удалось завершить выход. Повторите попытку.</Text>:null}
      <View style={{flexDirection:desktop?'row':'column',gap:t.spacing.lg}}><View style={{flex:desktop?1:undefined}}><Card><StatusBadge label="Основное действие" tone="success"/><Text style={{...t.typography.title,color:t.color.textPrimary}}>Записать питомца в клинику</Text><Text style={{...t.typography.secondaryBody,color:t.color.textSecondary}}>Выберите клинику, услугу и удобное время. Статус записи обновится после ответа клиники.</Text><Button label="Начать запись" onPress={onBook}/></Card></View><View style={{flex:desktop?1:undefined}}><Card><Text style={{...t.typography.sectionTitle,color:t.color.textPrimary}}>История заботы</Text><Text style={{...t.typography.secondaryBody,color:t.color.textSecondary}}>Опубликованные результаты приёмов и уточнения клиники хранятся в дневнике питомца.</Text><Button label="Открыть дневник" variant="secondary" onPress={onDiary}/></Card></View></View>
      <Card><Text style={{...t.typography.sectionTitle,color:t.color.textPrimary}}>Ваш питомец</Text><Text style={{...t.typography.secondaryBody,color:t.color.textSecondary}}>Выберите питомца в начале записи или при открытии дневника. Мы используем только подтверждённые данные профиля.</Text></Card>
      <Pressable accessibilityRole="button" onPress={onLogout} style={{minHeight:44,alignSelf:'flex-start',justifyContent:'center'}}><Text style={{...t.typography.label,color:t.color.textSecondary}}>Выйти</Text></Pressable>
    </ScrollView>
  </View></OwnerAppFrame>;
}

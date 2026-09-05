import { useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';

import { useAuthJourney } from '@/auth/AuthJourneyProvider';
import { AvailabilityScreen } from '@/clinics/AvailabilityScreen';
import type { AvailabilityHandoff } from '@/clinics/availability-api';
import { ClinicCatalogScreen } from '@/clinics/ClinicCatalogScreen';
import type { ClinicCatalogHandoff } from '@/clinics/clinic-catalog-api';
import { ClinicServiceScreen } from '@/clinics/ClinicServiceScreen';
import type { ClinicServiceHandoff } from '@/clinics/clinic-service-api';
import { BookingReviewScreen } from '@/booking/BookingReviewScreen';
import { PetDiaryScreen } from '@/pets/PetDiaryScreen';
import { usePetJourney } from '@/pets/PetJourneyProvider';
import { PetJourneyScreen } from '@/pets/PetJourneyScreen';
import type { Pet } from '@/pets/pet-api';
import { useSession } from '@/session/SessionProvider';
import { Button, OwnerAppFrame, StatusBadge } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';

const h=t.ownerHome;
const speciesLabel=(species:Pet['species'])=>species==='DOG'?'Собака':species==='CAT'?'Кошка':'Питомец';

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
  return <OwnerHome onBook={beginBooking} onDiary={openDiary} onLogout={()=>{void logout();}} resumed={resumedIntent?.kind==='START_BOOKING'} onResume={()=>{consumeResumedIntent();pets.start();}} cleanupError={error==='SESSION_CLEANUP_FAILED'} currentPet={pets.pets.length===1?pets.pets[0]:null} petCount={pets.pets.length} petLoading={pets.loading} petError={pets.error} onRetryPet={pets.retry}/>;
}

type HomeProps={onBook():void;onDiary():void;onLogout():void;resumed?:boolean;onResume?():void;cleanupError?:boolean;currentPet?:Pet|null;petCount?:number;petLoading?:boolean;petError?:boolean;onRetryPet?():void};

export function OwnerHome({onBook,onDiary,onLogout,resumed=false,onResume,cleanupError=false,currentPet=null,petCount=0,petLoading=false,petError=false,onRetryPet}:HomeProps) {
  const {width}=useWindowDimensions();
  const desktop=Platform.OS==='web'&&width>=900;
  const nav=[['Главная','⌂',undefined,true],['Клиники','✚',onBook,false],['Дневник','▤',onDiary,false]] as const;
  return <OwnerAppFrame wide><View style={{flex:1,maxWidth:h.desktopMaxWidth,width:'100%',alignSelf:'center',backgroundColor:h.canvas}}>
    <View style={{flex:1,flexDirection:desktop?'row':'column'}}>
      {desktop?<View accessibilityLabel="Основная навигация" style={{width:h.sidebarWidth,paddingHorizontal:t.spacing.lg,paddingVertical:t.spacing.xl,backgroundColor:'rgba(255,255,255,0.94)',borderRightWidth:1,borderRightColor:h.border}}>
        <Brand/>
        <View style={{marginTop:t.spacing.xxl,gap:t.spacing.xs}}>{nav.map(([label,icon,action,active])=><NavItem key={label} label={label} icon={icon} active={active} onPress={action}/>)}</View>
        <View style={{marginTop:'auto',gap:t.spacing.md}}><View style={{padding:t.spacing.md,borderRadius:t.radius.card,backgroundColor:h.blueSoft}}><Text style={{...t.typography.caption,color:h.muted}}>Профиль владельца</Text><Text style={{...t.typography.label,color:h.ink,marginTop:3}}>Мои питомцы · {petCount}</Text></View><Pressable accessibilityRole="button" onPress={onLogout} style={{minHeight:44,justifyContent:'center'}}><Text style={{...t.typography.label,color:h.muted}}>Выйти</Text></Pressable></View>
      </View>:<View style={{minHeight:62,paddingHorizontal:t.spacing.lg,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'rgba(255,255,255,0.96)',borderBottomWidth:1,borderBottomColor:h.border}}><Brand compact/><Pressable accessibilityRole="button" accessibilityLabel="Выйти" onPress={onLogout} style={{minHeight:44,paddingHorizontal:t.spacing.sm,alignItems:'center',justifyContent:'center'}}><Text style={{...t.typography.caption,color:h.muted}}>Выйти</Text></Pressable></View>}
      <ScrollView style={{flex:1}} contentContainerStyle={{paddingHorizontal:desktop?t.spacing.xxl:t.spacing.lg,paddingTop:desktop?t.spacing.xxl:t.spacing.xl,paddingBottom:desktop?t.spacing.xxl:112,gap:t.spacing.xl}} showsVerticalScrollIndicator={false}>
        <View accessibilityLabel="Личный кабинет" style={{gap:4}}><Text style={{...t.typography.label,color:h.blue,textTransform:'uppercase',letterSpacing:.9}}>Личный кабинет владельца</Text><Text accessibilityRole="header" style={{...(desktop?t.typography.largeTitle:t.typography.title),color:h.ink}}>Что важно сегодня</Text><Text style={{...t.typography.secondaryBody,color:h.muted}}>Забота, запись и история здоровья — в одном месте.</Text></View>
        {resumed?<Surface><StatusBadge label="Запись не потеряна" tone="info"/><Text style={{...t.typography.sectionTitle,color:h.ink}}>Продолжите выбор клиники</Text><Text style={{...t.typography.secondaryBody,color:h.muted}}>Вход выполнен. Продолжите запись.</Text><HomeButton label="Продолжить запись" onPress={onResume??onBook}/></Surface>:null}
        {cleanupError?<Text accessibilityRole="alert" style={{color:t.color.critical}}>Не удалось завершить выход. Повторите попытку.</Text>:null}
        <View style={{flexDirection:desktop?'row':'column',gap:t.spacing.lg,alignItems:'stretch'}}><View style={{flex:desktop?1.02:undefined}}><PetHero pet={currentPet} petCount={petCount} loading={petLoading} error={petError} onBook={onBook} onDiary={onDiary} onRetry={onRetryPet}/></View><View style={{flex:desktop?0.98:undefined}}><AppointmentContext onBook={onBook}/></View></View>
        <QuickActions onBook={onBook} onDiary={onDiary} desktop={desktop}/>
      </ScrollView>
      {!desktop?<View accessibilityLabel="Основная навигация" style={{position:'absolute',left:10,right:10,bottom:10,minHeight:70,paddingHorizontal:8,flexDirection:'row',alignItems:'center',justifyContent:'space-around',borderWidth:1,borderColor:h.border,borderRadius:24,backgroundColor:'rgba(255,255,255,0.97)',...t.shadow.card}}>{nav.map(([label,icon,action,active])=><NavItem key={label} label={label} icon={icon} active={active} onPress={action} compact/>)}</View>:null}
    </View>
  </View></OwnerAppFrame>;
}

function Brand({compact=false}:{compact?:boolean}){return <View style={{flexDirection:'row',alignItems:'center',gap:t.spacing.sm}}><View style={{width:compact?34:42,height:compact?34:42,borderRadius:13,backgroundColor:h.blue,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:compact?18:22,color:'#fff'}}>✦</Text></View><Text style={{...t.typography.sectionTitle,color:h.ink}}>VetHelp</Text></View>}

function NavItem({label,icon,active,onPress,compact=false}:{label:string;icon:string;active:boolean;onPress:(()=>void)|undefined;compact?:boolean}){return <Pressable accessibilityRole="button" accessibilityState={{selected:active}} onPress={onPress} style={({pressed})=>({minHeight:compact?54:48,minWidth:compact?66:undefined,paddingHorizontal:compact?6:t.spacing.md,paddingVertical:8,borderRadius:t.radius.control,flexDirection:compact?'column':'row',alignItems:'center',justifyContent:compact?'center':'flex-start',gap:compact?2:t.spacing.sm,backgroundColor:active?h.blueSoft:'transparent',opacity:pressed?0.65:1})}><Text style={{fontSize:compact?19:18,color:active?h.blue:h.muted}}>{icon}</Text><Text style={{...t.typography.caption,fontSize:compact?10:t.typography.caption.fontSize,color:active?h.blue:h.muted,fontWeight:active?'700':'600'}}>{label}</Text></Pressable>}

function Surface({children,style}:{children:ReactNode;style?:ViewStyle}){return <View style={[{padding:t.spacing.xl,gap:t.spacing.sm,borderWidth:1,borderColor:h.border,borderRadius:22,backgroundColor:'rgba(255,255,255,0.94)',...t.shadow.card},style]}>{children}</View>}

function HomeButton({label,onPress,secondary=false}:{label:string;onPress():void;secondary?:boolean}){return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>({minHeight:t.layout.minTouch,paddingHorizontal:t.spacing.lg,paddingVertical:13,borderWidth:secondary?1:0,borderColor:h.border,borderRadius:t.radius.control,backgroundColor:secondary?h.surface:h.blue,justifyContent:'center',opacity:pressed?0.68:1})}><Text style={{...t.typography.button,color:secondary?h.blue:'#FFFFFF',textAlign:'center'}}>{label}</Text></Pressable>}

function PetHero({pet,petCount,loading,error,onBook,onDiary,onRetry}:{pet:Pet|null;petCount:number;loading:boolean;error:boolean;onBook():void;onDiary():void;onRetry?():void}){
  return <Surface style={{minHeight:286}}><Text style={{...t.typography.label,color:h.blue,textTransform:'uppercase',letterSpacing:.7}}>{pet?'Текущий питомец':'Питомцы'}</Text>
    {loading?<Text style={{...t.typography.secondaryBody,color:h.muted}}>Загружаем профиль питомца…</Text>:error?<><Text style={{...t.typography.sectionTitle,color:h.ink}}>Не удалось загрузить питомца</Text><Text style={{...t.typography.secondaryBody,color:h.muted}}>Проверьте соединение и повторите.</Text>{onRetry?<Button label="Повторить" variant="secondary" onPress={onRetry}/>:null}</>:pet?<><View style={{flexDirection:'row',alignItems:'center',gap:t.spacing.lg}}><View accessibilityLabel={`Аватар питомца ${pet.name}`} style={{width:94,height:94,borderRadius:28,backgroundColor:h.canvasStrong,borderWidth:1,borderColor:h.border,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:40,color:h.blue,fontWeight:'700'}}>{pet.name.trim().charAt(0).toUpperCase()}</Text></View><View style={{flex:1,gap:4}}><Text style={{...t.typography.largeTitle,fontSize:32,color:h.ink}}>{pet.name}</Text><Text style={{...t.typography.secondaryBody,color:h.muted}}>{speciesLabel(pet.species)}</Text><Text style={{...t.typography.caption,color:h.muted}}>Подтверждённый профиль</Text></View></View><Text style={{...t.typography.secondaryBody,color:h.muted}}>Запись и история здоровья связаны с профилем питомца.</Text></>:petCount>1?<><View style={{width:72,height:72,borderRadius:24,backgroundColor:h.canvasStrong,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:28,color:h.blue,fontWeight:'700'}}>{petCount}</Text></View><Text style={{...t.typography.title,color:h.ink}}>Выберите питомца</Text><Text style={{...t.typography.secondaryBody,color:h.muted}}>Укажите, для кого открыть запись или историю здоровья.</Text></>:<><View style={{width:72,height:72,borderRadius:24,backgroundColor:h.canvasStrong,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:30,color:h.blue}}>＋</Text></View><Text style={{...t.typography.title,color:h.ink}}>Добавьте питомца</Text><Text style={{...t.typography.secondaryBody,color:h.muted}}>Профиль нужен, чтобы записаться и хранить историю здоровья.</Text></>}
    <View style={{marginTop:'auto',flexDirection:'row',gap:t.spacing.sm}}><View style={{flex:1}}><HomeButton label={pet?'Записаться':petCount>1?'Выбрать питомца':'Добавить питомца'} onPress={onBook}/></View>{pet?<View style={{flex:1}}><HomeButton label="Открыть дневник" secondary onPress={onDiary}/></View>:null}</View>
  </Surface>;
}

function AppointmentContext({onBook}:{onBook():void}){return <Surface style={{minHeight:286,backgroundColor:h.surfaceSoft}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:t.spacing.sm}}><View style={{flex:1}}><Text style={{...t.typography.label,color:h.blue,textTransform:'uppercase',letterSpacing:.7}}>Ближайшее действие</Text><Text style={{...t.typography.title,color:h.ink,marginTop:5}}>Запись появится здесь</Text></View><View style={{width:46,height:46,borderRadius:15,backgroundColor:h.blueSoft,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:23,color:h.blue}}>◷</Text></View></View><Text style={{...t.typography.secondaryBody,color:h.muted}}>Сейчас Home не получает список записей. Когда данные станут доступны, здесь будут время, услуга, статус и следующий шаг.</Text><View style={{marginTop:t.spacing.sm,padding:t.spacing.md,borderRadius:t.radius.card,backgroundColor:h.surface,borderWidth:1,borderColor:h.border,flexDirection:'row',alignItems:'center',gap:t.spacing.sm}}><Text style={{fontSize:20,color:h.blue}}>✓</Text><Text style={{...t.typography.caption,color:h.muted,flex:1}}>Без неподтверждённых деталей</Text></View><View style={{marginTop:'auto'}}><HomeButton label="Найти клинику" onPress={onBook}/></View></Surface>}

function QuickActions({onBook,onDiary,desktop}:{onBook():void;onDiary():void;desktop:boolean}){return <View style={{gap:t.spacing.md}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{...t.typography.sectionTitle,color:h.ink}}>Сервисы</Text><Text style={{...t.typography.caption,color:h.muted}}>Всё важное рядом</Text></View><View style={{flexDirection:desktop?'row':'column',gap:t.spacing.sm}}><ActionRow icon="✚" title="Клиники и услуги" subtitle="Выбрать подходящую помощь" onPress={onBook}/><ActionRow icon="▤" title="История заботы" subtitle="Результаты и уточнения" onPress={onDiary}/></View></View>}

function ActionRow({icon,title,subtitle,onPress}:{icon:string;title:string;subtitle:string;onPress():void}){return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>({flex:1,minHeight:78,padding:t.spacing.md,borderWidth:1,borderColor:h.border,borderRadius:t.radius.card,backgroundColor:h.surface,flexDirection:'row',alignItems:'center',gap:t.spacing.md,opacity:pressed?0.65:1})}><View style={{width:42,height:42,borderRadius:14,backgroundColor:h.blueSoft,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:20,color:h.blue}}>{icon}</Text></View><View style={{flex:1}}><Text style={{...t.typography.label,color:h.ink}}>{title}</Text><Text style={{...t.typography.caption,color:h.muted,marginTop:2}}>{subtitle}</Text></View><Text style={{fontSize:22,color:h.blue}}>›</Text></Pressable>}

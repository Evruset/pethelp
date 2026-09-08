import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { useAuthJourney } from '@/auth/AuthJourneyProvider';
import { BookingReviewScreen } from '@/booking/BookingReviewScreen';
import { BookingStatusScreen } from '@/booking/BookingStatusScreen';
import { activeBookingStore } from '@/booking/active-booking-store';
import { AvailabilityScreen } from '@/clinics/AvailabilityScreen';
import type { AvailabilityHandoff } from '@/clinics/availability-api';
import { ClinicCatalogScreen } from '@/clinics/ClinicCatalogScreen';
import type { ClinicCatalogHandoff } from '@/clinics/clinic-catalog-api';
import { ClinicDetailScreen } from '@/clinics/ClinicDetailScreen';
import { ClinicServiceScreen } from '@/clinics/ClinicServiceScreen';
import type { ClinicServiceHandoff } from '@/clinics/clinic-service-api';
import { SpecialistSelectionScreen } from '@/discovery/SpecialistSelectionScreen';
import type { SpecialistSelection } from '@/discovery/specialist-discovery-api';
import { specialistDiscoveryApi } from '@/discovery/specialist-discovery-api';
import {
  ownerIntentCatalogMode,
  ownerIntentPetPurpose,
  ownerIntentRequiresPet,
  type OwnerHomeIntent,
} from '@/home/owner-home-intent';
import { PetDiaryScreen } from '@/pets/PetDiaryScreen';
import { usePetJourney } from '@/pets/PetJourneyProvider';
import { PetJourneyScreen } from '@/pets/PetJourneyScreen';
import type { Pet } from '@/pets/pet-api';
import { useSession } from '@/session/SessionProvider';
import { Button, OwnerAppFrame, StatusBadge } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { v50ReferenceAssets } from '@/ui/v50-reference-assets';

const h = t.ownerHome;
const specialistSelectionEnabled = process.env.EXPO_PUBLIC_OWNER_R2F_SPECIALIST_SELECTION === 'true';
const speciesLabel = (species: Pet['species']) =>
  species === 'DOG' ? 'Собака' : species === 'CAT' ? 'Кошка' : 'Питомец';

export default function AuthenticatedHomeScreen() {
  const { session } = useSession();
  return <AuthorityScopedHome key={`${session?.cacheScope}:${session?.opaqueCredential}`} />;
}

function AuthorityScopedHome() {
  const router = useRouter();
  const [authorityGeneration] = useState(() => `${Date.now()}-${Math.random()}`);
  const [intent, setIntent] = useState<OwnerHomeIntent | null>(null);
  const [openedClinic, setOpenedClinic] = useState<ClinicCatalogHandoff | null>(null);
  const [choosingService, setChoosingService] = useState(false);
  const [selectedService, setSelectedService] = useState<ClinicServiceHandoff | null>(null);
  const [selectedSpecialist, setSelectedSpecialist] = useState<SpecialistSelection | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [selectedAvailability, setSelectedAvailability] = useState<AvailabilityHandoff | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const { error, logout, session } = useSession();
  const { resumedIntent, consumeResumedIntent } = useAuthJourney();
  const pets = usePetJourney();
  const interactionGeneration = useRef(0);
  const cacheScope = session?.cacheScope;

  useEffect(() => {
    let current = true;
    const requestGeneration = interactionGeneration.current;
    if (cacheScope) void activeBookingStore.read(cacheScope).then((holdId) => {
      if (current && interactionGeneration.current === requestGeneration && holdId) {
        setActiveBookingId(holdId);
        setBookingOpen(true);
      }
    });
    return () => { current = false; };
  }, [cacheScope]);

  const clearDownstream = () => {
    setOpenedClinic(null);
    setChoosingService(false);
    setSelectedService(null);
    setSelectedSpecialist(null);
    setAvailabilityOpen(false);
    setSelectedAvailability(null);
  };

  const startIntent = (next: OwnerHomeIntent) => {
    interactionGeneration.current += 1;
    clearDownstream();
    setIntent(next);
    if (ownerIntentRequiresPet(next)) pets.start();
    else pets.cancel();
  };

  const closeJourney = () => {
    interactionGeneration.current += 1;
    pets.cancel();
    clearDownstream();
    setIntent(null);
  };

  if (activeBookingId && bookingOpen) {
    return <BookingStatusScreen key={`${authorityGeneration}:${activeBookingId}`} holdId={activeBookingId} authorityGeneration={authorityGeneration} onClose={() => setBookingOpen(false)} />;
  }

  if (selectedAvailability) {
    if (pets.continuedPetId) {
      return (
        <BookingReviewScreen
          petId={pets.continuedPetId}
          context={selectedAvailability}
          authorityGeneration={authorityGeneration}
          onBack={() => setSelectedAvailability(null)}
          onConflict={() => {
            setSelectedAvailability(null);
            setSelectedService(null);
          }}
          onCreated={(holdId) => {
            clearDownstream();
            pets.cancel();
            setActiveBookingId(holdId);
            setBookingOpen(false);
            router.push(`/booking/${holdId}` as Href);
          }}
        />
      );
    }
    if (pets.active) {
      return <PetJourneyScreen purpose="booking" onCancel={() => setSelectedAvailability(null)} />;
    }
  }

  if (selectedService && (!specialistSelectionEnabled || (selectedSpecialist && availabilityOpen))) {
    return (
      <AvailabilityScreen
        key={`${authorityGeneration}:${selectedService.clinicId}:${selectedService.locationId}:${selectedService.serviceId}:${selectedSpecialist?.doctorId ?? 'default-off'}`}
        authorityGeneration={authorityGeneration}
        context={selectedService}
        preferredSlot={selectedSpecialist?.slots[0]}
        allowedSlots={selectedSpecialist?.slots}
        revalidateContext={selectedSpecialist&&session?async(slot)=>{const snapshot=await specialistDiscoveryApi.searchByServiceId(session.opaqueCredential,selectedService.serviceId);const doctor=snapshot.doctors.find((item)=>item.doctorId===selectedSpecialist.doctorId&&item.serviceId===selectedService.serviceId&&item.clinicId===selectedService.clinicId&&item.locationId===selectedService.locationId);const valid=Boolean(doctor?.slots.some((item)=>item.slotId===slot.slotId&&item.expectedVersion===slot.expectedVersion));if(!valid){setSelectedSpecialist(null);setAvailabilityOpen(false);}return valid;}:undefined}
        onBack={() => specialistSelectionEnabled ? setAvailabilityOpen(false) : setSelectedService(null)}
        onContinue={(availability) => {
          setSelectedAvailability(availability);
          if (!pets.continuedPetId) {
            setIntent('BOOKING');
            pets.start();
          }
        }}
      />
    );
  }

  if (selectedService) {
    return <SpecialistSelectionScreen key={`${authorityGeneration}:${selectedService.clinicId}:${selectedService.locationId}:${selectedService.serviceId}`} authorityGeneration={authorityGeneration} context={selectedService} petName={pets.pets.find((pet)=>pet.petId===pets.continuedPetId)?.name} initialSelection={selectedSpecialist} onBack={()=>{setSelectedSpecialist(null);setSelectedService(null);}} onContinue={(specialist)=>{setSelectedSpecialist(specialist);setAvailabilityOpen(true);}}/>;
  }

  if (openedClinic) {
    return choosingService ? (
      <ClinicServiceScreen
        key={`${session?.opaqueCredential}:${openedClinic.clinicId}:${openedClinic.locationId}`}
        clinic={openedClinic}
        onBack={() => setChoosingService(false)}
        onContinue={(service)=>{setSelectedSpecialist(null);setAvailabilityOpen(false);setSelectedService(service);}}
      />
    ) : (
      <ClinicDetailScreen
        clinic={openedClinic}
        onBack={() => setOpenedClinic(null)}
        onChooseService={() => setChoosingService(true)}
      />
    );
  }

  if (intent === 'DIARY' && pets.continuedPetId) {
    return (
      <PetDiaryScreen
        petId={pets.continuedPetId}
        petName={pets.pets.find((pet) => pet.petId === pets.continuedPetId)?.name ?? 'Питомец'}
        onBack={closeJourney}
        onSwitchPet={() => pets.start()}
      />
    );
  }

  if (intent && ownerIntentRequiresPet(intent) && !pets.continuedPetId && pets.active) {
    return <PetJourneyScreen purpose={ownerIntentPetPurpose(intent)} onCancel={() => setIntent(null)} />;
  }

  if (intent === 'CLINICS' || (intent && intent !== 'DIARY' && pets.continuedPetId)) {
    return (
      <ClinicCatalogScreen
        mode={ownerIntentCatalogMode(intent)}
        onClose={closeJourney}
        onOpenClinic={(clinic) => { setOpenedClinic(clinic); setChoosingService(false); }}
      />
    );
  }

  const resumeBooking = () => {
    consumeResumedIntent();
    startIntent('BOOKING');
  };

  return (
    <OwnerHome
      onBook={() => startIntent('BOOKING')}
      onClinics={() => startIntent('CLINICS')}
      onFindTime={() => startIntent('TIME')}
      onDiary={() => startIntent('DIARY')}
      onLogout={() => {
        void logout();
      }}
      resumed={resumedIntent?.kind === 'START_BOOKING'}
      onResume={resumeBooking}
      cleanupError={error === 'SESSION_CLEANUP_FAILED'}
      currentPet={pets.pets.length === 1 ? pets.pets[0] : null}
      petCount={pets.pets.length}
      petLoading={pets.loading}
      petError={pets.error}
      onRetryPet={pets.retry}
    />
  );
}

type HomeProps = {
  onBook(): void;
  onClinics(): void;
  onFindTime(): void;
  onDiary(): void;
  onLogout(): void;
  resumed?: boolean;
  onResume?(): void;
  cleanupError?: boolean;
  currentPet?: Pet | null;
  petCount?: number;
  petLoading?: boolean;
  petError?: boolean;
  onRetryPet?(): void;
};

export function OwnerHome({
  onBook,
  onClinics,
  onFindTime,
  onDiary,
  onLogout,
  resumed = false,
  onResume,
  cleanupError = false,
  currentPet = null,
  petCount = 0,
  petLoading = false,
  petError = false,
  onRetryPet,
}: HomeProps) {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= t.layout.ownerV50DesktopMinWidth;
  const petName = currentPet?.name;
  const nav = [
    ['Главная', '⌂', undefined, true],
    ['Клиники', '▥', onClinics, false],
    ['Дневник', '▤', onDiary, false],
  ] as const;

  return (
    <OwnerAppFrame wide>
      <View style={{ flex: 1, width: '100%', maxWidth: h.desktopMaxWidth, alignSelf: 'center', backgroundColor: h.canvas }}>
        {desktop ? <DesktopShell nav={nav} petCount={petCount} onLogout={onLogout} /> : <MobileHeader onLogout={onLogout} />}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: desktop ? 24 : 12,
            paddingTop: desktop ? 14 : 12,
            paddingBottom: desktop ? 42 : 24,
            gap: desktop ? 16 : 12,
          }}
          showsVerticalScrollIndicator={false}
        >
          <HomeHeader petName={petName} desktop={desktop} />
          {resumed ? (
            <Surface style={{ padding: 16 }}>
              <StatusBadge label="Запись не потеряна" tone="info" />
              <Text style={styles.sectionTitle}>Продолжите выбор клиники</Text>
              <Text style={styles.muted}>Вход выполнен. Продолжите запись с того же безопасного шага.</Text>
              <HomeButton label="Продолжить запись" onPress={onResume ?? onBook} />
            </Surface>
          ) : null}
          {cleanupError ? (
            <Text accessibilityRole="alert" style={{ color: t.color.critical }}>
              Не удалось завершить выход. Повторите попытку.
            </Text>
          ) : null}

          <SearchHero
            petName={petName}
            desktop={desktop}
            onBook={onBook}
            onClinics={onClinics}
            onFindTime={onFindTime}
          />
          <ImmediateValue petName={petName} desktop={desktop} onClinics={onClinics} />

          <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 16, alignItems: 'stretch' }}>
            <View style={{ flex: desktop ? 1.05 : undefined }}>
              <PetHero
                pet={currentPet}
                petCount={petCount}
                loading={petLoading}
                error={petError}
                onBook={onBook}
                onDiary={onDiary}
                onRetry={onRetryPet}
                desktop={desktop}
              />
            </View>
            <View style={{ flex: desktop ? 0.95 : undefined }}>
              <NextAction onBook={onBook} desktop={desktop} />
            </View>
          </View>

          <CoreServices
            desktop={desktop}
            onBook={onBook}
            onClinics={onClinics}
            onFindTime={onFindTime}
            onDiary={onDiary}
          />
          <CareHistory petName={petName} onDiary={onDiary} />
        </ScrollView>
        {!desktop ? <MobileNav nav={nav} /> : null}
      </View>
    </OwnerAppFrame>
  );
}

const styles = {
  sectionTitle: { ...t.typography.sectionTitle, color: h.ink },
  muted: { ...t.typography.secondaryBody, color: h.muted },
};

function Brand() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: h.blue, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 21, color: '#fff' }}>✦</Text>
      </View>
      <Text style={{ ...t.typography.sectionTitle, color: h.ink }}>VetHelp</Text>
    </View>
  );
}

type NavTuple = readonly [string, string, (() => void) | undefined, boolean];

function DesktopShell({ nav, petCount, onLogout }: { nav: readonly NavTuple[]; petCount: number; onLogout(): void }) {
  return (
    <View
      accessibilityLabel="Основная навигация"
      style={{
        height: 66,
        marginHorizontal: 24,
        marginTop: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: h.border,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,.96)',
        flexDirection: 'row',
        alignItems: 'center',
        ...t.shadow.card,
      }}
    >
      <Brand />
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 5 }}>
        {nav.map(([label, icon, action, active]) => (
          <NavButton key={label} label={label} icon={icon} onPress={action} active={active} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: h.blueSoft }}>
          <Text style={{ ...t.typography.caption, color: h.muted }}>Питомцы</Text>
          <Text style={{ ...t.typography.label, color: h.ink }}>{petCount}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onLogout} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={{ ...t.typography.label, color: h.muted }}>Выйти</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MobileHeader({ onLogout }: { onLogout(): void }) {
  return (
    <View style={{ height: 58, paddingHorizontal: 14, backgroundColor: 'rgba(255,255,255,.96)', borderBottomWidth: 1, borderBottomColor: h.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Brand />
      <Pressable accessibilityRole="button" onPress={onLogout} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}>
        <Text style={{ ...t.typography.caption, color: h.muted }}>Выйти</Text>
      </Pressable>
    </View>
  );
}

function NavButton({ label, icon, onPress, active, compact = false }: { label: string; icon: string; onPress: (() => void) | undefined; active: boolean; compact?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: compact ? 52 : 44,
        minWidth: compact ? 68 : undefined,
        paddingHorizontal: compact ? 7 : 14,
        paddingVertical: 6,
        borderRadius: 14,
        backgroundColor: active ? h.blueSoft : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: compact ? 'column' : 'row',
        gap: compact ? 1 : 7,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Text style={{ fontSize: compact ? 18 : 16, color: active ? h.blue : h.muted }}>{icon}</Text>
      <Text style={{ ...t.typography.caption, fontSize: compact ? 10 : 13, color: active ? h.blue : h.muted, fontWeight: active ? '700' : '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function MobileNav({ nav }: { nav: readonly NavTuple[] }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8, backgroundColor: h.canvas }}>
      <View accessibilityLabel="Основная навигация" style={{ minHeight: 68, paddingHorizontal: 8, borderWidth: 1, borderColor: h.border, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.98)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', ...t.shadow.card }}>
        {nav.map(([label, icon, action, active]) => (
          <NavButton compact key={label} label={label} icon={icon} onPress={action} active={active} />
        ))}
      </View>
    </View>
  );
}

function HomeHeader({ petName, desktop }: { petName?: string; desktop: boolean }) {
  return (
    <View accessibilityLabel="Личный кабинет" style={{ minHeight: desktop ? 72 : 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1, gap: 3 }}>
        {!desktop ? <Text style={{ ...t.typography.caption, color: h.blue, fontWeight: '700' }}>● Личный кабинет владельца</Text> : null}
        <Text accessibilityRole="header" style={{ fontSize: desktop ? 36 : 29, lineHeight: desktop ? 41 : 34, fontWeight: '800', color: h.ink }}>
          Доброе утро{petName ? '!' : ''}
        </Text>
        <Text style={{ ...t.typography.secondaryBody, color: h.muted }}>
          Всё важное для заботы{petName ? ` о ${petName}` : ' о питомце'} — в одном месте.
        </Text>
      </View>
    </View>
  );
}

function Surface({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ padding: 20, gap: 10, borderWidth: 1, borderColor: h.border, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.94)', shadowColor: '#26508C', shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 2 }, style]}>
      {children}
    </View>
  );
}

function HomeButton({ label, onPress, secondary = false }: { label: string; onPress(): void; secondary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ minHeight: 48, paddingHorizontal: 18, paddingVertical: 13, borderWidth: secondary ? 1 : 0, borderColor: h.border, borderRadius: 13, backgroundColor: secondary ? h.surface : pressed ? h.bluePressed : h.blue, justifyContent: 'center' })}>
      <Text style={{ ...t.typography.button, color: secondary ? h.blue : '#fff', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

function SearchHero({ petName, desktop, onBook, onClinics, onFindTime }: { petName?: string; desktop: boolean; onBook(): void; onClinics(): void; onFindTime(): void }) {
  return (
    <Surface style={{ padding: 0, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
      <View style={{ flexDirection: desktop ? 'row' : 'column', minHeight: desktop ? 300 : undefined }}>
        <View style={{ flex: 1.1, padding: desktop ? 26 : 18, gap: 12, justifyContent: 'center' }}>
          <Text style={{ ...t.typography.label, color: '#4D6588', textTransform: 'uppercase', letterSpacing: 0.7 }}>Быстрый выбор помощи</Text>
          <Text style={{ fontSize: desktop ? 40 : 30, lineHeight: desktop ? 45 : 35, fontWeight: '800', color: h.ink }}>
            Что нужно{petName ? ` ${petName}` : ' питомцу'} сейчас?
          </Text>
          <Text style={{ ...t.typography.secondaryBody, color: h.muted }}>
            Выберите подходящий путь — запись, клинику, свободное время или дневник питомца.
          </Text>
          <View accessibilityLabel="Главные действия" style={{ gap: 8 }}>
            <HeroAction icon="＋" title="Записаться" subtitle="Сначала питомец, затем клиника и время" primary onPress={onBook} />
            <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <HeroAction icon="⌖" title="Выбрать клинику" subtitle="Сразу открыть каталог" onPress={onClinics} />
              </View>
              <View style={{ flex: 1 }}>
                <HeroAction icon="◷" title="Найти время" subtitle="Питомец → клиника → свободные слоты" onPress={onFindTime} />
              </View>
            </View>
          </View>
        </View>
        <View style={{ width: desktop ? 420 : '100%', minHeight: desktop ? 300 : 190, backgroundColor: h.blueSoft }}>
          <Image
            accessible={false}
            source={v50ReferenceAssets.ownerClinic}
            resizeMode="cover"
            style={{ width: '100%', height: '100%', minHeight: desktop ? 300 : 190 }}
          />
        </View>
      </View>
    </Surface>
  );
}

function HeroAction({ icon, title, subtitle, onPress, primary = false }: { icon: string; title: string; subtitle: string; onPress(): void; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ minHeight: 72, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: primary ? '#9BC0FF' : h.border, borderRadius: 16, backgroundColor: primary ? h.blueSoft : h.surface, flexDirection: 'row', alignItems: 'center', gap: 11, opacity: pressed ? 0.65 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: primary ? '#D6E6FF' : h.surfaceSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, color: h.blue }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...t.typography.label, color: h.ink }}>{title}</Text>
        <Text style={{ ...t.typography.caption, color: h.muted, marginTop: 2 }}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function ImmediateValue({ petName, desktop, onClinics }: { petName?: string; desktop: boolean; onClinics(): void }) {
  const facts = [
    ['Клиники', 'адреса и услуги'],
    ['Цена', 'если указана клиникой'],
    ['Время', 'свободные интервалы'],
  ] as const;
  return (
    <Surface style={{ padding: desktop ? 16 : 14, flexDirection: desktop ? 'row' : 'column', alignItems: desktop ? 'center' : 'stretch', gap: desktop ? 14 : 12, backgroundColor: 'rgba(255,255,255,.82)' }}>
      <View style={{ flex: 1.2, gap: 3 }}>
        <Text style={{ ...t.typography.caption, color: h.blue, fontWeight: '800', textTransform: 'uppercase' }}>Польза сразу</Text>
        <Text style={{ ...t.typography.sectionTitle, color: h.ink }}>Сравните варианты{petName ? ` для ${petName}` : ''} без звонка</Text>
        <Text style={{ ...t.typography.caption, color: h.muted }}>Всё необходимое для выбора — в одном месте.</Text>
      </View>
      <View accessibilityLabel="Возможности записи" style={{ flex: 1.15, flexDirection: 'row', gap: 7 }}>
        {facts.map(([value, label]) => (
          <View key={value} style={{ flex: 1, minHeight: 58, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 12, backgroundColor: h.blueSoft, justifyContent: 'center' }}>
            <Text style={{ ...t.typography.label, fontSize: desktop ? 13 : 12, color: h.ink }}>{value}</Text>
            <Text style={{ ...t.typography.caption, fontSize: 10, color: h.muted, marginTop: 2 }}>{label}</Text>
          </View>
        ))}
      </View>
      <HomeButton label="Открыть каталог" secondary onPress={onClinics} />
    </Surface>
  );
}

function PetHero({ pet, petCount, loading, error, onBook, onDiary, onRetry, desktop }: { pet: Pet | null; petCount: number; loading: boolean; error: boolean; onBook(): void; onDiary(): void; onRetry?(): void; desktop: boolean }) {
  return (
    <Surface style={{ minHeight: desktop ? 276 : 238, padding: desktop ? 18 : 14, gap: 14, backgroundColor: '#FFFDFC', borderColor: '#F0D9BE' }}>
      {loading ? <Text style={styles.muted}>Загружаем питомца…</Text> : error ? (
        <View style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>Не удалось загрузить питомца</Text>
          <Text style={styles.muted}>Проверьте соединение и повторите.</Text>
          {onRetry ? <Button label="Повторить" variant="secondary" onPress={onRetry} /> : null}
        </View>
      ) : pet ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: '#FFF1E2', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#9A622F' }}>{pet.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ ...t.typography.caption, color: '#A4662E', fontWeight: '800', textTransform: 'uppercase' }}>Мой питомец</Text>
              <Text style={{ fontSize: desktop ? 30 : 27, lineHeight: 35, fontWeight: '800', color: h.ink }}>{pet.name}</Text>
              <Text style={styles.muted}>{speciesLabel(pet.species)}</Text>
            </View>
          </View>
          <View style={{ marginTop: 'auto', gap: 8 }}>
            <HomeButton label="Записаться" onPress={onBook} />
            <HomeButton label="Открыть дневник" secondary onPress={onDiary} />
          </View>
        </>
      ) : (
        <View style={{ flex: 1, gap: 10 }}>
          <Text style={{ ...t.typography.caption, color: h.blue, fontWeight: '800', textTransform: 'uppercase' }}>Питомцы</Text>
          <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: '#FFF1E2', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 34, color: '#A4662E', fontWeight: '800' }}>{petCount > 1 ? petCount : '＋'}</Text>
          </View>
          <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '800', color: h.ink }}>{petCount > 1 ? 'Выберите питомца' : 'Добавьте питомца'}</Text>
          <Text style={styles.muted}>{petCount > 1 ? 'Укажите, для кого открыть запись или дневник.' : 'Профиль нужен для записи и истории здоровья.'}</Text>
          <View style={{ marginTop: 'auto' }}>
            <HomeButton label={petCount > 1 ? 'Выбрать для записи' : 'Добавить и записаться'} onPress={onBook} />
          </View>
        </View>
      )}
    </Surface>
  );
}

function NextAction({ onBook, desktop }: { onBook(): void; desktop: boolean }) {
  return (
    <Surface style={{ minHeight: 276, padding: 0, overflow: 'hidden', backgroundColor: h.blueSoft, borderColor: '#AFCBFA' }}>
      <Image
        accessible={false}
        source={v50ReferenceAssets.clinicExam}
        resizeMode="cover"
        style={{ width: '100%', height: desktop ? 132 : 116 }}
      />
      <View style={{ padding: 16, gap: 8, flex: 1 }}>
        <Text style={{ ...t.typography.caption, color: h.blue, fontWeight: '800', textTransform: 'uppercase' }}>Новая запись</Text>
        <Text style={{ fontSize: 24, lineHeight: 30, fontWeight: '800', color: h.ink }}>Выберите удобный вариант</Text>
        <Text style={styles.muted}>Начните новый маршрут: питомец, клиника, услуга и опубликованное свободное время.</Text>
        <View style={{ marginTop: 'auto' }}>
          <HomeButton label="Начать запись" onPress={onBook} />
        </View>
      </View>
    </Surface>
  );
}

function CoreServices({ desktop, onBook, onClinics, onFindTime, onDiary }: { desktop: boolean; onBook(): void; onClinics(): void; onFindTime(): void; onDiary(): void }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.sectionTitle}>Сервисы</Text>
        <Text style={{ ...t.typography.caption, color: h.muted }}>Каждый — свой маршрут</Text>
      </View>
      <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 10 }}>
        <ServiceCard icon="＋" title="Запись" subtitle="Питомец → клиника → время" onPress={onBook} />
        <ServiceCard icon="⌖" title="Клиники" subtitle="Каталог без обязательного выбора питомца" onPress={onClinics} />
        <ServiceCard icon="◷" title="Свободное время" subtitle="Поиск опубликованных слотов" onPress={onFindTime} />
        <ServiceCard icon="▤" title="Дневник" subtitle="Результаты и рекомендации" onPress={onDiary} />
      </View>
    </View>
  );
}

function ServiceCard({ icon, title, subtitle, onPress }: { icon: string; title: string; subtitle: string; onPress(): void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 112, padding: 15, borderWidth: 1, borderColor: h.border, borderRadius: 18, backgroundColor: h.surface, gap: 7, opacity: pressed ? 0.65 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: h.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 19, color: h.blue }}>{icon}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={{ ...t.typography.caption, color: h.muted }}>{subtitle}</Text>
    </Pressable>
  );
}

function CareHistory({ petName, onDiary }: { petName?: string; onDiary(): void }) {
  return (
    <View style={{ paddingHorizontal: 4, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: h.border }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: h.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 21, color: h.blue }}>▤</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>История заботы{petName ? ` о ${petName}` : ''}</Text>
        <Text style={{ ...t.typography.caption, color: h.muted, marginTop: 2 }}>Результаты приёмов и рекомендации хранятся в дневнике.</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onDiary} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}>
        <Text style={{ ...t.typography.label, color: h.blue }}>Открыть ›</Text>
      </Pressable>
    </View>
  );
}

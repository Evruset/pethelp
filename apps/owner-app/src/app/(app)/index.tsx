import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
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

import { useAuthJourney } from '@/auth/AuthJourneyProvider';
import { BookingReviewScreen } from '@/booking/BookingReviewScreen';
import { OwnerBookingsScreen } from '@/bookings/OwnerBookingsScreen';
import { AvailabilityScreen } from '@/clinics/AvailabilityScreen';
import type { AvailabilityHandoff } from '@/clinics/availability-api';
import { ClinicCatalogScreen } from '@/clinics/ClinicCatalogScreen';
import type { ClinicCatalogHandoff } from '@/clinics/clinic-catalog-api';
import { ClinicServiceScreen } from '@/clinics/ClinicServiceScreen';
import type { ClinicServiceHandoff } from '@/clinics/clinic-service-api';
import {
  ownerIntentCatalogMode,
  ownerIntentPetPurpose,
  ownerIntentRequiresPet,
  type OwnerHomeIntent,
} from '@/home/owner-home-intent';
import { ownerHomeApi, ownerHomeQueryKey, type OwnerHomeActionCode, type OwnerHomeActiveCare, type OwnerHomeNextAction, type OwnerHomePet, type OwnerHomeSnapshot } from '@/home/owner-home-api';
import { PetDiaryScreen } from '@/pets/PetDiaryScreen';
import { OwnerPetsScreen } from '@/pets/OwnerPetsScreen';
import { usePetJourney } from '@/pets/PetJourneyProvider';
import { PetJourneyScreen } from '@/pets/PetJourneyScreen';
import type { Pet } from '@/pets/pet-api';
import { useSession } from '@/session/SessionProvider';
import { Button, OwnerAppFrame, StatusBadge } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { v50ReferenceAssets } from '@/ui/v50-reference-assets';

const h = t.ownerHome;
const speciesLabel = (species: Pet['species'] | OwnerHomePet['species']) =>
  species === 'DOG' ? 'Собака' : species === 'CAT' ? 'Кошка' : 'Питомец';

export default function AuthenticatedHomeScreen() {
  const { session } = useSession();
  return <AuthorityScopedHome key={`${session?.cacheScope}:${session?.opaqueCredential}`} />;
}

function AuthorityScopedHome() {
  const [authorityGeneration] = useState(() => `${Date.now()}-${Math.random()}`);
  const [intent, setIntent] = useState<OwnerHomeIntent | null>(null);
  const [openedClinic, setOpenedClinic] = useState<ClinicCatalogHandoff | null>(null);
  const [selectedService, setSelectedService] = useState<ClinicServiceHandoff | null>(null);
  const [selectedAvailability, setSelectedAvailability] = useState<AvailabilityHandoff | null>(null);
  const [lastClinic, setLastClinic] = useState<ClinicCatalogHandoff | null>(null);
  const [lastService, setLastService] = useState<ClinicServiceHandoff | null>(null);
  const [lastAvailability, setLastAvailability] = useState<AvailabilityHandoff | null>(null);
  const [globalArea, setGlobalArea] = useState<'HOME' | 'PETS' | 'BOOKINGS'>('HOME');
  const [globalDiaryPet, setGlobalDiaryPet] = useState<Pet | null>(null);
  const { error, logout, session } = useSession();
  const { resumedIntent, consumeResumedIntent } = useAuthJourney();
  const pets = usePetJourney();
  const homeQuery = useQuery({
    queryKey: ownerHomeQueryKey(session?.cacheScope ?? 'no-session', pets.selectedPetId),
    enabled: session !== null,
    queryFn: ({ signal }) => ownerHomeApi.read(session!.opaqueCredential, pets.selectedPetId, signal),
  });

  const clearDownstream = () => {
    setOpenedClinic(null);
    setSelectedService(null);
    setSelectedAvailability(null);
    setLastClinic(null);
    setLastService(null);
    setLastAvailability(null);
  };

  const startIntent = (next: OwnerHomeIntent) => {
    clearDownstream();
    setIntent(next);
    if (ownerIntentRequiresPet(next)) pets.start();
    else pets.cancel();
  };

  const closeJourney = () => {
    pets.cancel();
    clearDownstream();
    setIntent(null);
  };

  const openHome = () => { closeJourney(); setGlobalDiaryPet(null); setGlobalArea('HOME'); };
  const openPets = () => { closeJourney(); setGlobalDiaryPet(null); setGlobalArea('PETS'); };
  const openBookings = () => { closeJourney(); setGlobalDiaryPet(null); setGlobalArea('BOOKINGS'); };
  const openClinics = () => { setGlobalArea('HOME'); setGlobalDiaryPet(null); startIntent('CLINICS'); };
  const openHomeAction = (actionCode: OwnerHomeActionCode) => {
    if (actionCode === 'OPEN_CATALOG') startIntent('CLINICS');
    if (actionCode === 'ADD_PET') startIntent('BOOKING');
  };

  if (globalDiaryPet) return <PetDiaryScreen petId={globalDiaryPet.petId} petName={globalDiaryPet.name} onBack={() => setGlobalDiaryPet(null)} onSwitchPet={() => setGlobalDiaryPet(null)} />;

  if (globalArea === 'PETS' && !intent) return <OwnerPetsScreen pets={pets.pets} loading={pets.loading} error={pets.error} onHome={openHome} onClinics={openClinics} onBookings={openBookings} onRetry={pets.retry} onDiary={setGlobalDiaryPet} />;
  if (globalArea === 'BOOKINGS' && !intent) return <OwnerBookingsScreen onHome={openHome} onClinics={openClinics} onPets={openPets} />;

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
          onHome={openHome}
        />
      );
    }
    if (pets.active) {
      return <PetJourneyScreen purpose="booking" onCancel={() => setSelectedAvailability(null)} />;
    }
  }

  if (selectedService) {
    return (
      <AvailabilityScreen
        key={`${authorityGeneration}:${selectedService.clinicId}:${selectedService.locationId}:${selectedService.serviceId}`}
        authorityGeneration={authorityGeneration}
        context={selectedService}
        initialSelection={lastAvailability}
        petName={pets.pets.find((pet) => pet.petId === pets.continuedPetId)?.name}
        onBack={() => setSelectedService(null)}
        onContinue={(availability) => {
          setSelectedAvailability(availability);
          setLastAvailability(availability);
          if (!pets.continuedPetId) {
            setIntent('BOOKING');
            pets.start();
          }
        }}
      />
    );
  }

  if (openedClinic) {
    return (
      <ClinicServiceScreen
        key={`${session?.opaqueCredential}:${openedClinic.clinicId}:${openedClinic.locationId}`}
        clinic={openedClinic}
        initialServiceId={lastService?.serviceId}
        petName={pets.pets.find((pet) => pet.petId === pets.continuedPetId)?.name}
        onBack={() => setOpenedClinic(null)}
        onContinue={(service) => {
          if (lastService?.serviceId !== service.serviceId) setLastAvailability(null);
          setSelectedService(service);
          setLastService(service);
        }}
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
        onHome={openHome}
        onBookings={openBookings}
        onPets={openPets}
        initialSelectedLocationId={lastClinic?.locationId}
        onOpenClinic={(clinic) => {
          if (lastClinic?.locationId !== clinic.locationId) {
            setLastService(null);
            setLastAvailability(null);
          }
          setOpenedClinic(clinic);
          setLastClinic(clinic);
        }}
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
      onBookings={openBookings}
      onPets={openPets}
      onFindTime={() => startIntent('TIME')}
      onDiary={() => startIntent('DIARY')}
      onLogout={() => {
        void logout();
      }}
      resumed={resumedIntent?.kind === 'START_BOOKING'}
      onResume={resumeBooking}
      cleanupError={error === 'SESSION_CLEANUP_FAILED'}
      snapshot={homeQuery.data}
      homeLoading={homeQuery.isPending}
      homeError={homeQuery.isError}
      onRetryHome={() => { void homeQuery.refetch(); }}
      onHomeAction={openHomeAction}
    />
  );
}

type HomeProps = {
  onBook(): void;
  onClinics(): void;
  onBookings?(): void;
  onPets(): void;
  onFindTime(): void;
  onDiary(): void;
  onLogout(): void;
  resumed?: boolean;
  onResume?(): void;
  cleanupError?: boolean;
  snapshot?: OwnerHomeSnapshot;
  homeLoading?: boolean;
  homeError?: boolean;
  onRetryHome?(): void;
  onHomeAction?(actionCode: OwnerHomeActionCode): void;
};

export function OwnerHome({
  onBook,
  onClinics,
  onBookings = () => {},
  onPets,
  onFindTime,
  onDiary,
  onLogout,
  resumed = false,
  onResume,
  cleanupError = false,
  snapshot,
  homeLoading = false,
  homeError = false,
  onRetryHome,
  onHomeAction,
}: HomeProps) {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  const currentPet = snapshot?.selectedPet ?? null;
  const petName = currentPet?.name;
  const petCount = snapshot?.pets.length ?? 0;
  const nav = [
    ['Главная', '⌂', undefined, true],
    ['Клиники', '▥', onClinics, false],
    ['Записи', '◫', onBookings, false],
    ['Питомцы', '●', onPets, false],
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
                loading={homeLoading}
                error={homeError && !snapshot}
                onDiary={onDiary}
                onRetry={onRetryHome}
                desktop={desktop}
              />
            </View>
            <View style={{ flex: desktop ? 0.95 : undefined }}>
              <NextAction
                desktop={desktop}
                action={snapshot?.nextAction}
                activeCare={snapshot?.activeCare}
                loading={homeLoading}
                refreshFailed={homeError && Boolean(snapshot)}
                hardError={homeError && !snapshot}
                onRetry={onRetryHome}
                onAction={onHomeAction}
              />
            </View>
          </View>

          <CoreServices
            desktop={desktop}
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
  muted: { ...t.typography.secondaryBody, color: t.color.textSecondary },
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
          <Text style={{ ...t.typography.caption, color: t.color.textSecondary }}>Питомцы</Text>
          <Text style={{ ...t.typography.label, color: h.ink }}>{petCount}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onLogout} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={{ ...t.typography.label, color: t.color.textSecondary }}>Выйти</Text>
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
        <Text style={{ ...t.typography.caption, color: t.color.textSecondary }}>Выйти</Text>
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
      <Text style={{ fontSize: compact ? 18 : 16, color: active ? h.bluePressed : t.color.textSecondary }}>{icon}</Text>
      <Text style={{ ...t.typography.caption, fontSize: compact ? 10 : 13, color: active ? h.bluePressed : t.color.textSecondary, fontWeight: active ? '700' : '600' }}>
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
        {!desktop ? <Text style={{ ...t.typography.caption, color: h.bluePressed, fontWeight: '700' }}>● Личный кабинет владельца</Text> : null}
        <Text accessibilityRole="header" style={{ fontSize: desktop ? 36 : 29, lineHeight: desktop ? 41 : 34, fontWeight: '800', color: h.ink }}>
          Здравствуйте!
        </Text>
        <Text style={{ ...t.typography.secondaryBody, color: t.color.textSecondary }}>
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
          <Text style={{ ...t.typography.secondaryBody, color: t.color.textSecondary }}>
            Каждый путь ведёт к своему следующему шагу — без возврата в один и тот же старый экран.
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
            accessibilityLabel="Владелец с питомцем в ветеринарной клинике"
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
        <Text style={{ fontSize: 20, color: h.bluePressed }}>{icon}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ ...t.typography.label, color: h.ink }}>{title}</Text>
        <Text style={{ ...t.typography.caption, color: t.color.textSecondary, marginTop: 2 }}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

function ImmediateValue({ petName, desktop, onClinics }: { petName?: string; desktop: boolean; onClinics(): void }) {
  const facts = [
    ['Клиники', 'адреса и услуги'],
    ['Стоимость', 'после выбора услуги'],
    ['Время', 'только опубликованные слоты'],
  ] as const;
  return (
    <Surface style={{ padding: desktop ? 16 : 14, flexDirection: desktop ? 'row' : 'column', alignItems: desktop ? 'center' : 'stretch', gap: desktop ? 14 : 12, backgroundColor: 'rgba(255,255,255,.82)' }}>
      <View style={{ flex: 1.2, gap: 3 }}>
        <Text style={{ ...t.typography.caption, color: h.bluePressed, fontWeight: '800', textTransform: 'uppercase' }}>Польза сразу</Text>
        <Text style={{ ...t.typography.sectionTitle, color: h.ink }}>Сравните варианты{petName ? ` для ${petName}` : ''} без звонка</Text>
        <Text style={{ ...t.typography.caption, color: t.color.textSecondary }}>Показываем только то, что есть в текущих данных.</Text>
      </View>
      <View accessibilityLabel="Возможности записи" style={{ flex: 1.15, flexDirection: 'row', gap: 7 }}>
        {facts.map(([value, label]) => (
          <View key={value} style={{ flex: 1, minHeight: 58, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 12, backgroundColor: h.blueSoft, justifyContent: 'center' }}>
            <Text style={{ ...t.typography.label, fontSize: desktop ? 13 : 12, color: h.ink }}>{value}</Text>
            <Text style={{ ...t.typography.caption, fontSize: 10, color: t.color.textSecondary, marginTop: 2 }}>{label}</Text>
          </View>
        ))}
      </View>
      <HomeButton label="Открыть каталог" secondary onPress={onClinics} />
    </Surface>
  );
}

function PetHero({ pet, petCount, loading, error, onDiary, onRetry, desktop }: { pet: OwnerHomePet | null; petCount: number; loading: boolean; error: boolean; onDiary(): void; onRetry?(): void; desktop: boolean }) {
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
            {pet.photoUrl ? <Image accessibilityLabel={`Фото питомца ${pet.name}`} source={{ uri: pet.photoUrl }} resizeMode="cover" style={{ width: 64, height: 64, borderRadius: 22 }} /> : (
              <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: '#FFF1E2', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: '#9A622F' }}>{pet.name.slice(0, 1).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ ...t.typography.caption, color: '#A4662E', fontWeight: '800', textTransform: 'uppercase' }}>Мой питомец</Text>
              <Text style={{ fontSize: desktop ? 30 : 27, lineHeight: 35, fontWeight: '800', color: h.ink }}>{pet.name}</Text>
              <Text style={styles.muted}>{[speciesLabel(pet.species), pet.breed].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          <Text style={{ ...t.typography.caption, color: t.color.textSecondary }}>Все записи и результаты собраны в профиле питомца.</Text>
          <View style={{ marginTop: 'auto', gap: 8 }}>
            <HomeButton label="Открыть дневник" secondary onPress={onDiary} />
          </View>
        </>
      ) : (
        <View style={{ flex: 1, gap: 10 }}>
          <Text style={{ ...t.typography.caption, color: h.bluePressed, fontWeight: '800', textTransform: 'uppercase' }}>Питомцы</Text>
          <View style={{ width: 84, height: 84, borderRadius: 28, backgroundColor: '#FFF1E2', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 34, color: '#A4662E', fontWeight: '800' }}>{petCount > 1 ? petCount : '＋'}</Text>
          </View>
          <Text style={{ fontSize: 28, lineHeight: 34, fontWeight: '800', color: h.ink }}>{petCount > 1 ? 'Выберите питомца' : 'Добавьте питомца'}</Text>
          <Text style={styles.muted}>{petCount > 1 ? 'Укажите, для кого открыть запись или дневник.' : 'Профиль нужен для записи и истории здоровья.'}</Text>
          <Text style={{ ...t.typography.caption, color: h.bluePressed, fontWeight: '700', marginTop: 'auto' }}>
            Для новой записи используйте основную кнопку «Записаться».
          </Text>
        </View>
      )}
    </Surface>
  );
}

function NextAction({ desktop, action, activeCare, loading, refreshFailed, hardError, onRetry, onAction }: {
  desktop: boolean; action?: OwnerHomeNextAction; activeCare?: OwnerHomeActiveCare | null; loading: boolean; refreshFailed: boolean; hardError: boolean;
  onRetry?(): void; onAction?(actionCode: OwnerHomeActionCode): void;
}) {
  const supported = action?.actionCode === 'OPEN_CATALOG' || action?.actionCode === 'ADD_PET';
  const actionLabel = action?.actionCode === 'ADD_PET' ? 'Добавить питомца' : 'Открыть каталог';
  const relevantAt = activeCare?.startsAt ?? action?.deadlineAt;
  return (
    <Surface style={{ minHeight: 276, padding: 0, overflow: 'hidden', backgroundColor: h.blueSoft, borderColor: '#AFCBFA' }}>
      <Image
        accessibilityLabel="Осмотр питомца в клинике"
        source={v50ReferenceAssets.clinicExam}
        resizeMode="cover"
        style={{ width: '100%', height: desktop ? 132 : 116 }}
      />
      <View style={{ padding: 16, gap: 8, flex: 1 }}>
        <Text style={{ ...t.typography.caption, color: h.bluePressed, fontWeight: '800', textTransform: 'uppercase' }}>{activeCare ? 'Активная забота' : 'Следующий шаг'}</Text>
        {loading && !action ? <Text style={styles.muted}>Загружаем следующий шаг…</Text> : null}
        {hardError ? (
          <>
            <Text style={{ fontSize: 24, lineHeight: 30, fontWeight: '800', color: h.ink }}>Не удалось загрузить следующий шаг</Text>
            <Text style={styles.muted}>Проверьте соединение и повторите попытку.</Text>
            {onRetry ? <Button label="Повторить" variant="secondary" onPress={onRetry} /> : null}
          </>
        ) : action ? (
          <>
            <StatusBadge label={priorityLabel(action.priority)} tone={action.priority === 'CRITICAL' ? 'critical' : action.priority === 'HIGH' ? 'warning' : 'info'} />
            <Text style={{ fontSize: 24, lineHeight: 30, fontWeight: '800', color: h.ink }}>{action.title}</Text>
            <Text style={styles.muted}>{action.description}</Text>
            {activeCare?.clinicName ? <Text style={{ ...t.typography.label, color: h.ink }}>{activeCare.clinicName}</Text> : null}
            {relevantAt ? <Text style={{ ...t.typography.caption, color: t.color.textSecondary }}>{formatHomeDate(relevantAt)}</Text> : null}
            {refreshFailed ? (
              <View accessibilityRole="alert" style={{ gap: 6 }}>
                <Text style={{ ...t.typography.caption, color: t.color.critical }}>Не удалось обновить данные. Показана последняя сохранённая информация.</Text>
                {onRetry ? <Button label="Повторить обновление" variant="secondary" onPress={onRetry} /> : null}
              </View>
            ) : null}
            {supported && onAction ? <HomeButton label={actionLabel} secondary onPress={() => onAction(action.actionCode)} /> : null}
          </>
        ) : null}
      </View>
    </Surface>
  );
}

function formatHomeDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function priorityLabel(priority: OwnerHomeNextAction['priority']) {
  return priority === 'CRITICAL' ? 'Срочно' : priority === 'HIGH' ? 'Требует внимания' : priority === 'NORMAL' ? 'Важно' : 'Плановый шаг';
}

function CoreServices({ desktop, onClinics, onFindTime, onDiary }: { desktop: boolean; onClinics(): void; onFindTime(): void; onDiary(): void }) {
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={styles.sectionTitle}>Сервисы</Text>
        <Text style={{ ...t.typography.caption, color: t.color.textSecondary }}>Каждый — свой маршрут</Text>
      </View>
      <View style={{ flexDirection: desktop ? 'row' : 'column', gap: 10 }}>
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
        <Text style={{ fontSize: 19, color: h.bluePressed }}>{icon}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={{ ...t.typography.caption, color: t.color.textSecondary }}>{subtitle}</Text>
    </Pressable>
  );
}

function CareHistory({ petName, onDiary }: { petName?: string; onDiary(): void }) {
  return (
    <View style={{ paddingHorizontal: 4, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: h.border }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: h.blueSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 21, color: h.bluePressed }}>▤</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>История заботы{petName ? ` о ${petName}` : ''}</Text>
        <Text style={{ ...t.typography.caption, color: t.color.textSecondary, marginTop: 2 }}>Результаты приёмов и рекомендации хранятся в дневнике.</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onDiary} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}>
        <Text style={{ ...t.typography.label, color: h.bluePressed }}>Открыть ›</Text>
      </Pressable>
    </View>
  );
}

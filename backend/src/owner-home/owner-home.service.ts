import { BadRequestException, Injectable } from '@nestjs/common';
import type { JwtPayload } from '../auth/auth.types';
import type { OwnerAppointmentSummary } from '../auth/owner-appointments.service';
import { OwnerAppointmentsService } from '../auth/owner-appointments.service';
import type { OwnerPet } from '../auth/owner-pet.service';
import { OwnerPetService } from '../auth/owner-pet.service';
import type { OwnerTelemedSessionSummary } from '../modules/telemed/telemed-owner-session.service';
import { TelemedOwnerSessionService } from '../modules/telemed/telemed-owner-session.service';

export type OwnerHomeSelectionSource = 'REQUESTED' | 'DEFAULT' | 'NONE';
export type OwnerHomeActionCode =
  | 'OPEN_EMERGENCY'
  | 'OPEN_ALTERNATIVE_SLOT'
  | 'OPEN_TELEMED'
  | 'OPEN_APPOINTMENT'
  | 'OPEN_CATALOG'
  | 'ADD_PET'
  | 'NONE';
export type OwnerHomePriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
export type OwnerHomeSourceType = 'TELEMED_SESSION' | 'BOOKING_HOLD' | 'PET' | 'NONE';

export interface OwnerHomePetProjection {
  id: string;
  name: string;
  species: OwnerPet['species'];
  breed: string | null;
  photoUrl: string | null;
}

export interface OwnerHomeNextAction {
  type:
    | 'EMERGENCY_GUIDANCE_REQUIRED'
    | 'ALTERNATIVE_SLOT_RESPONSE'
    | 'TELEMED_DOCTOR_LATE'
    | 'TELEMED_WAITING'
    | 'BOOKING_REQUIRES_ACTION'
    | 'UPCOMING_CONFIRMED_VISIT'
    | 'START_PLANNED_CARE'
    | 'NONE';
  priority: OwnerHomePriority;
  sourceType: OwnerHomeSourceType;
  sourceId: string | null;
  title: string;
  description: string;
  deadlineAt: string | null;
  actionCode: OwnerHomeActionCode;
}

export interface OwnerHomeActiveCare {
  sourceType: 'TELEMED_SESSION' | 'BOOKING_HOLD';
  sourceId: string;
  statusCode: string;
  title: string;
  description: string;
  startsAt: string | null;
  deadlineAt: string | null;
  clinicName: string | null;
  petId: string;
  actionCode: Exclude<OwnerHomeActionCode, 'OPEN_CATALOG' | 'ADD_PET'>;
}

export interface OwnerHomeResponse {
  schemaVersion: 1;
  serverNow: string;
  pets: OwnerHomePetProjection[];
  selectedPet: OwnerHomePetProjection | null;
  selectionSource: OwnerHomeSelectionSource;
  nextAction: OwnerHomeNextAction;
  activeCare: OwnerHomeActiveCare | null;
}

type RankedAction = {
  rank: number;
  action: OwnerHomeNextAction;
  activeCare: OwnerHomeActiveCare | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOOKING_REQUIRES_ACTION = new Set([
  'MANUAL_CONFIRM_PENDING',
  'MIS_RESERVATION_PENDING',
  'MIS_RECONCILIATION_PENDING',
  'MIS_HELD',
  'CANCELLATION_REQUESTED',
  'RESCHEDULE_REQUESTED',
]);

@Injectable()
export class OwnerHomeService {
  constructor(
    private readonly petsService: OwnerPetService,
    private readonly appointmentsService: OwnerAppointmentsService,
    private readonly telemedService: TelemedOwnerSessionService,
  ) {}

  async read(owner: JwtPayload, requestedPetId?: string): Promise<OwnerHomeResponse> {
    if (requestedPetId !== undefined && !UUID_PATTERN.test(requestedPetId)) {
      throw new BadRequestException({ code: 'INVALID_SELECTED_PET_ID', message: 'selectedPetId must be a UUID.' });
    }

    const serverNow = new Date();
    const ownedPets = await this.petsService.list(owner);
    const sortedPets = [...ownedPets].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    );
    const pets = sortedPets.map(projectPet);
    const requestedPet = requestedPetId ? sortedPets.find((pet) => pet.id === requestedPetId) : undefined;
    const selected = requestedPet ?? sortedPets[0];
    const selectionSource: OwnerHomeSelectionSource = requestedPet
      ? 'REQUESTED'
      : selected
        ? 'DEFAULT'
        : 'NONE';

    if (!selected) {
      return {
        schemaVersion: 1,
        serverNow: serverNow.toISOString(),
        pets,
        selectedPet: null,
        selectionSource,
        nextAction: {
          type: 'NONE',
          priority: 'LOW',
          sourceType: 'NONE',
          sourceId: null,
          title: 'Добавьте питомца',
          description: 'Создайте профиль питомца, чтобы начать планировать помощь.',
          deadlineAt: null,
          actionCode: 'ADD_PET',
        },
        activeCare: null,
      };
    }

    const [allAppointments, allTelemed] = await Promise.all([
      this.appointmentsService.list(owner),
      this.telemedService.list(owner.sub),
    ]);
    const appointments = allAppointments.filter((item) => item.pet.id === selected.id);
    const telemed = allTelemed.filter((item) => item.pet.id === selected.id);
    const ranked = [
      ...telemed.flatMap((item) => rankTelemed(item, serverNow)),
      ...appointments.flatMap(rankAppointment),
    ].sort(compareRanked)[0];

    return {
      schemaVersion: 1,
      serverNow: serverNow.toISOString(),
      pets,
      selectedPet: projectPet(selected),
      selectionSource,
      nextAction: ranked?.action ?? plannedCare(selected.id),
      activeCare: ranked?.activeCare ?? null,
    };
  }
}

function projectPet(pet: OwnerPet): OwnerHomePetProjection {
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    photoUrl: pet.photoUrl,
  };
}

function rankTelemed(item: OwnerTelemedSessionSummary, serverNow: Date): RankedAction[] {
  if (item.bucket !== 'ACTIVE') return [];
  const baseCare = {
    sourceType: 'TELEMED_SESSION' as const,
    sourceId: item.sessionId,
    title: item.service.name ?? 'Онлайн-консультация',
    description: 'Онлайн-помощь активна.',
    startsAt: item.startsAt,
    deadlineAt: item.doctorJoinDeadlineAt,
    clinicName: item.clinic.name,
    petId: item.pet.id,
    actionCode: 'OPEN_TELEMED' as const,
  };
  if (item.safetyEscalation === true) {
    return [{
      rank: 10,
      action: action('EMERGENCY_GUIDANCE_REQUIRED', 'CRITICAL', 'TELEMED_SESSION', item.sessionId,
        'Нужна срочная помощь', 'Следуйте безопасному экстренному маршруту VetHelp.', item.doctorJoinDeadlineAt, 'OPEN_EMERGENCY'),
      activeCare: item.bucket === 'ACTIVE'
        ? { ...baseCare, statusCode: 'SAFETY_ESCALATION', actionCode: 'OPEN_EMERGENCY' }
        : null,
    }];
  }
  if (item.state === 'WAITING_FOR_DOCTOR' && new Date(item.doctorJoinDeadlineAt) < serverNow) {
    return [{
      rank: 30,
      action: action('TELEMED_DOCTOR_LATE', 'HIGH', 'TELEMED_SESSION', item.sessionId,
        'Врач задерживается', 'Откройте консультацию, чтобы увидеть актуальный статус.', item.doctorJoinDeadlineAt, 'OPEN_TELEMED'),
      activeCare: { ...baseCare, statusCode: 'DOCTOR_LATE' },
    }];
  }
  if (item.state === 'WAITING_FOR_DOCTOR') {
    return [{
      rank: 31,
      action: action('TELEMED_WAITING', 'NORMAL', 'TELEMED_SESSION', item.sessionId,
        'Ожидаем врача', 'Откройте комнату консультации и оставайтесь на связи.', item.doctorJoinDeadlineAt, 'OPEN_TELEMED'),
      activeCare: { ...baseCare, statusCode: 'WAITING_FOR_DOCTOR' },
    }];
  }
  if (item.state === 'CONNECTED') {
    return [{
      rank: 32,
      action: action('TELEMED_WAITING', 'HIGH', 'TELEMED_SESSION', item.sessionId,
        'Консультация идёт', 'Вернитесь в комнату консультации.', item.endsAt, 'OPEN_TELEMED'),
      activeCare: { ...baseCare, statusCode: 'CONNECTED' },
    }];
  }
  return [];
}

function rankAppointment(item: OwnerAppointmentSummary): RankedAction[] {
  if (item.bucket !== 'ACTIVE') return [];
  const baseCare = {
    sourceType: 'BOOKING_HOLD' as const,
    sourceId: item.holdId,
    title: item.clinic.name,
    description: item.presentation.description,
    startsAt: item.startsAt,
    deadlineAt: item.startsAt,
    clinicName: item.clinic.name,
    petId: item.pet.id,
    actionCode: 'OPEN_APPOINTMENT' as const,
  };
  if (item.state === 'ALTERNATIVE_PENDING') {
    return [{
      rank: 20,
      action: action('ALTERNATIVE_SLOT_RESPONSE', 'HIGH', 'BOOKING_HOLD', item.holdId,
        'Клиника предложила другое время', 'Проверьте предложенный слот и ответьте клинике.', item.startsAt, 'OPEN_ALTERNATIVE_SLOT'),
      activeCare: { ...baseCare, statusCode: 'ALTERNATIVE_PROPOSED', actionCode: 'OPEN_ALTERNATIVE_SLOT' },
    }];
  }
  if (BOOKING_REQUIRES_ACTION.has(item.state)) {
    return [{
      rank: 40,
      action: action('BOOKING_REQUIRES_ACTION', 'NORMAL', 'BOOKING_HOLD', item.holdId,
        'Запись требует внимания', item.presentation.description, item.startsAt, 'OPEN_APPOINTMENT'),
      activeCare: { ...baseCare, statusCode: 'OWNER_ACTION_REQUIRED' },
    }];
  }
  if (item.state === 'CONFIRMED') {
    return [{
      rank: 50,
      action: action('UPCOMING_CONFIRMED_VISIT', 'LOW', 'BOOKING_HOLD', item.holdId,
        'Ближайший визит подтверждён', `${item.clinic.name}: ${item.startsAt}`, item.startsAt, 'OPEN_APPOINTMENT'),
      activeCare: { ...baseCare, statusCode: 'CONFIRMED' },
    }];
  }
  return [];
}

function action(
  type: OwnerHomeNextAction['type'],
  priority: OwnerHomePriority,
  sourceType: OwnerHomeSourceType,
  sourceId: string,
  title: string,
  description: string,
  deadlineAt: string,
  actionCode: OwnerHomeActionCode,
): OwnerHomeNextAction {
  return { type, priority, sourceType, sourceId, title, description, deadlineAt, actionCode };
}

function plannedCare(petId: string): OwnerHomeNextAction {
  return {
    type: 'START_PLANNED_CARE',
    priority: 'LOW',
    sourceType: 'PET',
    sourceId: petId,
    title: 'Спланируйте заботу о питомце',
    description: 'Выберите клинику или услугу в каталоге VetHelp.',
    deadlineAt: null,
    actionCode: 'OPEN_CATALOG',
  };
}

function compareRanked(left: RankedAction, right: RankedAction): number {
  return left.rank - right.rank
    || (left.action.deadlineAt ?? '').localeCompare(right.action.deadlineAt ?? '')
    || (left.action.sourceId ?? '').localeCompare(right.action.sourceId ?? '');
}

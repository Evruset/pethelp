import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';

export enum WorkspaceSectionKind {
  QUEUE = 'QUEUE',
  SCHEDULE = 'SCHEDULE',
  APPOINTMENTS = 'APPOINTMENTS',
  VETERINARIAN = 'VETERINARIAN',
  QUALITY = 'QUALITY',
}

export enum WorkspaceAvailability {
  AVAILABLE = 'AVAILABLE',
  NOT_AUTHORIZED = 'NOT_AUTHORIZED',
  NOT_CONFIGURED = 'NOT_CONFIGURED',
  TEMPORARILY_UNAVAILABLE = 'TEMPORARILY_UNAVAILABLE',
}

export enum WorkspaceFreshnessState { FRESH = 'FRESH' }
export enum QueueOldestWaitAgeBucket { NONE = 'NONE', LT_5_MIN = 'LT_5_MIN', FIVE_TO_10_MIN = '5_TO_10_MIN', TEN_TO_30_MIN = '10_TO_30_MIN', GT_30_MIN = 'GT_30_MIN' }
export enum QueueSlaRisk { NONE = 'NONE', DUE_SOON = 'DUE_SOON', OVERDUE = 'OVERDUE', UNKNOWN = 'UNKNOWN' }
export enum WorkspaceActionRoute { QUEUE = 'queue', APPOINTMENTS = 'appointments' }
export enum WorkspaceActionLabelKey { OPEN_QUEUE = 'WORKSPACE_OPEN_QUEUE', OPEN_APPOINTMENTS = 'WORKSPACE_OPEN_APPOINTMENTS' }

export class WorkspaceFreshnessDto {
  @ApiProperty({ enum: WorkspaceFreshnessState }) state!: WorkspaceFreshnessState;
  @ApiProperty({ enum: [30] }) maxAgeSeconds!: 30;
}

export class QueueWorkspaceFactsDto {
  @ApiProperty({ minimum: 0, maximum: 999 }) waitingCount!: number;
  @ApiProperty({ minimum: 0, maximum: 999 }) requiresActionCount!: number;
  @ApiProperty({ enum: QueueOldestWaitAgeBucket }) oldestWaitAgeBucket!: QueueOldestWaitAgeBucket;
  @ApiProperty({ enum: QueueSlaRisk }) slaRisk!: QueueSlaRisk;
}

export class AppointmentsWorkspaceFactsDto {
  @ApiProperty({ minimum: 0, maximum: 999 }) todayCount!: number;
  @ApiProperty({ minimum: 0, maximum: 999 }) requiresActionCount!: number;
  @ApiProperty({ type: String, format: 'date-time', nullable: true }) nextScheduledAt!: string | null;
}

export class WorkspaceActionDto {
  @ApiProperty({ enum: WorkspaceActionRoute }) route!: WorkspaceActionRoute;
  @ApiProperty({ enum: WorkspaceActionLabelKey }) labelKey!: WorkspaceActionLabelKey;
}

export class QueueAvailableSectionDto {
  @ApiProperty({ enum: [WorkspaceSectionKind.QUEUE] }) kind!: WorkspaceSectionKind.QUEUE;
  @ApiProperty({ enum: [WorkspaceAvailability.AVAILABLE] }) availability!: WorkspaceAvailability.AVAILABLE;
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty({ type: QueueWorkspaceFactsDto }) facts!: QueueWorkspaceFactsDto;
  @ApiProperty({ type: WorkspaceActionDto }) action!: WorkspaceActionDto;
}

export class AppointmentsAvailableSectionDto {
  @ApiProperty({ enum: [WorkspaceSectionKind.APPOINTMENTS] }) kind!: WorkspaceSectionKind.APPOINTMENTS;
  @ApiProperty({ enum: [WorkspaceAvailability.AVAILABLE] }) availability!: WorkspaceAvailability.AVAILABLE;
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty({ type: AppointmentsWorkspaceFactsDto }) facts!: AppointmentsWorkspaceFactsDto;
  @ApiProperty({ type: WorkspaceActionDto }) action!: WorkspaceActionDto;
}

export class WorkspaceUnavailableSectionDto {
  @ApiProperty({ enum: WorkspaceSectionKind }) kind!: WorkspaceSectionKind;
  @ApiProperty({ enum: [WorkspaceAvailability.NOT_AUTHORIZED, WorkspaceAvailability.NOT_CONFIGURED, WorkspaceAvailability.TEMPORARILY_UNAVAILABLE] })
  availability!: WorkspaceAvailability.NOT_AUTHORIZED | WorkspaceAvailability.NOT_CONFIGURED | WorkspaceAvailability.TEMPORARILY_UNAVAILABLE;
  @ApiProperty({ format: 'date-time', description: 'Common database snapshot time; never a domain-source timestamp.' }) generatedAt!: string;
}

export class QueueUnavailableSectionDto extends WorkspaceUnavailableSectionDto {
  @ApiProperty({ enum: [WorkspaceSectionKind.QUEUE] }) declare kind: WorkspaceSectionKind.QUEUE;
  @ApiProperty({ enum: [WorkspaceAvailability.NOT_AUTHORIZED, WorkspaceAvailability.TEMPORARILY_UNAVAILABLE] })
  declare availability: WorkspaceAvailability.NOT_AUTHORIZED | WorkspaceAvailability.TEMPORARILY_UNAVAILABLE;
}
export class ScheduleUnavailableSectionDto extends WorkspaceUnavailableSectionDto {
  @ApiProperty({ enum: [WorkspaceSectionKind.SCHEDULE] }) declare kind: WorkspaceSectionKind.SCHEDULE;
  @ApiProperty({ enum: [WorkspaceAvailability.NOT_AUTHORIZED, WorkspaceAvailability.NOT_CONFIGURED] })
  declare availability: WorkspaceAvailability.NOT_AUTHORIZED | WorkspaceAvailability.NOT_CONFIGURED;
}
export class AppointmentsUnavailableSectionDto extends WorkspaceUnavailableSectionDto {
  @ApiProperty({ enum: [WorkspaceSectionKind.APPOINTMENTS] }) declare kind: WorkspaceSectionKind.APPOINTMENTS;
  @ApiProperty({ enum: [WorkspaceAvailability.NOT_AUTHORIZED, WorkspaceAvailability.TEMPORARILY_UNAVAILABLE] })
  declare availability: WorkspaceAvailability.NOT_AUTHORIZED | WorkspaceAvailability.TEMPORARILY_UNAVAILABLE;
}
export class VeterinarianUnavailableSectionDto extends WorkspaceUnavailableSectionDto {
  @ApiProperty({ enum: [WorkspaceSectionKind.VETERINARIAN] }) declare kind: WorkspaceSectionKind.VETERINARIAN;
  @ApiProperty({ enum: [WorkspaceAvailability.NOT_AUTHORIZED, WorkspaceAvailability.NOT_CONFIGURED] })
  declare availability: WorkspaceAvailability.NOT_AUTHORIZED | WorkspaceAvailability.NOT_CONFIGURED;
}
export class QualityUnavailableSectionDto extends WorkspaceUnavailableSectionDto {
  @ApiProperty({ enum: [WorkspaceSectionKind.QUALITY] }) declare kind: WorkspaceSectionKind.QUALITY;
  @ApiProperty({ enum: [WorkspaceAvailability.NOT_AUTHORIZED, WorkspaceAvailability.NOT_CONFIGURED] })
  declare availability: WorkspaceAvailability.NOT_AUTHORIZED | WorkspaceAvailability.NOT_CONFIGURED;
}

export type QueueWorkspaceSectionDto = QueueAvailableSectionDto | WorkspaceUnavailableSectionDto;
export type ScheduleWorkspaceSectionDto = WorkspaceUnavailableSectionDto;
export type AppointmentsWorkspaceSectionDto = AppointmentsAvailableSectionDto | WorkspaceUnavailableSectionDto;
export type VeterinarianWorkspaceSectionDto = WorkspaceUnavailableSectionDto;
export type QualityWorkspaceSectionDto = WorkspaceUnavailableSectionDto;

@ApiExtraModels(QueueAvailableSectionDto, AppointmentsAvailableSectionDto, QueueUnavailableSectionDto, ScheduleUnavailableSectionDto, AppointmentsUnavailableSectionDto, VeterinarianUnavailableSectionDto, QualityUnavailableSectionDto)
export class ClinicWorkspaceHomeDto {
  @ApiProperty({ format: 'uuid' }) clinicId!: string;
  @ApiProperty({ format: 'uuid' }) locationId!: string;
  @ApiProperty({ format: 'date-time' }) serverNow!: string;
  @ApiProperty({ format: 'date-time' }) generatedAt!: string;
  @ApiProperty({ type: WorkspaceFreshnessDto }) freshness!: WorkspaceFreshnessDto;
  @ApiProperty({
    type: 'array', minItems: 5, maxItems: 5,
    description: 'Canonical order: QUEUE, SCHEDULE, APPOINTMENTS, VETERINARIAN, QUALITY.',
    items: { oneOf: [
      { $ref: getSchemaPath(QueueAvailableSectionDto) },
      { $ref: getSchemaPath(QueueUnavailableSectionDto) },
      { $ref: getSchemaPath(ScheduleUnavailableSectionDto) },
      { $ref: getSchemaPath(AppointmentsAvailableSectionDto) },
      { $ref: getSchemaPath(AppointmentsUnavailableSectionDto) },
      { $ref: getSchemaPath(VeterinarianUnavailableSectionDto) },
      { $ref: getSchemaPath(QualityUnavailableSectionDto) },
    ] },
  })
  sections!: [QueueWorkspaceSectionDto, ScheduleWorkspaceSectionDto, AppointmentsWorkspaceSectionDto, VeterinarianWorkspaceSectionDto, QualityWorkspaceSectionDto];
}

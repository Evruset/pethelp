import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiHeader, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../../auth/auth.types';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { SWAGGER_BEARER_AUTH } from '../../openapi/openapi';
import { UpdateTelemedCaseWorkspaceDto } from './dto/update-telemed-case-workspace.dto';
import { TelemedVetWorkspaceService } from './telemed-vet-workspace.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function idOrThrow(value: string, field = 'id'): string {
  if (!UUID.test(value)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be a UUID.` });
  return value;
}

function parseLimit(value?: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 50;
  return Math.min(parsed, 100);
}

@ApiTags('Telemedicine')
@Controller('v1')
export class TelemedVetWorkspaceController {
  constructor(private readonly workspace: TelemedVetWorkspaceService) {}

  @Get('clinic/:clinicId/locations/:locationId/telemed/vet-queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Telemedicine vet queue with available/assigned cases and pet context' })
  @ApiOkResponse({ description: 'Available and assigned telemedicine cases for vet workspace.' })
  @ApiUnauthorizedResponse({ description: 'Clinic employee JWT is required.' })
  @ApiForbiddenResponse({ description: 'Clinic/location scope is enforced.' })
  async queue(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Query('limit') limit: string | undefined,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.workspace.queue({
      clinicId: idOrThrow(clinicId, 'clinicId'),
      locationId: idOrThrow(locationId, 'locationId'),
      employee,
      limit: parseLimit(limit),
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/telemed/cases/:caseId/assign')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiHeader({ name: 'Idempotency-Key', required: false, schema: { type: 'string', format: 'uuid' } })
  @ApiOperation({ summary: 'Assign a queued telemedicine case to current clinic employee' })
  async assign(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('caseId') caseId: string,
    @Headers('idempotency-key') _idempotencyKey: string | undefined,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.workspace.assign({
      clinicId: idOrThrow(clinicId, 'clinicId'),
      locationId: idOrThrow(locationId, 'locationId'),
      caseId: idOrThrow(caseId, 'caseId'),
      employee,
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/telemed/cases/:caseId/start-session')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Start backend-owned waiting room session for an assigned telemedicine case' })
  async startSession(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('caseId') caseId: string,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.workspace.startSession({
      clinicId: idOrThrow(clinicId, 'clinicId'),
      locationId: idOrThrow(locationId, 'locationId'),
      caseId: idOrThrow(caseId, 'caseId'),
      employee,
    });
  }

  @Post('clinic/:clinicId/locations/:locationId/telemed/cases/:caseId/sessions/:sessionId/connect')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Doctor connects to a case-based telemedicine room and receives LiveKit token' })
  async connectDoctor(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('caseId') caseId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.workspace.connectDoctor({
      clinicId: idOrThrow(clinicId, 'clinicId'),
      locationId: idOrThrow(locationId, 'locationId'),
      caseId: idOrThrow(caseId, 'caseId'),
      sessionId: idOrThrow(sessionId, 'sessionId'),
      employee,
    });
  }

  @Patch('clinic/:clinicId/locations/:locationId/telemed/cases/:caseId/workspace')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Update safe telemedicine workspace fields: escalation, recommendation, follow-up' })
  async updateWorkspace(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('caseId') caseId: string,
    @Body() dto: UpdateTelemedCaseWorkspaceDto,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.workspace.updateWorkspace({
      clinicId: idOrThrow(clinicId, 'clinicId'),
      locationId: idOrThrow(locationId, 'locationId'),
      caseId: idOrThrow(caseId, 'caseId'),
      employee,
      dto,
    });
  }

  @Get('clinic/:clinicId/locations/:locationId/telemed/cases/:caseId/audit-trail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLINIC_RECEPTIONIST, Role.CLINIC_ADMIN)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Telemedicine case audit trail for vet workspace' })
  async auditTrail(
    @Param('clinicId') clinicId: string,
    @Param('locationId') locationId: string,
    @Param('caseId') caseId: string,
    @Query('limit') limit: string | undefined,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.workspace.auditTrail({
      clinicId: idOrThrow(clinicId, 'clinicId'),
      locationId: idOrThrow(locationId, 'locationId'),
      caseId: idOrThrow(caseId, 'caseId'),
      employee,
      limit: parseLimit(limit),
    });
  }
}

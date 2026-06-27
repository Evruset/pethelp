import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../../auth/auth.types';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { SWAGGER_BEARER_AUTH } from '../../openapi/openapi';
import { UpdateTelemedCaseWorkspaceDto } from './dto/update-telemed-case-workspace.dto';
import { TelemedVetWorkspaceService } from './telemed-vet-workspace.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function idOrThrow(value: string, field = 'id'): string {
  if (!UUID.test(value)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be a UUID.` });
  return value;
}

function parseLimit(value?: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 50;
  return Math.min(parsed, 100);
}

@ApiTags('Telemedicine veterinarian workspace')
@Controller('v1/telemed/vet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TELEMED_VETERINARIAN)
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
@ApiUnauthorizedResponse({ description: 'Platform veterinarian JWT is required.' })
@ApiForbiddenResponse({ description: 'Only the assigned platform veterinarian can edit or join a case.' })
export class TelemedVetWorkspaceController {
  constructor(private readonly workspace: TelemedVetWorkspaceService) {}

  @Get('queue')
  @ApiOperation({ summary: 'Read platform telemedicine queue and cases assigned to the current veterinarian' })
  @ApiOkResponse({ description: 'Queued cases plus only cases assigned to the requesting veterinarian.' })
  async queue(
    @Query('limit') limit: string | undefined,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.workspace.queue({ employee, limit: parseLimit(limit) });
  }

  @Post('cases/:caseId/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a queued platform telemedicine case to the current veterinarian' })
  async assign(
    @Param('caseId') caseId: string,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.workspace.assign({ caseId: idOrThrow(caseId, 'caseId'), employee });
  }

  @Post('cases/:caseId/start-session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a waiting room session for a case assigned to the current veterinarian' })
  async startSession(
    @Param('caseId') caseId: string,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.workspace.startSession({ caseId: idOrThrow(caseId, 'caseId'), employee });
  }

  @Post('cases/:caseId/sessions/:sessionId/connect')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connect the assigned veterinarian to a case-based telemedicine room' })
  async connectDoctor(
    @Param('caseId') caseId: string,
    @Param('sessionId') sessionId: string,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.workspace.connectDoctor({
      caseId: idOrThrow(caseId, 'caseId'),
      sessionId: idOrThrow(sessionId, 'sessionId'),
      employee,
    });
  }

  @Patch('cases/:caseId/workspace')
  @ApiOperation({ summary: 'Update safety escalation, recommendation and follow-up for an assigned case' })
  async updateWorkspace(
    @Param('caseId') caseId: string,
    @Body() dto: UpdateTelemedCaseWorkspaceDto,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.workspace.updateWorkspace({
      caseId: idOrThrow(caseId, 'caseId'),
      employee,
      dto,
    });
  }

  @Get('cases/:caseId/audit-trail')
  @ApiOperation({ summary: 'Read audit trail of a case assigned to the current veterinarian' })
  async auditTrail(
    @Param('caseId') caseId: string,
    @Query('limit') limit: string | undefined,
    @CurrentUser() employee: JwtPayload,
  ) {
    return this.workspace.auditTrail({
      caseId: idOrThrow(caseId, 'caseId'),
      employee,
      limit: parseLimit(limit),
    });
  }
}

import { BadRequestException, Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiExtraModels, ApiForbiddenResponse, ApiInternalServerErrorResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SWAGGER_BEARER_AUTH } from '../openapi/openapi';
import { ClinicWorkspaceHomeDto } from './dto/clinic-workspace-home.dto';
import { ClinicWorkspaceHomeService } from './clinic-workspace-home.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function scopedUuid(value: string, field: 'clinicId' | 'locationId'): string {
  if (!UUID.test(value)) throw new BadRequestException({ code: 'INVALID_REQUEST', message: `${field} must be a UUID.` });
  return value;
}

@ApiTags('Clinic Workspace Home')
@ApiExtraModels(ClinicWorkspaceHomeDto)
@Controller('v1')
export class ClinicWorkspaceHomeController {
  constructor(private readonly workspace: ClinicWorkspaceHomeService) {}

  @Get('clinic/:clinicId/locations/:locationId/workspace-home')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Read the exact-location capability-filtered Clinic Workspace Home foundation', description: 'Live database snapshot. Cache-Control: private, no-store. No ETag or 304 response is supported.' })
  @ApiOkResponse({ type: ClinicWorkspaceHomeDto })
  @ApiBadRequestResponse({ description: 'Malformed clinicId or locationId.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'Normalized exact clinic/location membership denial.' })
  @ApiInternalServerErrorResponse({ description: 'Normalized technical failure.' })
  async read(@Param('clinicId') clinicId: string, @Param('locationId') locationId: string, @CurrentUser() employee: JwtPayload, @Res() response: Response): Promise<void> {
    const snapshot = await this.workspace.read({ clinicId: scopedUuid(clinicId, 'clinicId'), locationId: scopedUuid(locationId, 'locationId'), employee });
    const body = JSON.stringify(snapshot);
    response.status(200);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Content-Length', Buffer.byteLength(body));
    response.end(body);
  }
}

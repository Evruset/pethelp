import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../../auth/auth.types';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { SWAGGER_BEARER_AUTH } from '../../openapi/openapi';
import { CreateCoverageCheckDto } from './dto/create-coverage-check.dto';
import { InsuranceService } from './insurance.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@ApiTags('Insurance Gateway')
@Controller('v1/insurance')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER)
@ApiBearerAuth(SWAGGER_BEARER_AUTH)
export class InsuranceController {
  constructor(private readonly insurance: InsuranceService) {}

  @Post('coverage-checks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create consent-first insurance coverage check request' })
  @ApiCreatedResponse({ description: 'Coverage check is CONSENT_REQUIRED or REQUESTED. Provider remains authoritative for the final decision.' })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT is missing or invalid.' })
  async create(@Body() dto: CreateCoverageCheckDto, @CurrentUser() owner: JwtPayload) {
    return this.insurance.create({ ownerId: owner.sub, petId: dto.petId, partnerCode: dto.partnerCode, consentVersion: dto.consentVersion });
  }

  @Get('coverage-checks/:checkId')
  @ApiOperation({ summary: 'Read coverage check state owned by the caller' })
  @ApiParam({ name: 'checkId', type: 'string', format: 'uuid' })
  @ApiOkResponse({ description: 'Provider-backed coverage-check state; VetHelp does not make the insurance decision.' })
  @ApiNotFoundResponse({ description: 'Coverage check is absent or does not belong to the owner.' })
  async read(@Param('checkId') checkId: string, @CurrentUser() owner: JwtPayload) {
    if (!UUID.test(checkId)) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'checkId must be a UUID.' });
    }
    return this.insurance.read(checkId, owner.sub);
  }
}

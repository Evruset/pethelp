import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBadRequestResponse, ApiCreatedResponse, ApiHeader, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../../auth/auth.types';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { SWAGGER_BEARER_AUTH } from '../../openapi/openapi';
import { CreateTelemedIntakeDto } from './dto/create-telemed-intake.dto';
import { TelemedIntakeService } from './telemed-intake.service';
import { TelemedOwnerSessionService } from './telemed-owner-session.service';
import { TelemedPaymentService } from './telemed-payment.service';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@ApiTags('Telemedicine')
@Controller('v1/telemed')
export class TelemedOwnerSessionController {
  constructor(
    private readonly sessions: TelemedOwnerSessionService,
    private readonly intakes: TelemedIntakeService,
    private readonly payments: TelemedPaymentService,
  ) {}

  @Post('intakes')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Create telemedicine intake and return safety eligibility before payment or queue' })
  @ApiOkResponse({ description: 'Eligibility outcome and routing target for the next owner step.' })
  @ApiBadRequestResponse({ description: 'Consent, category or red flag payload is invalid.' })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT is missing or invalid.' })
  async createIntake(@Body() dto: CreateTelemedIntakeDto, @CurrentUser() owner: JwtPayload) {
    return this.intakes.create(owner.sub, dto);
  }

  @Post('intakes/:intakeId/payment-intents')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiHeader({ name: 'Idempotency-Key', required: true, schema: { type: 'string', format: 'uuid' } })
  @ApiOperation({ summary: 'Create telemedicine checkout for an eligible intake with payment fencing' })
  @ApiCreatedResponse({ description: 'Telemedicine case is PAYMENT_PENDING and checkoutUrl is returned.' })
  @ApiBadRequestResponse({ description: 'Missing or malformed intakeId or Idempotency-Key.' })
  @ApiUnprocessableEntityResponse({ description: 'Only TELEMED_ELIGIBLE intakes can enter payment.' })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT is missing or invalid.' })
  async createPaymentIntent(
    @Param('intakeId') intakeId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @CurrentUser() owner: JwtPayload,
  ) {
    if (!UUID.test(intakeId)) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'intakeId must be a UUID.' });
    }
    if (!idempotencyKey || !UUID.test(idempotencyKey)) {
      throw new BadRequestException({ code: 'INVALID_IDEMPOTENCY_KEY', message: 'Idempotency-Key must be a UUID.' });
    }
    return this.payments.createIntent({ intakeId, ownerId: owner.sub, idempotencyKey });
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'List owner telemedicine sessions with server-owned status buckets' })
  @ApiOkResponse({ description: 'Owner telemedicine sessions ordered by active status and creation time.' })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT is missing or invalid.' })
  async list(@CurrentUser() owner: JwtPayload) {
    return this.sessions.list(owner.sub);
  }

  @Get('sessions/:sessionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Authoritative waiting room snapshot for the owner' })
  @ApiParam({ name: 'sessionId', type: 'string', format: 'uuid' })
  @ApiOkResponse({ description: 'Telemed state, serverNow, doctor join deadline and aggregate version.' })
  @ApiNotFoundResponse({ description: 'Session is absent or does not belong to the owner.' })
  @ApiUnauthorizedResponse({ description: 'Bearer JWT is missing or invalid.' })
  async read(@Param('sessionId') sessionId: string, @CurrentUser() owner: JwtPayload) {
    if (!UUID.test(sessionId)) {
      throw new BadRequestException({ code: 'INVALID_REQUEST', message: 'sessionId must be a UUID.' });
    }
    return this.sessions.read(sessionId, owner.sub);
  }
}

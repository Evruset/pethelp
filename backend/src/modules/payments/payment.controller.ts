import { Body, Controller, Headers, Param, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { CurrentUser } from '../../auth/current-user.decorator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { JwtPayload, Role } from '../../auth/auth.types';
import { Roles } from '../../auth/roles.decorator';
import { RolesGuard } from '../../auth/roles.guard';
import { SWAGGER_BEARER_AUTH } from '../../openapi/openapi';
import { AcquiringWebhookVerifier } from './acquiring-webhook-verifier';
import { PaymentIntentResult, PaymentService } from './payment.service';

interface PaymentAuthorizedWebhookDto {
  idempotencyKey?: string;
  eventId?: string;
  providerPaymentId?: string;
}

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@ApiTags('Payments & Ledger')
@Controller('v1')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly webhookVerifier: AcquiringWebhookVerifier,
  ) {}

  @Post('booking-holds/:holdId/payment-intents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Создание payment intent с фиксацией hold_version fence' })
  @ApiCreatedResponse({ description: 'Payment intent создан или возвращён существующий для hold/version.' })
  async createIntent(
    @Param('holdId') holdId: string,
    @CurrentUser() owner: JwtPayload,
  ): Promise<PaymentIntentResult> {
    return this.paymentService.createPaymentIntent(holdId, owner.sub);
  }

  @Post('payments/webhooks/authorized')
  @ApiOperation({ summary: 'Подписанный webhook эквайринга: авторизация платежа с durable Payment Attempt Fencing' })
  @ApiHeader({ name: 'X-Acquiring-Signature', required: true, schema: { type: 'string' } })
  @ApiHeader({ name: 'X-Acquiring-Event-Id', required: true, schema: { type: 'string' } })
  @ApiHeader({ name: 'Idempotency-Key', required: false, schema: { type: 'string' } })
  @ApiUnauthorizedResponse({ description: 'Подпись эквайринга невалидна.' })
  @ApiUnprocessableEntityResponse({ description: 'PAYMENT_FENCED_SLOT_EXPIRED или PAYMENT_FENCED_HOLD_VERSION_MISMATCH.' })
  async paymentAuthorized(
    @Req() request: RawBodyRequest,
    @Body() body: PaymentAuthorizedWebhookDto,
    @Headers('x-acquiring-signature') signature?: string,
    @Headers('x-acquiring-event-id') providerEventHeader?: string,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ): Promise<PaymentIntentResult> {
    const rawPayload = request.rawBody;
    if (!rawPayload || !this.webhookVerifier.verify(rawPayload, signature)) {
      throw new UnauthorizedException({ code: 'ACQUIRING_WEBHOOK_SIGNATURE_INVALID', message: 'Acquiring webhook signature is invalid' });
    }

    const idempotencyKey = body.idempotencyKey ?? idempotencyHeader ?? '';
    const providerEventId = body.eventId ?? providerEventHeader ?? '';
    return this.paymentService.handlePaymentAuthorized({
      idempotencyKey,
      providerEventId,
      providerPaymentId: body.providerPaymentId,
      rawPayload: rawPayload.toString('utf8'),
      payloadSha256: createHash('sha256').update(rawPayload).digest('hex'),
    });
  }
}

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
import { PaymentWebhookService } from './payment-webhook.service';

interface PaymentAuthorizedWebhookDto {
  idempotencyKey?: string;
  eventId?: string;
  providerPaymentId?: string;
}

interface PaymentRefundedWebhookDto {
  idempotencyKey?: string;
  eventId?: string;
  providerRefundId?: string;
}

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@ApiTags('Payments & Ledger')
@Controller('v1')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymentWebhookService: PaymentWebhookService,
    private readonly webhookVerifier: AcquiringWebhookVerifier,
  ) {}

  @Post('booking-holds/:holdId/payment-intents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH)
  @ApiOperation({ summary: 'Создание удалённого payment intent и checkout-сессии с фиксацией hold_version fence' })
  @ApiCreatedResponse({ description: 'Payment intent создан у эквайринга; checkoutUrl передаётся фронтенду.' })
  async createIntent(
    @Param('holdId') holdId: string,
    @CurrentUser() owner: JwtPayload,
  ): Promise<PaymentIntentResult> {
    return this.paymentService.createPaymentIntent(holdId, owner.sub);
  }

  @Post('payments/webhooks/authorized')
  @ApiOperation({ summary: 'Подписанный webhook авторизации: fencing, подтверждение hold и постановка capture в outbox' })
  @ApiHeader({ name: 'X-Acquiring-Signature', required: true, schema: { type: 'string' } })
  @ApiHeader({ name: 'X-Acquiring-Event-Id', required: true, schema: { type: 'string' } })
  @ApiHeader({ name: 'Idempotency-Key', required: false, schema: { type: 'string' } })
  @ApiUnauthorizedResponse({ description: 'Подпись эквайринга невалидна.' })
  @ApiUnprocessableEntityResponse({ description: 'PAYMENT_FENCED_SLOT_EXPIRED, PAYMENT_FENCED_HOLD_VERSION_MISMATCH или provider reference error.' })
  async paymentAuthorized(
    @Req() request: RawBodyRequest,
    @Body() body: PaymentAuthorizedWebhookDto,
    @Headers('x-acquiring-signature') signature?: string,
    @Headers('x-acquiring-event-id') providerEventHeader?: string,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ): Promise<PaymentIntentResult> {
    const rawPayload = this.requireVerifiedRawBody(request, signature);
    return this.paymentWebhookService.handleAuthorized({
      idempotencyKey: body.idempotencyKey ?? idempotencyHeader ?? '',
      providerEventId: body.eventId ?? providerEventHeader ?? '',
      providerPaymentId: body.providerPaymentId,
      rawPayload: rawPayload.toString('utf8'),
      payloadSha256: createHash('sha256').update(rawPayload).digest('hex'),
    });
  }

  @Post('payments/webhooks/refunded')
  @ApiOperation({ summary: 'Подписанный webhook полного refund: фиксирует REFUNDED и immutable ledger confirmation' })
  @ApiHeader({ name: 'X-Acquiring-Signature', required: true, schema: { type: 'string' } })
  @ApiHeader({ name: 'X-Acquiring-Event-Id', required: true, schema: { type: 'string' } })
  @ApiHeader({ name: 'Idempotency-Key', required: false, schema: { type: 'string' } })
  @ApiUnauthorizedResponse({ description: 'Подпись эквайринга невалидна.' })
  async paymentRefunded(
    @Req() request: RawBodyRequest,
    @Body() body: PaymentRefundedWebhookDto,
    @Headers('x-acquiring-signature') signature?: string,
    @Headers('x-acquiring-event-id') providerEventHeader?: string,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ): Promise<void> {
    const rawPayload = this.requireVerifiedRawBody(request, signature);
    await this.paymentWebhookService.handleRefunded({
      idempotencyKey: body.idempotencyKey ?? idempotencyHeader ?? '',
      providerEventId: body.eventId ?? providerEventHeader ?? '',
      providerRefundId: body.providerRefundId,
      rawPayload: rawPayload.toString('utf8'),
      payloadSha256: createHash('sha256').update(rawPayload).digest('hex'),
    });
  }

  private requireVerifiedRawBody(request: RawBodyRequest, signature?: string): Buffer {
    const rawPayload = request.rawBody;
    if (!rawPayload || !this.webhookVerifier.verify(rawPayload, signature)) {
      throw new UnauthorizedException({ code: 'ACQUIRING_WEBHOOK_SIGNATURE_INVALID', message: 'Acquiring webhook signature is invalid' });
    }
    return rawPayload;
  }
}

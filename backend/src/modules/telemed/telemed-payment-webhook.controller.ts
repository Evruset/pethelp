import { Body, Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags, ApiUnauthorizedResponse, ApiUnprocessableEntityResponse } from '@nestjs/swagger';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { AcquiringWebhookVerifier } from '../payments/acquiring-webhook-verifier';
import { TelemedPaymentAuthorizedResult, TelemedPaymentService } from './telemed-payment.service';

interface TelemedPaymentAuthorizedWebhookDto {
  idempotencyKey?: string;
  eventId?: string;
  providerPaymentId?: string;
  paymentFenceToken?: string;
}

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@ApiTags('Telemedicine')
@Controller('v1/telemed/payments/webhooks')
export class TelemedPaymentWebhookController {
  constructor(
    private readonly payments: TelemedPaymentService,
    private readonly webhookVerifier: AcquiringWebhookVerifier,
  ) {}

  @Post('authorized')
  @ApiOperation({ summary: 'Signed telemedicine payment authorization webhook: provider dedupe and queue transition' })
  @ApiHeader({ name: 'X-Acquiring-Signature', required: true, schema: { type: 'string' } })
  @ApiHeader({ name: 'X-Acquiring-Event-Id', required: true, schema: { type: 'string' } })
  @ApiHeader({ name: 'Idempotency-Key', required: false, schema: { type: 'string' } })
  @ApiUnauthorizedResponse({ description: 'Acquiring signature is invalid.' })
  @ApiUnprocessableEntityResponse({ description: 'Telemedicine payment is not ready or provider reference mismatched.' })
  async paymentAuthorized(
    @Req() request: RawBodyRequest,
    @Body() body: TelemedPaymentAuthorizedWebhookDto,
    @Headers('x-acquiring-signature') signature?: string,
    @Headers('x-acquiring-event-id') providerEventHeader?: string,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ): Promise<TelemedPaymentAuthorizedResult> {
    const rawPayload = this.requireVerifiedRawBody(request, signature);
    return this.payments.handleAuthorizedWebhook({
      idempotencyKey: body.idempotencyKey ?? idempotencyHeader ?? '',
      providerEventId: body.eventId ?? providerEventHeader ?? '',
      providerPaymentId: body.providerPaymentId,
      paymentFenceToken: body.paymentFenceToken ?? '',
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

import { Body, Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { LiveKitWebhookSignatureError } from './livekit.service';
import { LiveKitWebhookService } from './livekit-webhook.service';

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

@ApiTags('Telemedicine')
@Controller('v1/telemed/webhooks')
export class LiveKitWebhookController {
  constructor(private readonly webhookService: LiveKitWebhookService) {}

  @Post('livekit')
  @ApiOperation({ summary: 'Проверенный webhook LiveKit: аудит входа врача и завершение телемедицинской сессии' })
  @ApiHeader({ name: 'Authorization', required: true, schema: { type: 'string' } })
  @ApiUnauthorizedResponse({ description: 'LIVEKIT_SIGNATURE_INVALID' })
  async receive(
    @Req() request: RawBodyRequest,
    @Headers('authorization') authorization?: string,
    @Body() _body?: unknown,
  ): Promise<{ accepted: true }> {
    const rawBody = request.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new UnauthorizedException('LIVEKIT_SIGNATURE_INVALID');
    }

    try {
      await this.webhookService.handle(rawBody, authorization);
      return { accepted: true };
    } catch (error) {
      if (error instanceof LiveKitWebhookSignatureError) {
        throw new UnauthorizedException('LIVEKIT_SIGNATURE_INVALID');
      }
      throw error;
    }
  }
}

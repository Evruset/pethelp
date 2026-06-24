import { HttpStatus, Injectable } from '@nestjs/common';
import { AccessToken, RoomServiceClient, type WebhookEvent, WebhookReceiver } from 'livekit-server-sdk';
import { DomainException } from '../../common/domain-error';

export class LiveKitWebhookSignatureError extends Error {
  constructor() {
    super('LiveKit webhook signature is invalid');
    this.name = 'LiveKitWebhookSignatureError';
  }
}

@Injectable()
export class LiveKitService {
  private static readonly TOKEN_TTL = '30m';

  async generateLiveKitToken(roomName: string, participantIdentity: string, isDoctor: boolean): Promise<string> {
    const credentials = this.credentials();
    const token = new AccessToken(credentials.apiKey, credentials.apiSecret, {
      identity: participantIdentity,
      ttl: LiveKitService.TOKEN_TTL,
      attributes: { role: isDoctor ? 'doctor' : 'owner' },
    });
    token.addGrant({ roomJoin: true, room: roomName, roomAdmin: isDoctor });
    return token.toJwt();
  }

  async closeRoom(roomName: string): Promise<void> {
    const credentials = this.credentials();
    const roomService = new RoomServiceClient(this.roomServiceUrl(credentials.apiUrl), credentials.apiKey, credentials.apiSecret);
    await roomService.deleteRoom(roomName);
  }

  async receiveWebhook(rawBody: string, authorization?: string): Promise<WebhookEvent> {
    try {
      const credentials = this.credentials();
      const receiver = new WebhookReceiver(credentials.apiKey, credentials.apiSecret);
      return await receiver.receive(rawBody, authorization);
    } catch {
      throw new LiveKitWebhookSignatureError();
    }
  }

  apiUrl(): string {
    return this.credentials().apiUrl;
  }

  private roomServiceUrl(value: string): string {
    if (value.startsWith('wss://')) return `https://${value.substring('wss://'.length)}`;
    if (value.startsWith('ws://')) return `http://${value.substring('ws://'.length)}`;
    return value;
  }

  private credentials(): { apiUrl: string; apiKey: string; apiSecret: string } {
    const apiUrl = process.env.LIVEKIT_API_URL?.trim();
    const apiKey = process.env.LIVEKIT_API_KEY?.trim();
    const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
    if (!apiUrl || !apiKey || !apiSecret) {
      throw new DomainException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'LIVEKIT_CONFIGURATION_MISSING',
        'LIVEKIT_API_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be configured',
      );
    }
    return { apiUrl, apiKey, apiSecret };
  }
}

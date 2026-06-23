import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class AcquiringWebhookVerifier {
  verify(rawPayload: Buffer, signatureHeader?: string): boolean {
    const secret = process.env.ACQUIRING_WEBHOOK_SECRET?.trim();
    if (!secret || !signatureHeader) return false;

    const signature = signatureHeader.replace(/^sha256=/i, '').trim();
    const expected = createHmac('sha256', secret).update(rawPayload).digest('hex');
    if (signature.length !== expected.length) return false;

    return timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
  }
}

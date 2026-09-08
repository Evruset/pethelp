import { Injectable } from '@nestjs/common';

@Injectable()
export class OtpAntiFraudTelemetry {
  private allowed = 0;
  private rateLimited = 0;
  private activeBlock = 0;
  private databaseFailure = 0;
  record(result: 'ALLOWED' | 'RATE_LIMITED' | 'BLOCK_ACTIVE' | 'DATABASE_FAILURE'): void {
    if (result === 'ALLOWED') this.allowed += 1;
    else if (result === 'RATE_LIMITED') this.rateLimited += 1;
    else if (result === 'BLOCK_ACTIVE') this.activeBlock += 1;
    else this.databaseFailure += 1;
  }
  snapshot() { return Object.freeze({ allowed: this.allowed, rateLimited: this.rateLimited, activeBlock: this.activeBlock, databaseFailure: this.databaseFailure }); }
}

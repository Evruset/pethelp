import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service';
import { mvpScope } from './config/mvp-scope.config';
import { HoldExpirationService } from './workers/hold-expiration.service';

type OptionalCapabilityHealth = 'ENABLED' | 'DISABLED';

@Controller()
export class HealthController {
  constructor(
    private readonly database: DatabaseService,
    private readonly holdExpiration: HoldExpirationService,
  ) {}

  /**
   * Both paths are retained during Alpha so internal callers using /health keep
   * working while Kubernetes and external gateways use the versioned contract.
   */
  @Get(['health', 'v1/health'])
  async health(): Promise<{
    status: 'ok';
    databaseTime: string;
    service: string;
    profile: string;
    optionalCapabilities: Record<string, OptionalCapabilityHealth>;
    bookingExpiration: ReturnType<HoldExpirationService['healthSnapshot']>;
  }> {
    const result = await this.database.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    const bookingExpiration = this.holdExpiration.healthSnapshot();
    return {
      status: 'ok',
      databaseTime: result.rows[0].now.toISOString(),
      service: 'vethelp-mvp1',
      profile: mvpScope.profile,
      optionalCapabilities: Object.fromEntries(
        Object.entries(mvpScope.capabilities).map(([name, enabled]) => [
          name,
          enabled ? 'ENABLED' : 'DISABLED',
        ]),
      ),
      bookingExpiration,
    };
  }
}

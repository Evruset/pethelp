import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Controller()
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Both paths are retained during Alpha so internal callers using /health keep
   * working while Kubernetes and external gateways use the versioned contract.
   */
  @Get(['health', 'v1/health'])
  async health(): Promise<{ status: 'ok'; databaseTime: string; service: string }> {
    const result = await this.database.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    return { status: 'ok', databaseTime: result.rows[0].now.toISOString(), service: 'vethelp-mvp1' };
  }
}

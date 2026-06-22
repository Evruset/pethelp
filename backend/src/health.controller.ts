import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Controller()
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get('health')
  async health() {
    const result = await this.database.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    return { status: 'ok', databaseTime: result.rows[0].now.toISOString(), service: 'vethelp-mvp1' };
  }
}

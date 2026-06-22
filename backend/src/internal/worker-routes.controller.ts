import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { WorkerAuthGuard } from '../auth/worker-auth.guard';
import { HoldExpirationService } from '../workers/hold-expiration.service';

@Controller('internal/workers')
@UseGuards(WorkerAuthGuard)
export class WorkerRoutesController {
  constructor(private readonly expiration: HoldExpirationService) {}

  @Post('expire-holds')
  @HttpCode(HttpStatus.OK)
  async expireHolds() {
    return this.expiration.runOnce();
  }
}

import { Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { config } from '../config';
import { DomainErrors } from '../common/domain-error';
import { HoldExpirationService } from './hold-expiration.service';

@Controller('internal/workers')
export class WorkersController {
  constructor(private readonly expiration: HoldExpirationService) {}

  @Post('expire-holds')
  @HttpCode(HttpStatus.OK)
  async expireHolds(@Headers('x-worker-key') workerKey?: string) {
    if (workerKey !== config.devWorkerKey) throw DomainErrors.workerUnauthorized();
    return this.expiration.runOnce();
  }
}

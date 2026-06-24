import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CollectLatePaymentDto } from './dto/collect-late-payment.dto';
import { CollectMisTimeoutDto } from './dto/collect-mis-timeout.dto';
import { SandboxEvidenceService } from './sandbox-evidence.service';
import { SandboxFixtureTokenGuard } from './sandbox-fixture-token.guard';
import { SandboxOnlyGuard } from './sandbox-only.guard';

@ApiExcludeController()
@Controller(['v1', 'internal', 'sandbox-fixtures'].join('/'))
@UseGuards(SandboxOnlyGuard, SandboxFixtureTokenGuard)
export class SandboxEvidenceController {
  constructor(private readonly service: SandboxEvidenceService) {}

  @Post('collect-mis-timeout')
  @HttpCode(HttpStatus.OK)
  collectMisTimeout(@Body() body: CollectMisTimeoutDto) {
    return this.service.collectMisTimeout(body);
  }

  @Post('collect-late-payment')
  @HttpCode(HttpStatus.OK)
  collectLatePayment(@Body() body: CollectLatePaymentDto) {
    return this.service.collectLatePayment(body);
  }
}

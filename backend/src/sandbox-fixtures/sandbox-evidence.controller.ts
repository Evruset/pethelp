import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CollectLatePaymentDto } from './dto/collect-late-payment.dto';
import { CollectMisTimeoutDto } from './dto/collect-mis-timeout.dto';
import { PrepareSandboxScenarioDto } from './dto/prepare-sandbox-scenario.dto';
import { SandboxEvidenceService } from './sandbox-evidence.service';
import { SandboxFixtureTokenGuard } from './sandbox-fixture-token.guard';
import { SandboxOnlyGuard } from './sandbox-only.guard';
import { SandboxScenarioFixtureService } from './sandbox-scenario-fixture.service';

@ApiExcludeController()
@Controller(['v1', 'internal', 'sandbox-fixtures'].join('/'))
@UseGuards(SandboxOnlyGuard, SandboxFixtureTokenGuard)
export class SandboxEvidenceController {
  constructor(
    private readonly evidence: SandboxEvidenceService,
    private readonly fixtures: SandboxScenarioFixtureService,
  ) {}

  @Post('prepare-mis-timeout')
  @HttpCode(HttpStatus.CREATED)
  prepareMisTimeout(@Body() body: PrepareSandboxScenarioDto) {
    return this.fixtures.prepareMisTimeout(body.correlationId);
  }

  @Get('booking-holds/:holdId/slot-invariant')
  async slotInvariant(@Param('holdId') holdId: string) {
    const invariant = await this.fixtures.readSlotInvariant(holdId);
    if (!invariant) throw new NotFoundException();
    return invariant;
  }

  @Post('prepare-late-payment')
  @HttpCode(HttpStatus.CREATED)
  prepareLatePayment(@Body() body: PrepareSandboxScenarioDto) {
    return this.fixtures.prepareLatePayment(body.correlationId);
  }

  @Get('payment-intents/:paymentIntentId/ledger')
  ledger(@Param('paymentIntentId') paymentIntentId: string) {
    return this.fixtures.readLedger(paymentIntentId);
  }

  @Post('collect-mis-timeout')
  @HttpCode(HttpStatus.OK)
  collectMisTimeout(@Body() body: CollectMisTimeoutDto) {
    return this.evidence.collectMisTimeout(body);
  }

  @Post('collect-late-payment')
  @HttpCode(HttpStatus.OK)
  collectLatePayment(@Body() body: CollectLatePaymentDto) {
    return this.evidence.collectLatePayment(body);
  }
}

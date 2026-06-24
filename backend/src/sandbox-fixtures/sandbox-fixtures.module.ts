import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SandboxEvidenceController } from './sandbox-evidence.controller';
import { SandboxEvidenceService } from './sandbox-evidence.service';
import { SandboxFixtureTokenGuard } from './sandbox-fixture-token.guard';
import { SandboxOnlyGuard } from './sandbox-only.guard';
import { SandboxScenarioFixtureService } from './sandbox-scenario-fixture.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SandboxEvidenceController],
  providers: [SandboxEvidenceService, SandboxScenarioFixtureService, SandboxOnlyGuard, SandboxFixtureTokenGuard],
})
export class SandboxFixturesModule {}

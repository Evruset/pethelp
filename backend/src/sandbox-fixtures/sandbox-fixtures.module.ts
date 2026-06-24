import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SandboxEvidenceController } from './sandbox-evidence.controller';
import { SandboxEvidenceService } from './sandbox-evidence.service';
import { SandboxFixtureTokenGuard } from './sandbox-fixture-token.guard';
import { SandboxOnlyGuard } from './sandbox-only.guard';

@Module({
  imports: [DatabaseModule],
  controllers: [SandboxEvidenceController],
  providers: [SandboxEvidenceService, SandboxOnlyGuard, SandboxFixtureTokenGuard],
})
export class SandboxFixturesModule {}

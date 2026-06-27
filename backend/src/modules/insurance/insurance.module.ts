import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { InsuranceCoverageWorker } from './insurance-coverage-worker';
import { InsuranceController } from './insurance.controller';
import { InsuranceProviderAdapter } from './insurance-provider-adapter.service';
import { InsuranceService } from './insurance.service';

@Module({
  imports: [AuthModule],
  controllers: [InsuranceController],
  providers: [InsuranceService, InsuranceProviderAdapter, InsuranceCoverageWorker],
  exports: [InsuranceService],
})
export class InsuranceModule {}

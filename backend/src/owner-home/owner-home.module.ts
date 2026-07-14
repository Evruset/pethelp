import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TelemedModule } from '../modules/telemed/telemed.module';
import { OwnerHomeController } from './owner-home.controller';
import { OwnerHomeService } from './owner-home.service';

@Module({
  imports: [AuthModule, TelemedModule],
  controllers: [OwnerHomeController],
  providers: [OwnerHomeService],
})
export class OwnerHomeModule {}

import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { OwnerPetSyncController } from './owner-pet-sync.controller';
import { OwnerPetSyncService } from './owner-pet-sync.service';

@Module({
  imports: [AuthModule],
  controllers: [OwnerPetSyncController],
  providers: [OwnerPetSyncService],
})
export class OwnerPetModule {}

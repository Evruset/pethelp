import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OwnerAuthController, OwnerProfileController } from './owner-auth.controller';
import { OwnerAuthService } from './owner-auth.service';
import { RolesGuard } from './roles.guard';
import { WorkerAuthGuard } from './worker-auth.guard';

@Global()
@Module({
  imports: [JwtModule.register({})],
  controllers: [OwnerAuthController, OwnerProfileController],
  providers: [JwtAuthGuard, RolesGuard, WorkerAuthGuard, OwnerAuthService],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, WorkerAuthGuard, OwnerAuthService],
})
export class AuthModule {}

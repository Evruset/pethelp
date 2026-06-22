import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { WorkerAuthGuard } from './worker-auth.guard';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [JwtAuthGuard, RolesGuard, WorkerAuthGuard],
  exports: [JwtModule, JwtAuthGuard, RolesGuard, WorkerAuthGuard],
})
export class AuthModule {}

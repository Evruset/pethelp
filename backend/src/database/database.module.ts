import { Global, Module as NestModule } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Global()
@NestModule({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}

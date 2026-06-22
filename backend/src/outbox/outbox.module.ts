import { Module as NestModule } from '@nestjs/common';
import { OutboxRelayService } from './outbox-relay.service';
import { OutboxService } from './outbox.service';

@NestModule({
  providers: [OutboxService, OutboxRelayService],
  exports: [OutboxService],
})
export class OutboxModule {}

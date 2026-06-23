import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { AlertForwarderService } from './alert-forwarder.service';
import { ContextLoggerService } from './context-logger.service';
import { ObservabilityMetricsService } from './observability.metrics';
import { TraceContext } from './trace-context.context';

@Global()
@Module({
  imports: [HttpModule.register({ maxRedirects: 0 })],
  providers: [
    TraceContext,
    AlertForwarderService,
    ContextLoggerService,
    ObservabilityMetricsService,
  ],
  exports: [
    TraceContext,
    AlertForwarderService,
    ContextLoggerService,
    ObservabilityMetricsService,
  ],
})
export class ObservabilityModule {}

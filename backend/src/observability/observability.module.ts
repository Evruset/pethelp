import { Global, Module } from '@nestjs/common';
import { ContextLoggerService } from './context-logger.service';
import { ObservabilityMetricsService } from './observability.metrics';
import { TraceContext } from './trace-context.context';

@Global()
@Module({
  providers: [TraceContext, ContextLoggerService, ObservabilityMetricsService],
  exports: [TraceContext, ContextLoggerService, ObservabilityMetricsService],
})
export class ObservabilityModule {}

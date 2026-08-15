import { Injectable, LoggerService, Optional } from '@nestjs/common';
import { AlertForwarderService, type JsonLogPayload } from './alert-forwarder.service';
import { TraceContext } from './trace-context.context';
import { safeTelemetryContext, safeTelemetryCorrelationId, safeTelemetryMessage, sanitizeTelemetryFields } from './telemetry-sanitizer';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';

@Injectable()
export class ContextLoggerService implements LoggerService {
  constructor(
    private readonly traceContext: TraceContext,
    @Optional() private readonly alertForwarder?: AlertForwarderService,
  ) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, this.contextFrom(optionalParams));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    const context = optionalParams.at(-1);
    this.write('error', message, typeof context === 'string' ? context : undefined);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, this.contextFrom(optionalParams));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, this.contextFrom(optionalParams));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, this.contextFrom(optionalParams));
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, this.contextFrom(optionalParams));
  }

  event(level: LogLevel, context: string, message: string, fields: Record<string, unknown> = {}): void {
    this.write(level, message, context, fields);
  }

  eventWithoutActor(level: LogLevel, context: string, message: string, fields: Record<string, unknown> = {}): void {
    this.write(level, message, context, fields, true);
  }

  private contextFrom(optionalParams: unknown[]): string | undefined {
    const candidate = optionalParams.at(-1);
    return typeof candidate === 'string' ? candidate : undefined;
  }

  private write(level: LogLevel, message: unknown, context?: string, fields: Record<string, unknown> = {}, suppressActor = false): void {
    const trace = this.traceContext.get();
    let safeFields: Record<string, unknown> = {};
    try {
      safeFields = sanitizeTelemetryFields(fields);
    } catch {
      safeFields = {};
    }
    const payload: JsonLogPayload = {
      timestamp: new Date().toISOString(),
      level: level === 'log' ? 'info' : level,
      context: safeTelemetryContext(context),
      message: safeTelemetryMessage(message),
      correlationId: safeTelemetryCorrelationId(trace?.correlationId),
      ...safeFields,
    };
    const line = JSON.stringify(payload);

    if (level === 'error' || level === 'fatal') console.error(line);
    else console.log(line);

    // Alert transport is intentionally decoupled from the request path. JSON
    // logging remains the source record even if Telegram/Slack is unavailable.
    if (this.alertForwarder?.isCriticalAlertPayload(payload)) {
      void this.alertForwarder.forward(payload).catch((error: unknown) => {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          context: 'AlertForwarder',
          message: 'ALERT_FORWARDING_FAILED',
          errorCode: error instanceof Error ? 'ALERT_FORWARDER_REJECTED' : 'ALERT_FORWARDER_UNKNOWN',
          correlationId: payload.correlationId,
        }));
      });
    }
  }
}

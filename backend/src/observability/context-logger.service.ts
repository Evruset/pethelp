import { Injectable, LoggerService, Optional } from '@nestjs/common';
import { AlertForwarderService, type JsonLogPayload } from './alert-forwarder.service';
import { TraceContext } from './trace-context.context';

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
    const [traceOrContext, context] = optionalParams;
    const trace = typeof traceOrContext === 'string' && typeof context === 'string' ? traceOrContext : undefined;
    this.write('error', message, typeof context === 'string' ? context : this.contextFrom(optionalParams), trace ? { trace } : undefined);
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

  private contextFrom(optionalParams: unknown[]): string | undefined {
    const candidate = optionalParams.at(-1);
    return typeof candidate === 'string' ? candidate : undefined;
  }

  private write(level: LogLevel, message: unknown, context?: string, fields: Record<string, unknown> = {}): void {
    const trace = this.traceContext.get();
    const payload: JsonLogPayload = {
      timestamp: new Date().toISOString(),
      level: level === 'log' ? 'info' : level,
      context: context ?? 'VetHelp',
      message: this.toMessage(message),
      correlationId: trace?.correlationId,
      userId: trace?.userId,
      ...fields,
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
          message: error instanceof Error ? error.message : 'Alert forwarding failed',
          correlationId: payload.correlationId,
        }));
      });
    }
  }

  private toMessage(message: unknown): string {
    if (typeof message === 'string') return message;
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
}

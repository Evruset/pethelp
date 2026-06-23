import { Injectable, LoggerService } from '@nestjs/common';
import { TraceContext } from './trace-context.context';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';

@Injectable()
export class ContextLoggerService implements LoggerService {
  constructor(private readonly traceContext: TraceContext) {}

  log(message: unknown, context?: string): void {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace ? { trace } : undefined);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  fatal(message: unknown, context?: string): void {
    this.write('fatal', message, context);
  }

  event(level: LogLevel, context: string, message: string, fields: Record<string, unknown> = {}): void {
    this.write(level, message, context, fields);
  }

  private write(level: LogLevel, message: unknown, context?: string, fields: Record<string, unknown> = {}): void {
    const trace = this.traceContext.get();
    const payload = {
      timestamp: new Date().toISOString(),
      level: level === 'log' ? 'info' : level,
      context: context ?? 'VetHelp',
      message: this.toMessage(message),
      correlationId: trace?.correlationId,
      userId: trace?.userId,
      ...fields,
    };

    if (process.env.NODE_ENV === 'production') {
      const line = JSON.stringify(payload);
      if (level === 'error' || level === 'fatal') console.error(line);
      else console.log(line);
      return;
    }

    const line = JSON.stringify(payload);
    if (level === 'error' || level === 'fatal') console.error(line);
    else console.log(line);
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

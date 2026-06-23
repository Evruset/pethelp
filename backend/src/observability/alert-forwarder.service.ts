import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom, timeout } from 'rxjs';

export type VetHelpAlertType =
  | 'MIS_INTEGRATION_TIMEOUT'
  | 'PAYMENT_FENCING_TRIGGERED'
  | 'SLA_AUTO_VOID_FAILED'
  | 'REFUND_FAILED';

type AlertChannel = 'telegram' | 'slack';

export interface JsonLogPayload {
  timestamp?: string;
  level?: string;
  context?: string;
  message?: string;
  correlationId?: string;
  alert_type?: unknown;
  [key: string]: unknown;
}

interface CriticalAlertPayload extends JsonLogPayload {
  alert_type: VetHelpAlertType;
}

/**
 * A deliberately lightweight Alpha alert transport. It consumes the structured
 * payload already emitted by ContextLoggerService, so it does not scrape files
 * or depend on Prometheus/Loki. Alert delivery is best effort: the business
 * path and JSON log write never wait for a network request to Telegram/Slack.
 */
@Injectable()
export class AlertForwarderService {
  private static readonly ALERT_TYPES = new Set<VetHelpAlertType>([
    'MIS_INTEGRATION_TIMEOUT',
    'PAYMENT_FENCING_TRIGGERED',
    'SLA_AUTO_VOID_FAILED',
    'REFUND_FAILED',
  ]);

  /** Explicit allowlist prevents accidental PII or raw provider payload export. */
  private static readonly SAFE_EXTRA_FIELDS = [
    'holdId',
    'slotId',
    'appointmentId',
    'paymentIntentId',
    'telemedCaseId',
    'provider',
    'providerEventId',
    'errorCode',
    'state',
    'attempt',
    'retryAfterMs',
  ];

  constructor(private readonly http: HttpService) {}

  isCriticalAlertPayload(payload: JsonLogPayload): payload is CriticalAlertPayload {
    return (
      typeof payload.alert_type === 'string'
      && AlertForwarderService.ALERT_TYPES.has(payload.alert_type as VetHelpAlertType)
    );
  }

  /** For ContextLoggerService integration. */
  async forward(payload: JsonLogPayload): Promise<void> {
    if (!this.enabled() || !this.isCriticalAlertPayload(payload)) return;

    const text = this.format(payload);
    if (this.channel() === 'telegram') {
      await this.sendTelegram(text);
      return;
    }

    await this.sendSlack(text);
  }

  /**
   * Allows a sidecar/sweeper to reuse the same logic when reading JSONL lines.
   * Malformed and non-JSON log lines are intentionally ignored.
   */
  async forwardFromLine(line: string): Promise<void> {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) return;

    try {
      await this.forward(JSON.parse(trimmed) as JsonLogPayload);
    } catch {
      // A malformed line must not terminate a log-reading process.
    }
  }

  private enabled(): boolean {
    return (process.env.ALERT_FORWARDER_ENABLED ?? 'false').toLowerCase() === 'true';
  }

  private channel(): AlertChannel {
    return (process.env.ALERT_FORWARDER_CHANNEL ?? 'telegram').toLowerCase() === 'slack'
      ? 'slack'
      : 'telegram';
  }

  private requestTimeoutMs(): number {
    const parsed = Number.parseInt(process.env.ALERT_FORWARDER_TIMEOUT_MS ?? '2500', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 2500;
  }

  private format(payload: CriticalAlertPayload): string {
    const safeFields = AlertForwarderService.SAFE_EXTRA_FIELDS
      .filter((key) => payload[key] !== undefined && payload[key] !== null)
      .map((key) => `${key}: ${String(payload[key]).slice(0, 300)}`);

    return [
      'VetHelp Alpha critical alert',
      `alert_type: ${payload.alert_type}`,
      `timestamp: ${payload.timestamp ?? new Date().toISOString()}`,
      `level: ${payload.level ?? 'error'}`,
      `context: ${payload.context ?? 'VetHelp'}`,
      `correlationId: ${payload.correlationId ?? 'missing'}`,
      `message: ${(payload.message ?? 'No message').slice(0, 1000)}`,
      ...safeFields,
    ].join('\n').slice(0, 3800);
  }

  private async sendTelegram(text: string): Promise<void> {
    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
    if (!token || !chatId) {
      throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be configured');
    }

    await firstValueFrom(
      this.http.post(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        },
        { headers: { 'Content-Type': 'application/json' } },
      ).pipe(timeout(this.requestTimeoutMs())),
    );
  }

  private async sendSlack(text: string): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL?.trim();
    if (!webhookUrl) throw new Error('SLACK_WEBHOOK_URL must be configured');

    await firstValueFrom(
      this.http.post(
        webhookUrl,
        { text },
        { headers: { 'Content-Type': 'application/json' } },
      ).pipe(timeout(this.requestTimeoutMs())),
    );
  }
}

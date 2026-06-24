import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type CertificationResult = 'PASS' | 'FAIL' | 'NOT_RUN';

export interface HttpExchangeEvidence {
  label: string;
  method: string;
  url: string;
  status: number | 'NETWORK_ERROR';
  request?: unknown;
  response?: unknown;
  recordedAt: string;
}

export interface ScenarioEvidence {
  scenario: string;
  correlationId: string;
  result: CertificationResult;
  observations: string[];
  exchanges: HttpExchangeEvidence[];
}

export const SANDBOX_EVIDENCE_PATH = path.resolve(process.cwd(), 'artifacts/sandbox-certification/evidence.json');

export async function writeSandboxEvidence(records: ScenarioEvidence[]): Promise<void> {
  await mkdir(path.dirname(SANDBOX_EVIDENCE_PATH), { recursive: true });
  await writeFile(SANDBOX_EVIDENCE_PATH, JSON.stringify(records, null, 2), 'utf8');
}

export async function readSandboxEvidence(): Promise<ScenarioEvidence[]> {
  try {
    return JSON.parse(await readFile(SANDBOX_EVIDENCE_PATH, 'utf8')) as ScenarioEvidence[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/** Keep correlationId and protocol status; remove secrets, PII and URL query values. */
export function redactEvidence(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map(redactEvidence);
  if (typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
    if (/(authorization|token|secret|signature|password|cookie|api[-_]?key)/i.test(key)) return [key, '[REDACTED]'];
    if (/(email|phone|name|address|owner|pet|patient|license|evidence_url)/i.test(key)) return [key, '[PII_REDACTED]'];
    return [key, redactEvidence(nested)];
  }));
}

function redactString(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:token|signature|secret|password|key)=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[PII_REDACTED_EMAIL]')
    .replace(/\+?\d[\d ()-]{7,}\d/g, '[PII_REDACTED_PHONE]');
}

export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) url.searchParams.set(key, '[REDACTED]');
    return url.toString();
  } catch {
    return redactString(raw);
  }
}

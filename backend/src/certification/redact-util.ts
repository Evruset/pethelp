const SECRET_HEADER = '(?:authorization|proxy-authorization|x-client-access-token|x-api-key|x-signature|x-hmac|x-webhook-signature|signature|hmac)';
const SECRET_JSON_KEY = '(?:access[_-]?token|refresh[_-]?token|id[_-]?token|authorization|client[_-]?access[_-]?token|api[_-]?key|secret|signature|hmac|password|cookie)';
const PII_JSON_KEY = '(?:pet[_-]?name|petname|owner[_-]?name|ownername|patient[_-]?name|patientname|full[_-]?name|email|phone|telephone|address|license[_-]?number)';

/**
 * Redacts credentials and common PII from raw HTTP dumps before the value can
 * be persisted in audit evidence or copied into SANDBOX_CERTIFICATION_REPORT.
 */
export function redactSensitiveData(rawJson: string): string {
  const structured = redactJsonIfPossible(rawJson);
  return redactText(structured);
}

export function redactText(raw: string): string {
  return raw
    .replace(new RegExp(`(^|\\n)(${SECRET_HEADER}\\s*:\\s*)([^\\r\\n]+)`, 'gim'), '$1$2[REDACTED]')
    .replace(/(\b(?:Bearer|OAuth)\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(new RegExp(`("${SECRET_JSON_KEY}"\\s*:\\s*")[^"]*(")`, 'gi'), '$1[REDACTED]$2')
    .replace(new RegExp(`("${PII_JSON_KEY}"\\s*:\\s*")[^"]*(")`, 'gi'), '$1[PII_REDACTED]$2')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[PII_REDACTED_EMAIL]')
    .replace(/(?<!\w)\+?\d[\d ()-]{7,}\d(?!\w)/g, '[PII_REDACTED_PHONE]')
    .replace(/([?&](?:token|signature|secret|key|authorization)=)[^&\s]+/gi, '$1[REDACTED]');
}

function redactJsonIfPossible(raw: string): string {
  try {
    return JSON.stringify(redactObject(JSON.parse(raw)));
  } catch {
    return raw;
  }
}

function redactObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactObject);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
    if (new RegExp(`^${SECRET_JSON_KEY}$`, 'i').test(key)) return [key, '[REDACTED]'];
    if (new RegExp(`^${PII_JSON_KEY}$`, 'i').test(key)) return [key, '[PII_REDACTED]'];
    return [key, redactObject(nested)];
  }));
}

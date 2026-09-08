export type ResumeIntent = Readonly<{ kind: 'START_BOOKING' }>;

export function isResumeIntent(value: unknown): value is ResumeIntent {
  return typeof value === 'object' && value !== null && Object.keys(value).length === 1 && (value as { kind?: unknown }).kind === 'START_BOOKING';
}

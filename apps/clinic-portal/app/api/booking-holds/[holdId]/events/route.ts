import { NextResponse } from 'next/server';
import { getClinicSession } from '@/lib/auth/clinic-session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ holdId: string }> };
type SafeEvent = { id: string; occurredAt: string; label: string; source: string; outcome: string; description?: string };

function base(): string { const value = process.env.VETHELP_API_BASE_URL; if (!value) throw new Error('VETHELP_API_BASE_URL is not configured'); return value.replace(/\/$/, ''); }
function label(type: string): Pick<SafeEvent, 'label' | 'source' | 'outcome'> {
  const known: Record<string, Pick<SafeEvent, 'label' | 'source' | 'outcome'>> = {
    'booking.hold.created.v1': { label: 'Удержание создано', source: 'Бронирование', outcome: 'Создано' },
    'booking.confirmed.v1': { label: 'Запись подтверждена', source: 'Клиника', outcome: 'Подтверждено' },
    'booking.hold.released.v1': { label: 'Удержание освобождено', source: 'Бронирование', outcome: 'Освобождено' },
    'booking.declined.v1': { label: 'Заявка отклонена', source: 'Клиника', outcome: 'Отклонено' },
    'booking.notes.requested.v1': { label: 'Запрошены уточнения', source: 'Клиника', outcome: 'Ожидает уточнений' },
    'booking.alternative.proposed.v1': { label: 'Предложено другое время', source: 'Клиника', outcome: 'Ожидает ответа' },
  };
  return known[type] ?? { label: 'Событие обработки', source: 'Обработка записи', outcome: 'Зарегистрировано' };
}
function parse(payload: unknown, holdId: string): { holdId: string; events: SafeEvent[] } | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  if (value.holdId !== holdId || !Array.isArray(value.events)) return null;
  const events: SafeEvent[] = [];
  for (const item of value.events) {
    if (!item || typeof item !== 'object') return null;
    const event = item as Record<string, unknown>;
    if (typeof event.eventId !== 'string' || !UUID.test(event.eventId) || typeof event.eventType !== 'string' || typeof event.occurredAt !== 'string' || Number.isNaN(Date.parse(event.occurredAt))) return null;
    events.push({ id: event.eventId, occurredAt: event.occurredAt, ...label(event.eventType) });
  }
  return { holdId, events };
}

export async function GET(_: Request, context: Context): Promise<NextResponse> {
  const { holdId } = await context.params; const session = await getClinicSession();
  if (!session || !UUID.test(holdId)) return NextResponse.json({ code: 'REPLAY_UNAVAILABLE' }, { status: 403 });
  try {
    const upstream = await fetch(`${base()}/v1/booking-holds/${holdId}/events`, { headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' }, cache: 'no-store' });
    if (!upstream.ok) return NextResponse.json({ code: 'REPLAY_UNAVAILABLE' }, { status: upstream.status, headers: { 'Cache-Control': 'no-store' } });
    const safe = parse(await upstream.json().catch(() => null), holdId);
    return safe ? NextResponse.json(safe, { headers: { 'Cache-Control': 'no-store' } }) : NextResponse.json({ code: 'REPLAY_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ code: 'REPLAY_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}

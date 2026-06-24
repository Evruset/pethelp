import http from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.PORT ?? 4101);
const apiKey = process.env.MOCK_MIS_API_KEY ?? 'local-mis-api-key';
const reservations = new Map();
let nextScenario = { mode: 'success', delayMs: 0, ttlMinutes: 8 };

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function authorized(request) {
  return request.headers['x-api-key'] === apiKey;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/health') {
    return send(response, 200, { status: 'ok', service: 'mock-mis' });
  }

  if (request.method === 'GET' && url.pathname === '/__mock/state') {
    return send(response, 200, {
      nextScenario,
      reservations: [...reservations.values()],
    });
  }

  if (request.method === 'POST' && url.pathname === '/__mock/scenarios') {
    const payload = await readJson(request);
    const mode = payload.mode ?? 'success';
    if (!['success', 'reject', 'timeout'].includes(mode)) {
      return send(response, 422, { error: 'mode must be success, reject or timeout' });
    }
    const delayMs = Number(payload.delayMs ?? (mode === 'timeout' ? 4_500 : 0));
    const ttlMinutes = Number(payload.ttlMinutes ?? 8);
    nextScenario = { mode, delayMs, ttlMinutes };
    return send(response, 200, { configured: nextScenario });
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/reservations') {
    if (!authorized(request)) return send(response, 401, { error: 'invalid API key' });

    const payload = await readJson(request);
    const reservationId = String(payload.reservationId ?? '');
    if (!reservationId) return send(response, 422, { error: 'reservationId is required' });

    const existing = reservations.get(reservationId);
    if (existing) return send(response, 200, existing);

    const scenario = nextScenario;
    nextScenario = { mode: 'success', delayMs: 0, ttlMinutes: 8 };
    if (scenario.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, scenario.delayMs));

    if (scenario.mode === 'reject') {
      return send(response, 422, { success: false, status: 'FAILED', error: 'Mock MIS rejected reservation' });
    }

    const result = {
      success: true,
      status: 'SUCCESS',
      externalHoldId: `mock-mis-${randomUUID()}`,
      ttlMinutes: scenario.ttlMinutes,
      reservationId,
      slotId: payload.slotId,
      clinicId: payload.clinicId,
    };
    reservations.set(reservationId, result);
    return send(response, 201, result);
  }

  return send(response, 404, { error: 'not found' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`mock-mis listening on ${port}`);
});

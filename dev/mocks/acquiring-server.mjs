import http from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';

const port = Number(process.env.PORT ?? 4102);
const apiKey = process.env.MOCK_ACQUIRING_API_KEY ?? 'local-acquiring-api-key';
const webhookSecret = process.env.MOCK_ACQUIRING_WEBHOOK_SECRET ?? 'local-acquiring-webhook-secret';
const webhookTarget = process.env.VETHELP_WEBHOOK_TARGET ?? '';
const telemedWebhookTarget = process.env.VETHELP_TELEMED_WEBHOOK_TARGET ?? '';
const intents = new Map();
const idempotency = new Map();

function send(response, status, body, contentType = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'content-type': contentType });
  response.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function authorized(request) {
  return request.headers.authorization === `Bearer ${apiKey}`;
}

function intentByPath(pathname) {
  const match = /^\/v1\/payment-intents\/([^/]+)(?:\/(capture|void|refunds))?$/.exec(pathname);
  if (!match) return undefined;
  return { remoteId: decodeURIComponent(match[1]), operation: match[2] };
}

function sign(raw) {
  return createHmac('sha256', webhookSecret).update(raw).digest('hex');
}

async function deliverAuthorizedWebhook(intent, idempotencyKey) {
  const target = intent.webhookKind === 'TELEMED' ? telemedWebhookTarget : webhookTarget;
  if (!target) {
    throw new Error(
      intent.webhookKind === 'TELEMED'
        ? 'VETHELP_TELEMED_WEBHOOK_TARGET is not configured'
        : 'VETHELP_WEBHOOK_TARGET is not configured',
    );
  }
  const payload = {
    idempotencyKey: intent.webhookIdempotencyKey ?? idempotencyKey,
    eventId: `mock-event-${randomUUID()}`,
    providerPaymentId: intent.remoteId,
    ...(intent.paymentFenceToken ? { paymentFenceToken: intent.paymentFenceToken } : {}),
  };
  const raw = JSON.stringify(payload);
  const response = await fetch(target, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-acquiring-signature': `sha256=${sign(raw)}`,
      'x-acquiring-event-id': payload.eventId,
      'idempotency-key': idempotencyKey,
    },
    body: raw,
  });
  const body = await response.text();
  return { status: response.status, body: body ? JSON.parse(body) : undefined, eventId: payload.eventId };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/health') {
    return send(response, 200, { status: 'ok', service: 'mock-acquiring' });
  }

  if (request.method === 'GET' && url.pathname === '/__mock/state') {
    return send(response, 200, { intents: [...intents.values()] });
  }

  if (request.method === 'POST' && /^\/__mock\/payment-intents\/[^/]+\/authorize$/.test(url.pathname)) {
    const remoteId = decodeURIComponent(url.pathname.split('/')[3]);
    const intent = intents.get(remoteId);
    if (!intent) return send(response, 404, { error: 'payment intent not found' });
    const command = await readJson(request);
    const webhookKey = typeof command.idempotencyKey === 'string' && command.idempotencyKey.trim()
      ? command.idempotencyKey.trim()
      : intent.merchantPaymentId;
    try {
      const delivery = await deliverAuthorizedWebhook(intent, webhookKey);
      intent.lastWebhook = delivery;
      return send(response, delivery.status >= 200 && delivery.status < 300 ? 200 : 502, { delivered: delivery });
    } catch (error) {
      return send(response, 502, { error: error instanceof Error ? error.message : 'webhook delivery failed' });
    }
  }

  if (request.method === 'GET' && url.pathname.startsWith('/checkout/')) {
    const remoteId = decodeURIComponent(url.pathname.slice('/checkout/'.length));
    const intent = intents.get(remoteId);
    if (!intent) return send(response, 404, 'Unknown mock payment intent', 'text/plain; charset=utf-8');
    return send(response, 200, `<!doctype html><html><body><h1>Mock payment checkout</h1><p>Intent: ${remoteId}</p><p>Amount: ${intent.amount}</p><p>Use the mock authorize endpoint with the idempotencyKey from the payment-intent response.</p><pre>curl -X POST -H 'Content-Type: application/json' -d '{"idempotencyKey":"&lt;payment-intent-idempotencyKey&gt;"}' http://localhost:${port}/__mock/payment-intents/${remoteId}/authorize</pre></body></html>`, 'text/html; charset=utf-8');
  }

  if (!url.pathname.startsWith('/v1/payment-intents')) return send(response, 404, { error: 'not found' });
  if (!authorized(request)) return send(response, 401, { error: 'invalid bearer token' });

  if (request.method === 'POST' && url.pathname === '/v1/payment-intents') {
    const payload = await readJson(request);
    const key = request.headers['idempotency-key'];
    if (typeof key === 'string' && idempotency.has(key)) return send(response, 200, idempotency.get(key));
    if (!payload.merchantPaymentId || !Number.isFinite(Number(payload.amount))) {
      return send(response, 422, { error: 'merchantPaymentId and numeric amount are required' });
    }
    const remoteId = `mock-pay-${randomUUID()}`;
    const metadata = payload.webhookMetadata && typeof payload.webhookMetadata === 'object'
      ? payload.webhookMetadata
      : {};
    const intent = {
      remoteId,
      merchantPaymentId: String(payload.merchantPaymentId),
      amount: Number(payload.amount),
      webhookKind: metadata.kind === 'TELEMED' ? 'TELEMED' : 'BOOKING',
      webhookIdempotencyKey: typeof metadata.idempotencyKey === 'string'
        ? metadata.idempotencyKey
        : null,
      paymentFenceToken: typeof metadata.paymentFenceToken === 'string'
        ? metadata.paymentFenceToken
        : null,
      status: 'PENDING',
      refunds: [],
    };
    intents.set(remoteId, intent);
    const result = { remoteId, checkoutUrl: `http://localhost:${port}/checkout/${remoteId}` };
    if (typeof key === 'string') idempotency.set(key, result);
    return send(response, 201, result);
  }

  const parsed = intentByPath(url.pathname);
  if (!parsed) return send(response, 404, { error: 'not found' });
  const intent = intents.get(parsed.remoteId);
  if (!intent) return send(response, 404, { error: 'payment intent not found' });

  if (request.method === 'GET' && !parsed.operation) return send(response, 200, { status: intent.status });

  if (request.method === 'POST' && parsed.operation === 'capture') {
    intent.status = 'CAPTURED';
    return send(response, 200, { captured: true, status: intent.status });
  }

  if (request.method === 'POST' && parsed.operation === 'void') {
    intent.status = 'VOIDED';
    return send(response, 200, { status: intent.status });
  }

  if (request.method === 'POST' && parsed.operation === 'refunds') {
    const payload = await readJson(request);
    const refundId = `mock-refund-${randomUUID()}`;
    intent.status = 'REFUNDED';
    intent.refunds.push({ refundId, amount: Number(payload.amount ?? 0) });
    return send(response, 201, { refundId, status: intent.status });
  }

  return send(response, 405, { error: 'method not allowed' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`mock-acquiring listening on ${port}`);
});

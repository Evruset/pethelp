import http from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.PORT ?? 4103);
const objects = new Map();
const events = [];

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  if (request.method === 'GET' && url.pathname === '/health') {
    return send(response, 200, { status: 'ok', service: 'mock-cloud' });
  }

  if (request.method === 'GET' && url.pathname === '/v1/metadata') {
    return send(response, 200, {
      provider: 'local-mock-cloud',
      objectStorage: true,
      eventSink: true,
      cloudCredentialsRequired: false,
    });
  }

  if (request.method === 'POST' && url.pathname === '/v1/events') {
    const raw = await readBody(request);
    const event = { id: `mock-cloud-event-${randomUUID()}`, receivedAt: new Date().toISOString(), raw: raw.toString('utf8') };
    events.push(event);
    return send(response, 202, event);
  }

  if (request.method === 'GET' && url.pathname === '/__mock/state') {
    return send(response, 200, { events, objectKeys: [...objects.keys()] });
  }

  const objectMatch = /^\/v1\/objects\/(.+)$/.exec(url.pathname);
  if (objectMatch) {
    const key = decodeURIComponent(objectMatch[1]);
    if (request.method === 'PUT') {
      const body = await readBody(request);
      objects.set(key, { body: body.toString('base64'), contentType: request.headers['content-type'] ?? 'application/octet-stream' });
      return send(response, 201, { key, stored: true });
    }
    if (request.method === 'GET') {
      const object = objects.get(key);
      if (!object) return send(response, 404, { error: 'object not found' });
      response.writeHead(200, { 'content-type': object.contentType });
      return response.end(Buffer.from(object.body, 'base64'));
    }
  }

  return send(response, 404, { error: 'not found' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`mock-cloud listening on ${port}`);
});

const http = require('node:http');

const scenario = process.env.SMOKE_FIXTURE_SCENARIO || 'healthy';
const server = http.createServer((request, response) => {
  if (scenario === 'timeout') return;
  if (scenario === 'malformed') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('not-json');
    return;
  }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ status: 'ok', service: request.url }));
});
server.listen(0, '127.0.0.1', () => {
  process.stdout.write(`${server.address().port}\n`);
});
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

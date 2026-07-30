const fs = require('fs');

const input = process.env.DEMO_SESSIONS_JSON;
if (!input) throw new Error('DEMO_SESSIONS_JSON is required');
const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const endpoint = `${data.portal}/api/dev/local-session`;
const allowed = data.sessions.find((item) => item.key === 'reception-main');
const deniedKeys = ['revoked', 'inactive', 'no-membership'];
const quick = process.argv.includes('--quick');

async function post(body, origin = data.portal) {
  return fetch(endpoint, {
    method: 'POST',
    redirect: 'manual',
    headers: { Origin: origin, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
}
async function issue(returnPath) {
  const response = await post({ action: 'issue', profileKey: allowed.key, returnPath });
  const body = await response.json();
  if (response.status !== 200 || typeof body.code !== 'string') throw new Error(`issue failed ${response.status}`);
  return body.code;
}
function hasCookie(response) {
  return Boolean(response.headers.get('set-cookie'));
}
async function main() {
  const invalidOrigins = ['https://example.com', 'http://localhost:1', 'http://127.0.0.1:1', data.portal.replace('http:', 'https:')];
  for (const origin of invalidOrigins) {
    const response = await post({ action: 'issue', profileKey: allowed.key }, origin);
    if (response.status !== 401 || hasCookie(response)) throw new Error(`invalid origin accepted: ${origin}`);
  }

  for (const returnPath of ['//example.com', 'https://example.com', '/../admin', '/unapproved']) {
    const code = await issue(returnPath);
    const response = await post({ action: 'exchange', code });
    const body = await response.json();
    if (response.status !== 200 || !hasCookie(response) || body.startPath !== allowed.startUrl.replace(data.portal, '')) {
      throw new Error('unsafe return path was not canonicalized');
    }
  }

  for (const key of deniedKeys) {
    const issued = await post({ action: 'issue', profileKey: key });
    const code = (await issued.json()).code;
    const response = await post({ action: 'exchange', code });
    if (response.status !== 401 || hasCookie(response)) throw new Error(`negative authority accepted: ${key}`);
  }

  if (quick) {
    console.log('[security-check] mode=quick origins=4 returnPaths=4 negativeAuthority=3 concurrency=skipped expiry=skipped');
    return;
  }

  const concurrentCode = await issue();
  const concurrent = await Promise.all(Array.from({ length: 10 }, () => post({ action: 'exchange', code: concurrentCode })));
  const successes = concurrent.filter((response) => response.status === 200 && hasCookie(response)).length;
  const denials = concurrent.filter((response) => response.status === 401 && !hasCookie(response)).length;
  const failures = concurrent.filter((response) => response.status >= 500).length;
  if (successes !== 1 || denials !== 9 || failures !== 0) throw new Error(`concurrency mismatch successes=${successes} denials=${denials} failures=${failures}`);

  const expiredCode = await issue();
  await new Promise((resolve) => setTimeout(resolve, 46_000));
  const expired = await post({ action: 'exchange', code: expiredCode });
  if (expired.status !== 401 || hasCookie(expired)) throw new Error('expired code accepted');

  console.log('[security-check] mode=full origins=4 returnPaths=4 negativeAuthority=3 concurrentRequests=10 successes=1 denials=9 expired=denied');
}
main().catch((error) => { console.error(`[security-check] FAILED: ${error.message}`); process.exit(1); });

export const CANONICAL_LOCAL_OWNER_ORIGIN = 'http://127.0.0.1:8081';

export function canonicalLocalOwnerUrl(value: string): string | null {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== 'localhost' || url.port !== '8081') return null;
  return `${CANONICAL_LOCAL_OWNER_ORIGIN}${url.pathname}${url.search}${url.hash}`;
}

export const CANONICAL_LOCAL_OWNER_REDIRECT_SCRIPT = `(() => {
  if (location.protocol === 'http:' && location.hostname === 'localhost' && location.port === '8081') {
    location.replace('http://127.0.0.1:8081' + location.pathname + location.search + location.hash);
  }
})();`;

import type { SessionStore } from './secure-session-store';
import type { SessionMaterial } from './session';

export const WEB_SESSION_CREDENTIAL='__HTTP_ONLY_OWNER_SESSION__';
type Bootstrap={authenticated:true;subjectId:string;expiresAt:string};

async function bootstrap():Promise<SessionMaterial|null>{
  const response=await fetch('/api/owner/v1/auth/session',{credentials:'same-origin',cache:'no-store'});
  if(response.status===401)return null;
  if(!response.ok)throw new Error('WEB_SESSION_VALIDATION_UNAVAILABLE');
  const value=await response.json() as Partial<Bootstrap>;
  const expiresAtEpochMs=Date.parse(String(value.expiresAt));
  if(value.authenticated!==true||typeof value.subjectId!=='string'||!Number.isFinite(expiresAtEpochMs))throw new Error('INVALID_WEB_SESSION_BOOTSTRAP');
  return{opaqueCredential:WEB_SESSION_CREDENTIAL,cacheScope:value.subjectId,expiresAtEpochMs};
}

export const secureSessionStore:SessionStore={
  read:bootstrap,
  async write(session){if(session.opaqueCredential!==WEB_SESSION_CREDENTIAL)throw new Error('WEB_CREDENTIAL_MUST_BE_HTTP_ONLY')},
  async clear(){/* The authoritative revoke/clear is performed by sessionAuthority.web. */},
};

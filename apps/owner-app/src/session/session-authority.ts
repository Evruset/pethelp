import { apiClient, type ApiClient } from '@/api/client';
import { ApiError } from '@/api/errors';

export type EffectiveOwnerSession = Readonly<{ subjectId:string; roles:readonly string[] }>;
export type SessionAuthority = Readonly<{
  validate(credential:string,signal?:AbortSignal):Promise<EffectiveOwnerSession>;
  revoke(credential:string,signal?:AbortSignal):Promise<void>;
}>;

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createSessionAuthority(client:ApiClient=apiClient):SessionAuthority {
  const headers=(credential:string)=>({Authorization:`Bearer ${credential}`});
  return {
    async validate(credential,signal) {
      const value=await client.request<unknown>('v1/auth/session',{headers:headers(credential),signal});
      if(typeof value!=='object'||value===null) throw new ApiError('UNEXPECTED_RESPONSE','The server returned an invalid response.');
      const response=value as {subjectId?:unknown;roles?:unknown};
      if(typeof response.subjectId!=='string'||!UUID.test(response.subjectId)||!Array.isArray(response.roles)||!response.roles.includes('OWNER')) throw new ApiError('UNEXPECTED_RESPONSE','The server returned an invalid response.');
      return {subjectId:response.subjectId,roles:response.roles.filter((role):role is string=>typeof role==='string')};
    },
    async revoke(credential,signal) { await client.request<void>('v1/auth/logout',{method:'POST',headers:headers(credential),signal}); },
  };
}
export const sessionAuthority=createSessionAuthority();

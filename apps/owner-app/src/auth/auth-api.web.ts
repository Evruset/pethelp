import { ApiError,kindForStatus } from '@/api/errors';
import type { AuthApi,OtpChallenge,OwnerSessionResult } from './auth-api';
import { WEB_SESSION_CREDENTIAL } from '@/session/secure-session-store.web';

async function command<T>(path:string,body:unknown,signal?:AbortSignal):Promise<T>{
  const response=await fetch(`/api/owner/${path}`,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal});
  const value=await response.json().catch(()=>({}));
  if(!response.ok){const item=value as {code?:unknown;retryAt?:unknown;attemptsRemaining?:unknown};throw new ApiError(kindForStatus(response.status),'Auth request failed.',response.status,undefined,typeof item.code==='string'?item.code:undefined,typeof item.retryAt==='string'?item.retryAt:undefined,Number.isInteger(item.attemptsRemaining)?Number(item.attemptsRemaining):undefined)}
  return value as T;
}
export const authApi:AuthApi={requestOtp:(phone,signal)=>command<OtpChallenge>('v1/auth/otp/request',{phone},signal),resendOtp:(challengeId,signal)=>command<OtpChallenge>('v1/auth/otp/resend',{challengeId},signal),async verifyOtp(challengeId,code,signal){const value=await command<Omit<OwnerSessionResult,'sessionToken'>>('v1/auth/otp/verify',{challengeId,code},signal);return{...value,sessionToken:WEB_SESSION_CREDENTIAL}}};
export const createAuthApi=()=>authApi;

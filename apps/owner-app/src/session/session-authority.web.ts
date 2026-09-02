import { ApiError } from '@/api/errors';
import type { EffectiveOwnerSession,SessionAuthority } from './session-authority';

async function read():Promise<EffectiveOwnerSession>{const response=await fetch('/api/owner/v1/auth/session',{credentials:'same-origin',cache:'no-store'});if(response.status===401)throw new ApiError('UNAUTHORIZED','Session expired.',401);if(!response.ok)throw new ApiError('NETWORK','Session validation unavailable.',response.status);const value=await response.json() as {subjectId?:unknown;roles?:unknown};if(typeof value.subjectId!=='string'||!Array.isArray(value.roles)||!value.roles.includes('OWNER'))throw new ApiError('UNEXPECTED_RESPONSE','Invalid session response.');return{subjectId:value.subjectId,roles:value.roles.filter((role):role is string=>typeof role==='string')}}
export const sessionAuthority:SessionAuthority={validate:async()=>read(),revoke:async()=>{const response=await fetch('/api/owner/v1/auth/logout',{method:'POST',credentials:'same-origin'});if(!response.ok&&response.status!==401)throw new ApiError('NETWORK','Logout outcome unknown.',response.status)}};
export const createSessionAuthority=()=>sessionAuthority;

import {createRequire} from 'node:module';
import {createHmac,randomUUID} from 'node:crypto';
import {syntheticEnv} from './env.mjs';
const require=createRequire(import.meta.url);
const {connect,NS,nativeDataset}=require('../../backend/scripts/seed-local-multi-clinic.cjs');
export const base='http://127.0.0.1:3310';
export async function account(login){const c=await connect();try{const r=await c.query("SELECT payload FROM synthetic_fixture.raw WHERE namespace=$1 AND kind='accounts' AND payload->>'login'=$2",[NS,login]);if(r.rowCount!==1)throw Error('UNKNOWN_FIXTURE_LOGIN');return nativeDataset({accounts:[r.rows[0].payload]}).accounts[0];}finally{await c.end();}}
export async function credential(a){
 a=await account(a.login); // Fixture allowlist, DB/environment guard, exact stored scopes.
 if(a.role==='OWNER'){
  require('../../backend/node_modules/reflect-metadata');const {DatabaseService}=require('../../backend/dist/src/database/database.service');const {OwnerAuthService}=require('../../backend/dist/src/auth/owner-auth.service');const db=new DatabaseService();
  try{const service=new OwnerAuthService(db,null,null);return await db.withTransaction(async c=>{const session=await service.createSession(c,a.owner_id,'local synthetic CLI fixture');await c.query("INSERT INTO audit_schema.audit_log(actor_type,actor_id,action,aggregate_type,aggregate_id,payload_json) VALUES('OWNER',$1::text,'synthetic.local_session.created','owner_identity',$1::uuid,'{\"method\":\"LOCAL_FIXTURE_NOT_OTP\"}')",[a.owner_id]);return {token:session.token,expiresAt:session.expiresAt.toISOString(),userId:a.owner_id};});}finally{await db.onModuleDestroy();}
 }
 const role=({VETERINARIAN:'CLINIC_VETERINARIAN',RECEPTIONIST:'CLINIC_RECEPTIONIST'})[a.role]||a.role;
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const now=Math.floor(Date.now()/1000);
 const head=enc({alg:'HS256',typ:'JWT'}),payload=enc({sub:a.account_id,roles:[role],clinicIds:[a.clinic_id],locationIds:[a.location_id],iat:now,exp:now+7200,iss:syntheticEnv.JWT_ISSUER,aud:syntheticEnv.JWT_AUDIENCE});
 const input=`${head}.${payload}`;return {token:`${input}.${createHmac('sha256',syntheticEnv.JWT_SECRET).update(input).digest('base64url')}`,expiresAt:new Date((now+7200)*1000).toISOString(),userId:a.account_id};
}
export async function api(path,session,method='GET',body,version,key=randomUUID()){
 const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${session.token}`,'Content-Type':'application/json',...(method!=='GET'?{'Idempotency-Key':key,'X-Correlation-ID':randomUUID()}:{}),...(version?{'If-Match':String(version)}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const text=await r.text();let json;try{json=JSON.parse(text);}catch{json={text:text.slice(0,100)}}return {status:r.status,json};
}

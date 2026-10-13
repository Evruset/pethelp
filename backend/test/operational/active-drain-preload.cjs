/* Test-only process instrumentation. Never registered by production startup. */
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
if(process.env.NODE_ENV!=='test'||process.env.W4B03A04_ACCEPTANCE!=='true'||!(()=>{try{const u=new URL(process.env.DATABASE_URL);return u.hostname==='postgres'&&/^\/vethelp_w4b03a04_[a-z]+$/.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}})())throw new Error('EXCLUSIVE_ACTIVE_DRAIN_FIXTURE_REQUIRED');
const control='/owned-control',mode=process.env.DRAIN_TEST_MODE;
function marker(name){fs.writeFileSync(path.join(control,name+'.json'),JSON.stringify({event:name,at:Date.now(),pid:process.pid})+'\n');}
async function wait(name,signal){while(!fs.existsSync(path.join(control,name))){if(signal?.aborted){marker('PROVIDER_ABORTED');throw new Error('TEST_CONSUMER_CANCELLED');}await new Promise(r=>setTimeout(r,25));}}
const {TestOnlyByteOcrAdapter}=require('/workspace/backend/dist/src/auth/ocr-byte-adapter.js');
const {OcrProvider}=require('/workspace/backend/dist/src/auth/ocr-provider.js');
class Consumer extends TestOnlyByteOcrAdapter{
 async extractVerified(input,signal){marker('PROVIDER_ACTIVE');if(mode==='provider-blocked'||mode==='provider-gated'||mode==='expired-stalled')await wait('release-provider',signal);return this.consume(input,signal,async chunks=>{const h=createHash('sha256');let n=0;for await(const c of chunks){h.update(c);n+=c.length;}marker('BYTES_CONSUMED');return{extraction:{text:'SYNTHETIC_ACTIVE_DRAIN_TEST_TEXT',provider:'TEST_BYTE_CONSUMER'},consumedLength:n,consumedSha256:h.digest('hex')};});}
}
OcrProvider.prototype.extractVerified=function(input,signal){return new Consumer().extractVerified(input,signal);};
if(mode==='commit-gated'||mode==='commit-kill'){
 const {Client}=require('pg'),original=Client.prototype.query;
 Client.prototype.query=function(text,...args){const sql=typeof text==='string'?text:text?.text;
  if(sql?.startsWith('INSERT INTO pet_schema.ocr_results'))this.__drainResultTransaction=true;
  if(sql==='COMMIT'&&this.__drainResultTransaction){this.__drainResultTransaction=false;marker('PRE_COMMIT');return wait('release-commit').then(()=>original.call(this,text,...args));}
  return original.call(this,text,...args);
 };
}
marker('TEST_HOOK_INSTALLED');

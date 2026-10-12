/* Test-only persistent filesystem observation; explicitly NOT startup eligibility. */
require('reflect-metadata');
const u=new URL(process.env.DATABASE_URL||'');
if(process.env.NODE_ENV!=='test'||process.env.W4B03A04_ACCEPTANCE!=='true'||u.hostname!=='postgres'||u.pathname!=='/vethelp_w4b03a04_restored')throw Error('OWNED_RESTORE_REQUIRED');
const {DatabaseService}=require('/workspace/backend/dist/src/database/database.service.js');
const {reconcileOperationalSources,verifyOperationalMount}=require('/workspace/backend/dist/src/auth/ocr-operational-preflight.js');
(async()=>{const db=new DatabaseService();try{let mountAccepted=true;try{await verifyOperationalMount('worker');}catch{mountAccepted=false;}
 const rows=(await db.query("SELECT session_user name,pg_has_role(session_user,'vethelp_ocr_byte_executor','MEMBER') executor,has_any_column_privilege(session_user,'pet_schema.pets','INSERT,UPDATE') petWrite")).rows[0];if(rows.name!=='ocr_reader_test'||rows.executor||rows.petWrite)throw Error('OWNED_READONLY_IDENTITY_REQUIRED');
 const r=await reconcileOperationalSources(db);console.log(JSON.stringify({observation:'PERSISTENT_REHASH_ONLY_NOT_PROCESSING_ELIGIBILITY',verifiedBytes:r.verifiedEligible,provenanceReconciled:r.provenanceReconciled,operationalMountAccepted:mountAccepted,productionReadiness:'NOT_VERIFIED',powerLossProof:false}));
}finally{await db.onModuleDestroy();}})().catch(()=>{console.error('PERSISTENT_REHASH_DENIED');process.exitCode=1;});

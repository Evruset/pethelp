const {spawnSync}=require('node:child_process');
const {resolve}=require('node:path');
const {BASE_DATABASE,isFixtureDatabase}=require('./fixture-database.cjs');
function resetOptions(args,namespace,sourceName){
 if(args.length!==2||args[0]!==`--confirm-namespace=${namespace}`||!args[1].startsWith('--new-database='))throw Error('RESET_CONFIRMATION_REQUIRED: --confirm-namespace=NAMESPACE --new-database=synthetic_multiclinic_v4_r_12hex');
 const target=args[1].slice('--new-database='.length);
 if(target===sourceName||target===BASE_DATABASE||!isFixtureDatabase(target))throw Error('RESET_REQUIRES_NEW_SYNTHETIC_GENERATION');
 return target;
}
async function resetFixture(archive,data,args,{NS,guard,connect}){
 const sourceUrl=guard(),sourceName=sourceUrl.pathname.slice(1),target=resetOptions(args,NS,sourceName);
 // Tighten resource identity for the CREATE DATABASE capability, not just its name.
 if(sourceUrl.port!=='55484'||sourceUrl.username!=='product_demo')throw Error('RESET_REQUIRES_TEST_OWNED_POSTGRES');
 const c=await connect();let created=false;
 try{
  await c.query('SELECT pg_advisory_lock(hashtext($1))',[NS]);
  const source=await c.query('SELECT archive_sha256 FROM synthetic_fixture.sources WHERE namespace=$1',[NS]);
  if(source.rowCount!==1||source.rows[0].archive_sha256!==data._sha256)throw Error('RESET_SOURCE_NAMESPACE_NOT_PROVEN');
  if((await c.query('SELECT 1 FROM pg_database WHERE datname=$1',[target])).rowCount)throw Error('RESET_TARGET_ALREADY_EXISTS');
  // Validated identifier; never clone sessions, holds, audit, unrelated rows or credentials.
  await c.query(`CREATE DATABASE "${target}" TEMPLATE template0`);created=true;
  const targetUrl=new URL(sourceUrl);targetUrl.pathname='/'+target;
  const env={...process.env,DATABASE_URL:targetUrl.toString(),SYNTHETIC_DATABASE_NAME:target};
  const backend=resolve(__dirname,'../..');
  const run=(file,argv)=>{const r=spawnSync(process.execPath,[file,...argv],{cwd:backend,env,stdio:'inherit'});if(r.status!==0)throw Error('RESET_NEW_GENERATION_STEP_FAILED: '+file);};
  run('node_modules/node-pg-migrate/bin/node-pg-migrate.js',['up','--migrations-dir','migrations/node-pg','--migrations-schema','public','--migrations-table','schema_migrations','--single-transaction']);
  run('scripts/verify-migration-checksums.cjs',['--write-missing']);
  run('scripts/seed-local-multi-clinic.cjs',['seed',archive]);
  run('scripts/seed-local-multi-clinic.cjs',['verify',archive]);
  console.log(JSON.stringify({RESET_FIXTURE:'PASS_NON_DESTRUCTIVE',namespace:NS,previousDatabase:sourceName,newDatabase:target,previousDatabasePreserved:true,automaticSwitch:false,launch:`SYNTHETIC_DATABASE_NAME=${target} node dev/synthetic-multi-clinic/start.mjs`}));
 }catch(e){if(created)console.error(JSON.stringify({RESET_FIXTURE:'FAILED_NEW_GENERATION_RETAINED',newDatabase:target,previousDatabasePreserved:true,automaticSwitch:false}));throw e;}
 finally{await c.end();}
}
module.exports={resetOptions,resetFixture};

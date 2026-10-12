import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { demoEnv } from './demo-env.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env={...process.env,...demoEnv};
function run(command,args){const result=spawnSync(command,args,{cwd:resolve(root,'backend'),env,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
run('npm',['run','migrate:up']);
run('npm',['run','build']);
run(process.execPath,[resolve(root,'dev/product-batch01/seed.cjs')]);

import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {syntheticEnv} from './env.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const args=process.argv.slice(2);const backend=args[0]==='--backend';if(backend)args.shift();
const result=spawnSync(process.execPath,args.length?args:['backend/scripts/seed-local-multi-clinic.cjs','validate',`${process.env.HOME}/Downloads/VetHelp_Synthetic_25_Clinics_Dataset.zip`],{cwd:backend?resolve(root,'backend'):root,env:{...process.env,...syntheticEnv},stdio:'inherit'});
process.exitCode=result.status??1;

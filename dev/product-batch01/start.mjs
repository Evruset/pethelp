import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { demoEnv } from './demo-env.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const children=[];
function start(directory, file, args, extra={}) {
 const child=spawn(process.execPath,[file,...args],{cwd:resolve(root,directory),env:{...process.env,...demoEnv,...extra},stdio:'inherit'});
 children.push(child); child.on('exit',code=>{if(code && !stopping){console.error(`${directory} exited: ${code}`);stop();process.exitCode=code;}});
}
let stopping=false;
function stop(){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
start('backend','dist/src/main.js',[]);
start('apps/clinic-portal','node_modules/next/dist/bin/next',['start','-H','127.0.0.1','-p','3318'],{
 VETHELP_API_BASE_URL:'http://127.0.0.1:3308',VETHELP_CLINIC_JWT_SECRET:demoEnv.JWT_SECRET,
 PORTAL_V50_SHELL:'true',CLINIC_V50_WORKSPACE_HOME:'true',VETHELP_CLINIC_PATIENTS_REGISTRY:'true',VETHELP_CLINIC_APPOINTMENTS_REGISTRY:'true',NEXT_TELEMETRY_DISABLED:'1',
});
start('apps/owner-app','node_modules/expo/bin/cli',['start','--web','--port','8088','--host','localhost'],{EXPO_PUBLIC_API_BASE_URL:'http://127.0.0.1:3308',CI:'1',EXPO_NO_TELEMETRY:'1'});
console.log('DEMO only: Owner http://localhost:8088 — Clinic http://127.0.0.1:3318 — backend http://127.0.0.1:3308. Ctrl+C stops processes and preserves test DB.');

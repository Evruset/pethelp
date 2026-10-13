import {spawn} from 'node:child_process';
import {dirname,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {syntheticEnv} from './env.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),children=[];let stopping=false;
function start(dir,file,args,extra={}){const c=spawn(process.execPath,[file,...args],{cwd:resolve(root,dir),env:{...process.env,...syntheticEnv,...extra},stdio:'inherit'});children.push(c);c.on('exit',code=>{if(code&&!stopping){stop();process.exitCode=code;}});}
function stop(){stopping=true;for(const c of children)c.kill('SIGTERM');}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
start('backend','dist/src/main.js',[]);
// Reuse the accepted built client; environment points its BFF at this isolated backend.
start('apps/clinic-portal','node_modules/next/dist/bin/next',['start','-H','127.0.0.1','-p','3320'],{VETHELP_API_BASE_URL:'http://127.0.0.1:3310',VETHELP_CLINIC_JWT_SECRET:syntheticEnv.JWT_SECRET,PORTAL_V50_SHELL:'true',CLINIC_V50_WORKSPACE_HOME:'true',NEXT_TELEMETRY_DISABLED:'1'});
start('apps/owner-app','node_modules/expo/bin/cli',['start','--web','--port','8090','--host','localhost'],{EXPO_PUBLIC_API_BASE_URL:'http://127.0.0.1:3310',CI:'1',EXPO_NO_TELEMETRY:'1'});
console.log('SYNTHETIC ONLY: Owner localhost:8090, Clinic 127.0.0.1:3320, Backend 127.0.0.1:3310; no external transports.');

import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const root=resolve(fileURLToPath(new URL('.',import.meta.url)),'../..');
const app=join(root,'apps/owner-app');
const appRequire=createRequire(join(app,'package.json'));
const output=join(root,'docs/testing/evidence/s11-owner-availability');
const temporary=await mkdtemp(join(tmpdir(),'vethelp-s11-visual-'));
await mkdir(output,{recursive:true});
console.log('Preparing Owner availability visual bundle');

const entry=join(temporary,'entry.tsx');
await writeFile(entry,`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {AvailabilityScreen} from '${join(app,'src/clinics/AvailabilityScreen.tsx')}';
const context={clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',serviceId:'33333333-3333-4333-8333-333333333333'};
createRoot(document.getElementById('root')!).render(<AvailabilityScreen authorityGeneration="visual-evidence" context={context} onBack={()=>{}} onContinue={()=>{}}/>);
`);

const slot=(id,time)=>({slotId:id,startsAt:'2026-08-14T08:00:00.000Z',endsAt:'2026-08-14T08:30:00.000Z',localDate:'2026-08-14',localTime:time,expectedVersion:2});
const content={observedAt:'2026-08-13T08:00:00.000Z',clinicName:'Ветеринарный центр «Лапа»',serviceName:'Первичный приём',timezone:'Europe/Moscow',horizonEndsAt:'2026-08-27T08:00:00.000Z',slots:[slot('44444444-4444-4444-8444-444444444444','11:00'),slot('55555555-5555-4555-8555-555555555555','12:30'),{...slot('66666666-6666-4666-8666-666666666666','09:30'),startsAt:'2026-08-15T06:30:00.000Z',endsAt:'2026-08-15T07:00:00.000Z',localDate:'2026-08-15'}]};

await build({entryPoints:[entry],outfile:join(temporary,'bundle.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',absWorkingDir:app,nodePaths:[join(app,'node_modules')],banner:{js:'globalThis.process={env:{NODE_ENV:"production"}};'},define:{'process.env.NODE_ENV':'"production"'},alias:{'react-native':resolve(appRequire.resolve('react-native-web/package.json'),'..')},plugins:[{
  name:'vethelp-visual-seams',setup(buildApi){
    buildApi.onResolve({filter:/^@\/session\/SessionProvider$/},()=>({path:'session',namespace:'visual'}));
    buildApi.onResolve({filter:/^@tanstack\/react-query$/},()=>({path:'query',namespace:'visual'}));
    buildApi.onResolve({filter:/^@\//},args=>{const base=join(app,'src',args.path.slice(2));const path=['.tsx','.ts','.jsx','.js'].map(ext=>base+ext).find(existsSync)??base;return {path};});
    buildApi.onLoad({filter:/.*/,namespace:'visual'},args=>args.path==='session'?{loader:'js',contents:'export const useSession=()=>({session:{cacheScope:"visual-owner",opaqueCredential:"visual-only"}});'}:{loader:'js',contents:`const slot=(id,time)=>({slotId:id,startsAt:'2026-08-14T08:00:00.000Z',endsAt:'2026-08-14T08:30:00.000Z',localDate:'2026-08-14',localTime:time,expectedVersion:2});const full=${JSON.stringify(content)};export const useQuery=()=>{const data=location.hash==='#empty'?{...full,slots:[]}:full;return {isPending:false,isError:false,data,refetch:async()=>({isError:false,data})};};`});
  }
}]});
await writeFile(join(temporary,'index.html'),'<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;min-height:100%;background:#f7f8fa}body{font-family:system-ui,-apple-system,sans-serif}#root{display:flex;justify-content:center;max-width:1100px;margin:auto}</style><div id="root"></div><script src="/bundle.js"></script></html>');

const server=createServer(async(req,res)=>{const file=req.url==='/bundle.js'?'bundle.js':'index.html';res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(join(temporary,file)));});
await new Promise(resolveReady=>server.listen(0,'127.0.0.1',resolveReady));
const port=server.address().port;const browser=await chromium.launch({headless:true});
console.log(`Visual renderer ready on ${port}`);
const cases=[
  {name:'compact-content',width:375,height:812},
  {name:'standard-selected',width:390,height:844,select:'11:00'},
  {name:'wide-empty',width:1024,height:768,hash:'#empty'},
];
const records=[];
try{
  for(const item of cases){console.log(`Capturing ${item.name}`);const page=await browser.newPage({viewport:{width:item.width,height:item.height},deviceScaleFactor:1});page.setDefaultTimeout(5000);page.on('console',message=>console.log(`browser:${message.type()}:${message.text()}`));page.on('pageerror',error=>console.error(`browser:error:${error.message}`));await page.goto(`http://127.0.0.1:${port}/${item.hash??''}`);await page.getByRole('heading',{name:'Доступное время'}).waitFor();if(item.select)await page.getByText(item.select,{exact:true}).click();const path=join(output,`${item.name}.png`);await page.screenshot({path,fullPage:true});const bytes=await readFile(path);records.push({...item,file:`${item.name}.png`,sha256:createHash('sha256').update(bytes).digest('hex')});await page.close();}
}finally{await browser.close();await new Promise(resolveClose=>server.close(resolveClose));}
const source=await readFile(join(app,'src/clinics/AvailabilityScreen.tsx'));
await writeFile(join(output,'manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),source:'apps/owner-app/src/clinics/AvailabilityScreen.tsx',sourceSha256:createHash('sha256').update(source).digest('hex'),renderer:'react-native-web production component bundle; controlled query/session test seam',physicalDevice:false,cases:records},null,2)+'\n');
console.log(`Captured ${records.length} Owner availability states in ${output}`);

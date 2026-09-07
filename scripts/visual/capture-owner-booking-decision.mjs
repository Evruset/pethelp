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

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const app = join(root, 'apps/owner-app');
const appRequire = createRequire(join(app, 'package.json'));
const output = join(root, 'docs/testing/evidence/s14-owner-booking-decision');
const temporary = await mkdtemp(join(tmpdir(), 'vethelp-s14-owner-visual-'));
await mkdir(output, { recursive: true });

const ids = { petId:'11111111-1111-4111-8111-111111111111', clinicId:'22222222-2222-4222-8222-222222222222', locationId:'33333333-3333-4333-8333-333333333333', serviceId:'44444444-4444-4444-8444-444444444444', slotId:'55555555-5555-4555-8555-555555555555', holdId:'66666666-6666-4666-8666-666666666666' };
const base = { holdId:ids.holdId, slotId:ids.slotId, status:'PENDING_CONFIRMATION', statusCode:'PENDING_CONFIRMATION', canCancel:true, statusTitle:'Клиника подтверждает запись', safeDescription:'Ожидаем подтверждение.', nextActionCode:'WAIT', confirmationMode:'MANUAL', expiresAt:'2026-08-20T11:15:00.000Z', serverNow:'2026-08-20T11:00:00.000Z', aggregateVersion:1, lastUpdatedAt:'2026-08-20T11:00:00.000Z', pet:{id:ids.petId,name:'Барсик',species:'CAT'}, clinic:{id:ids.clinicId,name:'Ветеринарный центр «Лапа»'}, location:{id:ids.locationId,address:'Москва, ул. Ветеринарная, 1'}, service:{id:ids.serviceId,name:'Первичный приём'}, doctor:null, slot:{startsAt:'2026-08-21T08:00:00.000Z',endsAt:'2026-08-21T08:30:00.000Z',timezone:'Europe/Moscow'}, clinicLocationId:ids.locationId, startsAt:'2026-08-21T08:00:00.000Z', endsAt:'2026-08-21T08:30:00.000Z' };
const entry = join(temporary, 'entry.tsx');
await writeFile(entry, `import React from 'react';import{createRoot}from'react-dom/client';import{BookingStatusScreen}from'${join(app,'src/booking/BookingStatusScreen.tsx')}';createRoot(document.getElementById('root')!).render(<BookingStatusScreen holdId="${ids.holdId}" authorityGeneration="visual" onClose={()=>{}}/>);`);

await build({
  entryPoints:[entry], outfile:join(temporary,'bundle.js'), bundle:true, platform:'browser', format:'iife', jsx:'automatic', absWorkingDir:app,
  nodePaths:[join(app,'node_modules')], banner:{js:'globalThis.process={env:{NODE_ENV:"production"}};'}, define:{'process.env.NODE_ENV':'"production"'},
  alias:{'react-native':resolve(appRequire.resolve('react-native-web/package.json'),'..'),'react-native-safe-area-context':join(root,'scripts/visual/safe-area-web.ts')},
  plugins:[{name:'seams',setup(api){
    api.onResolve({filter:/^@\/session\/SessionProvider$/},()=>({path:'session',namespace:'v'}));
    api.onResolve({filter:/^\.\/booking-api$/},args=>args.importer.endsWith('BookingStatusScreen.tsx')?({path:'booking',namespace:'v'}):null);
    api.onResolve({filter:/^@\//},args=>{const basePath=join(app,'src',args.path.slice(2));return{path:['.tsx','.ts','.jsx','.js'].map(ext=>basePath+ext).find(existsSync)??basePath};});
    api.onLoad({filter:/.*/,namespace:'v'},args=>{
      if(args.path==='session')return{loader:'js',contents:'export const useSession=()=>({session:{cacheScope:"11111111-1111-4111-8111-111111111111",opaqueCredential:"visual"}});'};
      const confirmed={...base,status:'CONFIRMED',statusCode:'CONFIRMED',statusTitle:'Запись подтверждена',safeDescription:'Клиника подтвердила выбранное время.',nextActionCode:'VIEW_APPOINTMENT',aggregateVersion:2};
      const rejected={...base,status:'REJECTED',statusCode:'REJECTED',statusTitle:'Клиника не подтвердила запись',safeDescription:'Выберите другое доступное время.',nextActionCode:'CHOOSE_ANOTHER_SLOT',aggregateVersion:2};
      const near={...base,serverNow:'2026-08-20T11:14:20.000Z'};
      const expired={...base,status:'EXPIRED',statusCode:'EXPIRED',canCancel:false,statusTitle:'Клиника не успела подтвердить запись',safeDescription:'Это время больше не удерживается. Выберите другое доступное время.',nextActionCode:'CHOOSE_ANOTHER_SLOT',aggregateVersion:2,serverNow:'2026-08-20T11:15:01.000Z'};
      return{loader:'js',contents:`import{ApiError}from'@/api/errors';const states={pending:${JSON.stringify(base)},near:${JSON.stringify(near)},confirmed:${JSON.stringify(confirmed)},rejected:${JSON.stringify(rejected)},expired:${JSON.stringify(expired)}};export const bookingApi={read:async()=>{const state=location.hash.slice(1)||'pending';if(state==='network')throw new ApiError('NETWORK','offline');if(state==='stale')throw new Error('INVALID_BOOKING_SNAPSHOT');return states[state]}};`};
    });
  }}],
});
await writeFile(join(temporary,'index.html'),'<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;min-height:100%;background:#f7f8fa}body{font-family:system-ui,-apple-system,sans-serif}#root{display:flex;justify-content:center;max-width:1100px;margin:auto}</style><div id="root"></div><script src="/bundle.js"></script></html>');
const server=createServer(async(req,res)=>{const file=req.url==='/bundle.js'?'bundle.js':'index.html';res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(join(temporary,file)));});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const port=server.address().port;
const browser=await chromium.launch({headless:true});
const cases=[
  {name:'compact-pending',width:390,height:844,state:'pending',heading:'Клиника подтверждает запись'},
  {name:'compact-near-expiry',width:430,height:932,state:'near',heading:'Клиника подтверждает запись'},
  {name:'tablet-confirmed',width:768,height:1024,state:'confirmed',heading:'Запись подтверждена'},
  {name:'compact-rejected',width:390,height:844,state:'rejected',heading:'Клиника не сможет принять в выбранное время'},
  {name:'compact-expired',width:430,height:932,state:'expired',heading:'Клиника не успела подтвердить запись'},
  {name:'tablet-network-retry',width:768,height:1024,state:'network',heading:'Статус заявки'},
  {name:'compact-stale-payload',width:390,height:844,state:'stale',heading:'Статус заявки'},
];
const records=[];
try{for(const item of cases){const page=await browser.newPage({viewport:{width:item.width,height:item.height},deviceScaleFactor:1});await page.goto(`http://127.0.0.1:${port}/#${item.state}`);await page.getByText(item.heading,{exact:true}).first().waitFor();const path=join(output,`${item.name}.png`);await page.screenshot({path,fullPage:false});records.push({...item,file:`${item.name}.png`,sha256:createHash('sha256').update(await readFile(path)).digest('hex')});await page.close();}}finally{await browser.close();await new Promise(done=>server.close(done));}
const sources=['apps/owner-app/src/booking/BookingStatusScreen.tsx','scripts/visual/capture-owner-booking-decision.mjs','prototype-v50/manifest.json','prototype-v50/index.html','prototype-v50/styles/115-clinic-role-layout-v50.css'];
await writeFile(join(output,'manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),sources:Object.fromEntries(await Promise.all(sources.map(async source=>[source,createHash('sha256').update(await readFile(join(root,source))).digest('hex')]))),renderer:'RN_WEB_EVIDENCE_RENDERER: react-native-web production component bundle; controlled session/API seams',physicalDevice:false,productSemantics:'MANUAL_CONFIRM → PENDING_CONFIRMATION → 15-minute PostgreSQL-authoritative deadline → CONFIRMED | REJECTED | EXPIRED',cases:records},null,2)+'\n');
console.log('Captured S14 Owner booking decision visual evidence: 7/7');

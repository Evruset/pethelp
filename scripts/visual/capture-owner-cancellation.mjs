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
const output=join(root,'docs/testing/evidence/s16-owner-cancellation');
const temporary=await mkdtemp(join(tmpdir(),'vethelp-s16-owner-visual-'));
await mkdir(output,{recursive:true});
const ids={petId:'11111111-1111-4111-8111-111111111111',clinicId:'22222222-2222-4222-8222-222222222222',locationId:'33333333-3333-4333-8333-333333333333',serviceId:'44444444-4444-4444-8444-444444444444',slotId:'55555555-5555-4555-8555-555555555555',holdId:'66666666-6666-4666-8666-666666666666'};
const base={holdId:ids.holdId,slotId:ids.slotId,status:'PENDING_CONFIRMATION',statusCode:'PENDING_CONFIRMATION',statusTitle:'Ожидаем подтверждения',safeDescription:'Клиника проверяет возможность записи.',nextActionCode:'WAIT',confirmationMode:'MANUAL',expiresAt:'2026-08-21T12:00:00.000Z',serverNow:'2026-08-21T11:00:00.000Z',aggregateVersion:1,lastUpdatedAt:'2026-08-21T11:00:00.000Z',canCancel:true,pet:{id:ids.petId,name:'Барсик',species:'CAT'},clinic:{id:ids.clinicId,name:'Ветеринарный центр «Лапа»'},location:{id:ids.locationId,address:'Москва, ул. Ветеринарная, 1'},service:{id:ids.serviceId,name:'Первичный приём'},doctor:null,slot:{startsAt:'2026-08-22T08:00:00.000Z',endsAt:'2026-08-22T08:30:00.000Z',timezone:'Europe/Moscow'},clinicLocationId:ids.locationId,startsAt:'2026-08-22T08:00:00.000Z',endsAt:'2026-08-22T08:30:00.000Z'};
const entry=join(temporary,'entry.tsx');
await writeFile(entry,`import React from 'react';import{createRoot}from'react-dom/client';import{BookingStatusScreen}from'${join(app,'src/booking/BookingStatusScreen.tsx')}';import{ConfirmationModal}from'${join(app,'src/ui/primitives.tsx')}';const dialog=location.hash==='#dialog';createRoot(document.getElementById('root')!).render(dialog?<ConfirmationModal visible title="Отменить запись?" body="После отмены это время снова станет доступно для записи." confirmLabel="Отменить запись" cancelLabel="Не отменять" onConfirm={()=>{}} onCancel={()=>{}}/>:<BookingStatusScreen holdId="${ids.holdId}" authorityGeneration="visual" onClose={()=>{}}/>);`);
await build({entryPoints:[entry],outfile:join(temporary,'bundle.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',absWorkingDir:app,nodePaths:[join(app,'node_modules')],banner:{js:'globalThis.process={env:{NODE_ENV:"production"}};'},define:{'process.env.NODE_ENV':'"production"'},alias:{'react-native':resolve(appRequire.resolve('react-native-web/package.json'),'..'),'react-native-safe-area-context':join(root,'scripts/visual/safe-area-web.ts')},plugins:[{name:'seams',setup(api){
  api.onResolve({filter:/^@\/session\/SessionProvider$/},()=>({path:'session',namespace:'v'}));
  api.onResolve({filter:/^\.\/booking-api$/},args=>args.importer.endsWith('BookingStatusScreen.tsx')?({path:'booking',namespace:'v'}):null);
  api.onResolve({filter:/^@\//},args=>{const basePath=join(app,'src',args.path.slice(2));return{path:['.tsx','.ts','.jsx','.js'].map(ext=>basePath+ext).find(existsSync)??basePath};});
  api.onLoad({filter:/.*/,namespace:'v'},args=>{
    if(args.path==='session')return{loader:'js',contents:'export const useSession=()=>({session:{cacheScope:"11111111-1111-4111-8111-111111111111",opaqueCredential:"visual"}});'};
    const confirmed={...base,status:'CONFIRMED',statusCode:'CONFIRMED',statusTitle:'Запись подтверждена',safeDescription:'Клиника подтвердила выбранное время.',nextActionCode:'VIEW_APPOINTMENT',aggregateVersion:2};
    const cancelled={...base,status:'CANCELLED',statusCode:'CANCELLED',statusTitle:'Запись отменена',safeDescription:'Эта заявка больше не активна.',nextActionCode:'CHOOSE_ANOTHER_SLOT',aggregateVersion:2,canCancel:false};
    return{loader:'js',contents:`import{ApiError}from'@/api/errors';const pending=${JSON.stringify(base)},confirmed=${JSON.stringify(confirmed)},cancelled=${JSON.stringify(cancelled)};let reads=0;export const bookingApi={read:async()=>{reads++;const state=location.hash.slice(1)||'pending';if(state==='cancelled')return cancelled;if(state==='conflict')return confirmed;return pending;},cancel:async()=>{const state=location.hash.slice(1);if(state==='submitting')return new Promise(()=>{});if(state==='conflict')throw new ApiError('CONFLICT','conflict',409,undefined,'BOOKING_STATE_CONFLICT');return {holdId:pending.holdId,slotId:pending.slotId,status:'CANCELLED',correlationId:'77777777-7777-4777-8777-777777777777',aggregateVersion:2,lastUpdatedAt:'2026-08-21T11:01:00.000Z',serverNow:'2026-08-21T11:01:00.000Z'};}};`};
  });
}}]});
await writeFile(join(temporary,'index.html'),'<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;min-height:100%;background:#f7f8fa}body{font-family:system-ui,-apple-system,sans-serif}#root{display:flex;justify-content:center;max-width:720px;margin:auto}</style><div id="root"></div><script src="/bundle.js"></script></html>');
const server=createServer(async(req,res)=>{const file=req.url==='/bundle.js'?'bundle.js':'index.html';res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(join(temporary,file)));});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const port=server.address().port;const browser=await chromium.launch({headless:true});
const cases=[
  {name:'compact-cancellable-pending',width:375,height:812,state:'pending',wait:'Отменить запись'},
  {name:'compact-confirmation',width:375,height:812,state:'dialog',wait:'Отменить запись?'},
  {name:'compact-submitting',width:375,height:812,state:'submitting',action:'submit',wait:'Проверяем результат отмены…'},
  {name:'compact-cancelled',width:375,height:812,state:'cancelled',wait:'Запись отменена'},
  {name:'wide-stale-conflict',width:1024,height:768,state:'conflict',action:'submit',wait:'Статус записи изменился. Мы показали последние данные — проверьте их перед новой попыткой.'},
];
const records=[];
try{for(const item of cases){const page=await browser.newPage({viewport:{width:item.width,height:item.height},deviceScaleFactor:1});await page.goto(`http://127.0.0.1:${port}/#${item.state}`);await page.getByText('Отменить запись',{exact:true}).first().waitFor().catch(()=>{});if(item.action){await page.getByText('Отменить запись',{exact:true}).first().click();if(item.action==='submit')await page.getByText('Отменить запись',{exact:true}).last().click();}await page.getByText(item.wait,{exact:true}).first().waitFor();if(item.name==='compact-confirmation')await page.waitForTimeout(450);if(item.name==='wide-stale-conflict'){await page.getByText('Отменить запись?',{exact:true}).waitFor({state:'hidden'});await page.waitForTimeout(100);}const path=join(output,`${item.name}.png`);await page.screenshot({path,fullPage:!item.action});records.push({...item,file:`${item.name}.png`,sha256:createHash('sha256').update(await readFile(path)).digest('hex')});await page.close();}}finally{await browser.close();await new Promise(done=>server.close(done));}
const source='apps/owner-app/src/booking/BookingStatusScreen.tsx';
await writeFile(join(output,'manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),source,sourceSha256:createHash('sha256').update(await readFile(join(root,source))).digest('hex'),renderer:'react-native-web production component bundle; controlled session/API seams',physicalDevice:false,cases:records},null,2)+'\n');
console.log('Captured S16 Owner cancellation visual evidence: 5/5');

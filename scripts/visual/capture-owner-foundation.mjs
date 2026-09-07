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
const output=join(root,'docs/testing/evidence/owner-mvp-foundation');
const temporary=await mkdtemp(join(tmpdir(),'vethelp-owner-foundation-'));
await mkdir(output,{recursive:true});
const entry=join(temporary,'entry.tsx');
await writeFile(entry,`import React from'react';import{createRoot}from'react-dom/client';import Public from'${join(app,'src/app/(public)/index.tsx')}';import Home from'${join(app,'src/app/(app)/index.tsx')}';import{PetJourneyScreen}from'${join(app,'src/pets/PetJourneyScreen.tsx')}';import{ClinicCatalogScreen}from'${join(app,'src/clinics/ClinicCatalogScreen.tsx')}';import{ClinicServiceScreen}from'${join(app,'src/clinics/ClinicServiceScreen.tsx')}';const C='11111111-1111-4111-8111-111111111111',L='22222222-2222-4222-8222-222222222222';const state=location.hash.slice(1)||'welcome';const screen=state==='home'?<Home/>:state==='pet'||state==='loading'?<PetJourneyScreen/>:state==='catalog'?<ClinicCatalogScreen onClose={()=>{}} onOpenClinic={()=>{}}/>:state==='service'?<ClinicServiceScreen clinic={{clinicId:C,locationId:L}} onBack={()=>{}} onContinue={()=>{}}/>:<Public/>;createRoot(document.getElementById('root')!).render(screen);`);
const pet={petId:'33333333-3333-4333-8333-333333333333',name:'Барсик',species:'CAT'};
const clinic={clinicId:'11111111-1111-4111-8111-111111111111',locationId:'22222222-2222-4222-8222-222222222222',name:'Ветеринарный центр «Лапа»',address:'Москва, ул. Ветеринарная, 1',phone:'+7 495 000-00-00'};
const service={clinicId:clinic.clinicId,locationId:clinic.locationId,name:clinic.name,address:clinic.address,phone:clinic.phone,services:[{serviceId:'44444444-4444-4444-8444-444444444444',name:'Первичный приём',price:{kind:'INFORMATIONAL',amount:'1500.00',currency:'RUB'}}]};
await build({entryPoints:[entry],outfile:join(temporary,'bundle.js'),bundle:true,platform:'browser',format:'iife',jsx:'automatic',absWorkingDir:app,nodePaths:[join(app,'node_modules')],banner:{js:'globalThis.process={env:{NODE_ENV:"production"}};'},define:{'process.env.NODE_ENV':'"production"'},alias:{'react-native':resolve(appRequire.resolve('react-native-web/package.json'),'..'),'react-native-safe-area-context':join(root,'scripts/visual/safe-area-web.ts')},plugins:[{name:'seams',setup(api){
  api.onResolve({filter:/^@\/session\/SessionProvider$/},()=>({path:'session',namespace:'v'}));
  api.onResolve({filter:/^@\/auth\/AuthJourneyProvider$/},()=>({path:'auth',namespace:'v'}));
  api.onResolve({filter:/^@\/pets\/PetJourneyProvider$/},()=>({path:'pets',namespace:'v'}));
  api.onResolve({filter:/^\.\/PetJourneyProvider$/},()=>({path:'pets',namespace:'v'}));
  api.onResolve({filter:/^@tanstack\/react-query$/},()=>({path:'query',namespace:'v'}));
  api.onResolve({filter:/active-booking-store$/},()=>({path:'active',namespace:'v'}));
  api.onResolve({filter:/^@\//},args=>{const base=join(app,'src',args.path.slice(2));return{path:['.tsx','.ts','.jsx','.js'].map(ext=>base+ext).find(existsSync)??base};});
  api.onLoad({filter:/.*/,namespace:'v'},args=>{
    if(args.path==='session')return{loader:'js',contents:'export const useSession=()=>({status:"authenticated",session:{cacheScope:"owner-visual",opaqueCredential:"visual"},logout:async()=>{},error:null});'};
    if(args.path==='auth')return{loader:'js',contents:`const state=location.hash.slice(1);const phase=state==='phone'?'phone':state==='otp'?'otp':'idle';export const useAuthJourney=()=>({phase,phone:'+79991234567',code:'',challenge:phase==='otp'?{resendAvailableAt:new Date(Date.now()+30000).toISOString(),expiresAt:new Date(Date.now()+300000).toISOString()}:null,message:null,retryAt:null,attemptsRemaining:undefined,resumedIntent:null,setPhone:()=>{},setCode:()=>{},start:()=>{},cancel:()=>{},requestOtp:async()=>{},verifyOtp:async()=>{},resendOtp:async()=>{},consumeResumedIntent:()=>{}});`};
    if(args.path==='pets')return{loader:'js',contents:`const pet=${JSON.stringify(pet)};export const usePetJourney=()=>({active:location.hash==='#pet'||location.hash==='#loading',loading:location.hash==='#loading',error:false,pets:[pet],selectedPetId:pet.petId,continuedPetId:null,selectionStale:false,creating:false,createError:false,start:()=>{},cancel:()=>{},retry:()=>{},select:()=>{},create:async()=>{},continueWithSelection:()=>{}});`};
    if(args.path==='active')return{loader:'js',contents:'export const activeBookingStore={read:async()=>null,write:async()=>{},clear:async()=>{}};'};
    return{loader:'js',contents:`const clinic=${JSON.stringify(clinic)},service=${JSON.stringify(service)};export const useQuery=()=>({isPending:false,isError:false,data:location.hash==='#service'?service:{clinics:[clinic]},refetch:async()=>({isError:false,data:service})});export const useQueryClient=()=>({getQueryData:()=>null});`};
  });
}}]});
await writeFile(join(temporary,'index.html'),'<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;min-height:100%;background:#f3f5f7}body{font-family:system-ui,-apple-system,sans-serif}</style><div id="root"></div><script src="/bundle.js"></script></html>');
const server=createServer(async(req,res)=>{const file=req.url==='/bundle.js'?'bundle.js':'index.html';res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(join(temporary,file)));});await new Promise(done=>server.listen(0,'127.0.0.1',done));const port=server.address().port,browser=await chromium.launch({headless:true});
const cases=[
  {name:'01-welcome',state:'welcome',width:390,height:844,wait:'VetHelp'},
  {name:'02-phone-login',state:'phone',width:390,height:844,wait:'Вход'},
  {name:'03-otp',state:'otp',width:390,height:844,wait:'Введите код'},
  {name:'04-home',state:'home',width:1440,height:900,wait:'Начать запись'},
  {name:'05-pet-selection',state:'pet',width:320,height:568,wait:'Барсик'},
  {name:'06-clinic-catalog',state:'catalog',width:768,height:1024,wait:'Ветеринарный центр «Лапа»'},
  {name:'07-clinic-service',state:'service',width:430,height:932,wait:'Первичный приём'},
  {name:'15-loading',state:'loading',width:390,height:844,wait:'Загружаем питомцев'},
];
const records=[];try{for(const item of cases){const page=await browser.newPage({viewport:{width:item.width,height:item.height},deviceScaleFactor:1});await page.goto(`http://127.0.0.1:${port}/#${item.state}`);await page.getByText(item.wait,{exact:true}).first().waitFor();const file=`${item.name}.png`,path=join(output,file);await page.screenshot({path,fullPage:true});records.push({...item,file,sha256:createHash('sha256').update(await readFile(path)).digest('hex')});await page.close();}}finally{await browser.close();await new Promise(done=>server.close(done));}
const sources=['apps/owner-app/src/app/(public)/index.tsx','apps/owner-app/src/app/(app)/index.tsx','apps/owner-app/src/pets/PetJourneyScreen.tsx','apps/owner-app/src/clinics/ClinicCatalogScreen.tsx','apps/owner-app/src/clinics/ClinicServiceScreen.tsx'];
await writeFile(join(output,'manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),sources:Object.fromEntries(await Promise.all(sources.map(async source=>[source,createHash('sha256').update(await readFile(join(root,source))).digest('hex')]))),renderer:'react-native-web production components; controlled local seams',physicalDevice:false,cases:records},null,2)+'\n');console.log('Captured Owner foundation visual evidence: 8/8');

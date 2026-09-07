const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OWNER='11111111-1111-4111-8111-111111111111';
const PET='22222222-2222-4222-8222-222222222222';
const CLINIC='33333333-3333-4333-8333-333333333333';
const LOCATION='44444444-4444-4444-8444-444444444444';
const SERVICE='55555555-5555-4555-8555-555555555555';
const SLOT='66666666-6666-4666-8666-666666666666';
const HOLD='77777777-7777-4777-8777-777777777777';
const CORRELATION='88888888-8888-4888-8888-888888888888';
const VISIT='99999999-9999-4999-8999-999999999999';
const RESULT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AMENDMENT='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TOKEN='vh_'+'a'.repeat(64);
const observed='2026-09-07T10:00:00.000Z';

const payloads={
  session:{subjectId:OWNER,roles:['OWNER']},
  pets:[{petId:PET,name:'Рекс',species:'DOG',createdAt:'2026-01-15T09:00:00.000Z',updatedAt:'2026-08-30T12:00:00.000Z'}],
  catalog:{observedAt:observed,clinics:[{clinicId:CLINIC,locationId:LOCATION,name:'ВетКлиника на Тверской',address:'Москва, ул. Тверская, 12',phone:'+7 495 123-45-67'}]},
  clinic:{observedAt:observed,clinicId:CLINIC,locationId:LOCATION,name:'ВетКлиника на Тверской',address:'Москва, ул. Тверская, 12',phone:'+7 495 123-45-67',services:[{serviceId:SERVICE,name:'Первичный приём ветеринара',price:{kind:'INFORMATIONAL',amount:'2500.00',currency:'RUB'}}]},
  availability:{observedAt:observed,clinicName:'ВетКлиника на Тверской',serviceName:'Первичный приём ветеринара',timezone:'Europe/Moscow',horizonEndsAt:'2026-09-21T20:00:00.000Z',slots:[
    {slotId:SLOT,startsAt:'2026-09-10T08:00:00.000Z',endsAt:'2026-09-10T08:30:00.000Z',localDate:'2026-09-10',localTime:'11:00',expectedVersion:2},
    {slotId:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',startsAt:'2026-09-10T10:00:00.000Z',endsAt:'2026-09-10T10:30:00.000Z',localDate:'2026-09-10',localTime:'13:00',expectedVersion:1},
    {slotId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',startsAt:'2026-09-11T06:30:00.000Z',endsAt:'2026-09-11T07:00:00.000Z',localDate:'2026-09-11',localTime:'09:30',expectedVersion:1}
  ]},
  booking:{holdId:HOLD,status:'PENDING_CONFIRMATION',slotId:SLOT,expiresAt:'2026-09-07T11:00:00.000Z',lastUpdatedAt:'2026-09-07T10:05:00.000Z',correlationId:CORRELATION,serverNow:'2026-09-07T10:05:00.000Z',aggregateVersion:1,confirmationMode:'MANUAL',nextAction:'READ_STATUS'},
  diary:{petId:PET,entries:[],clinicalEntries:[{visit:{visitId:VISIT,occurredAt:'2026-08-28T09:30:00.000Z',clinic:{name:'ВетКлиника на Тверской'},location:{address:'Москва, ул. Тверская, 12'},service:{name:'Первичный приём ветеринара'},doctor:{name:'Анна Петрова'}},result:{resultId:RESULT,publishedAt:'2026-08-28T10:20:00.000Z',content:'Состояние стабильное. Рекомендовано продолжить наблюдение, контролировать аппетит и активность.'},amendments:[{amendmentId:AMENDMENT,publishedAt:'2026-08-29T08:00:00.000Z',content:'Уточнение: при сохранении симптомов записаться на повторный осмотр в течение недели.'}]}],page:{limit:100,offset:0,total:1}}
};

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type,Idempotency-Key','Access-Control-Allow-Methods':'GET,POST,OPTIONS'},body:JSON.stringify(body)});}
async function mockApi(page){
  await page.route('https://api.visual.invalid/**',async route=>{
    const req=route.request();
    if(req.method()==='OPTIONS') return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type,Idempotency-Key','Access-Control-Allow-Methods':'GET,POST,OPTIONS'}});
    const p=new URL(req.url()).pathname;
    if(p==='/v1/auth/session') return json(route,payloads.session);
    if(p==='/v1/auth/logout') return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*'}});
    if(p==='/v1/owner/pets'&&req.method()==='GET') return json(route,payloads.pets);
    if(p==='/v1/owner/clinic-catalog') return json(route,payloads.catalog);
    if(p===`/v1/owner/clinic-catalog/${CLINIC}/locations/${LOCATION}`) return json(route,payloads.clinic);
    if(p===`/v1/owner/clinic-catalog/${CLINIC}/locations/${LOCATION}/services/${SERVICE}/availability`) return json(route,payloads.availability);
    if(p==='/v1/booking-holds'&&req.method()==='POST') return json(route,payloads.booking);
    if(p===`/v1/owner/pets/${PET}/diary`) return json(route,payloads.diary);
    console.log('UNMOCKED',req.method(),req.url());
    return json(route,{code:'NOT_FOUND'},404);
  });
}
async function shot(page,dir,name){await page.screenshot({path:path.join(dir,name),fullPage:true});}
async function visible(locator){try{return await locator.first().isVisible({timeout:1000});}catch{return false;}}

async function runJourney(browser,label,viewport){
  const dir=path.join('visual-evidence',label);fs.mkdirSync(dir,{recursive:true});
  const context=await browser.newContext({viewportSize:viewport,deviceScaleFactor:1});
  await context.addInitScript(({TOKEN,OWNER})=>sessionStorage.setItem('vethelp.owner.session.v1',JSON.stringify({opaqueCredential:TOKEN,cacheScope:OWNER,expiresAtEpochMs:4102444800000})),{TOKEN,OWNER});
  const page=await context.newPage();
  const consoleErrors=[];
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  page.on('pageerror',e=>consoleErrors.push(`PAGEERROR ${e.message}`));
  await mockApi(page);
  try {
    const response=await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
    fs.writeFileSync(path.join(dir,'00-boot-meta.txt'),`url=${page.url()}\nstatus=${response?.status() ?? 'none'}\ntitle=${await page.title()}\n`);
    fs.writeFileSync(path.join(dir,'00-boot.html'),await page.content());
    await shot(page,dir,'00-boot.png');
    await page.getByLabel('Личный кабинет').waitFor({state:'visible',timeout:15000});
    await shot(page,dir,'01-home.png');

    await page.getByRole('button',{name:'Начать запись'}).first().click();
    if(await visible(page.getByText('Кого записываем?'))){
      await shot(page,dir,'02-booking-pet.png');
      if(await visible(page.getByText('Рекс',{exact:true}))) await page.getByText('Рекс',{exact:true}).click();
      const cont=page.getByRole('button',{name:'Продолжить'});if(await visible(cont))await cont.click();
    }
    await page.getByText('Выберите клинику',{exact:true}).waitFor({state:'visible',timeout:10000});
    await shot(page,dir,'03-clinic-catalog.png');
    await page.getByRole('button',{name:'Открыть клинику'}).first().click();

    await page.getByText('Первичный приём ветеринара',{exact:true}).waitFor({state:'visible',timeout:10000});
    await shot(page,dir,'04-service.png');
    await page.getByText('Первичный приём ветеринара',{exact:true}).click();
    await page.getByRole('button',{name:'Продолжить'}).click();

    await page.getByText('11:00',{exact:true}).waitFor({state:'visible',timeout:10000});
    await shot(page,dir,'05-availability.png');
    await page.getByText('11:00',{exact:true}).click();
    await shot(page,dir,'06-availability-selected.png');
    await page.getByRole('button',{name:'Продолжить'}).click();

    await page.getByText('Проверьте заявку',{exact:true}).waitFor({state:'visible',timeout:10000});
    await shot(page,dir,'07-booking-review.png');
    await page.getByRole('button',{name:'Отправить заявку'}).click();
    await page.getByText('Ожидает подтверждения клиникой',{exact:true}).waitFor({state:'visible',timeout:10000});
    await shot(page,dir,'08-booking-success.png');

    await page.reload({waitUntil:'networkidle'});
    await page.getByLabel('Личный кабинет').waitFor({state:'visible',timeout:10000});
    await page.getByRole('button',{name:'Дневник'}).first().click();
    if(await visible(page.getByText('Чей дневник открыть?'))){
      await shot(page,dir,'09-diary-pet.png');
      if(await visible(page.getByText('Рекс',{exact:true})))await page.getByText('Рекс',{exact:true}).click();
      const cont=page.getByRole('button',{name:'Продолжить'});if(await visible(cont))await cont.click();
    }
    await page.getByText('Дневник: Рекс',{exact:true}).waitFor({state:'visible',timeout:10000});
    await shot(page,dir,'10-diary.png');
    await page.getByRole('button',{name:/Открыть результат приёма/}).first().click();
    await page.getByText('Исходный результат',{exact:true}).waitFor({state:'visible',timeout:10000});
    await shot(page,dir,'11-diary-detail.png');
  } finally {
    fs.writeFileSync(path.join(dir,'console-errors.txt'),consoleErrors.join('\n'));
    await context.close();
  }
}

(async()=>{const browser=await chromium.launch({headless:true});try{await runJourney(browser,'desktop',{width:1440,height:1000});await runJourney(browser,'mobile',{width:390,height:844});}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});

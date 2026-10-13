# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: shared-medical.spec.ts >> closure: late resource response cannot survive session capability removal
- Location: tests/e2e/shared-medical.spec.ts:38:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Milo' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Milo' })

```

```yaml
- link "Перейти к содержимому":
  - /url: "#clinic-v50-content"
- complementary "Навигация портала клиники":
  - strong: VetHelp
  - text: Портал клиники
  - paragraph: Рабочее место · Ресепшен
  - navigation "Разделы локации для роли Ресепшен":
    - status: Нет доступных разделов.
  - paragraph: Доступ и действия подтверждает сервер.
- banner "Контекст клиники и локации":
  - paragraph: Клиника 11111111… / локация 22222222…
  - heading "Ресепшен" [level=1]
  - text: 22222222…
- main:
  - heading "Раздел недоступен" [level=1]
- alert
```

# Test source

```ts
  1  | import { test,expect,type BrowserContext } from '@playwright/test';
  2  | import { AxeBuilder } from '@axe-core/playwright';
  3  | import { createServer,type Server } from 'node:http';
  4  | import { SignJWT } from 'jose';
  5  | import { readFile } from 'node:fs/promises';
  6  | const id=(digit:string)=>`${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`;
  7  | const clinic=id('1'),location=id('2'),hold=id('3'),appointment=id('4'),result=id('5'),amendmentA=id('6'),amendmentB=id('7'),document=id('8');
  8  | const root=`/v1/clinic/appointments/${appointment}/medical-shares`,bff=`/api/clinic/appointments/${appointment}/medical-shares`;
  9  | const mockPort=Number(process.env.CLINIC_PORTAL_MOCK_PORT??3212);
  10 | let server:Server,mode:'shared'|'none'|'revoked'|'error'|'malformed'='none',role='CLINIC_VETERINARIAN',reads=0,downloadMode:'ok'|'error'|'revoked'='ok';
  11 | const documentBytes=Buffer.from('%PDF-1.4\nPrivate selected document\n');
  12 | const refs=[{type:'AMENDMENT',id:amendmentB},{type:'DOCUMENT',id:document},{type:'RESULT',id:result},{type:'AMENDMENT',id:amendmentA}];
  13 | test.describe.configure({mode:'serial'});
  14 | test.beforeAll(async()=>{server=createServer((request,response)=>{const path=new URL(request.url??'/',`http://${request.headers.host}`).pathname;const json=(status:number,body:unknown)=>{response.writeHead(status,{'Content-Type':'application/json'});response.end(JSON.stringify(body));};
  15 |   if(path==='/v1/auth/session')return json(200,{subjectId:'vet-user',roles:[role],effectiveCapabilities:role==='CLINIC_VETERINARIAN'?['clinical.visit.workspace.read','medical.shared-data.read']:[],clinicScopes:[{clinicId:clinic,locationId:location}]});
  16 |   if(path===`/v1/clinic/${clinic}/locations/${location}/vet/visits/${hold}`)return json(200,{holdId:hold,appointmentId:appointment,clinicId:clinic,locationId:location,scheduledStart:'2026-10-07T10:00:00.000Z',scheduledEnd:'2026-10-07T10:30:00.000Z',status:'CONFIRMED',petDisplayName:'Milo',species:'CAT',visitId:null});
  17 |   if(path.startsWith(root)){reads++;if(mode==='error')return json(500,{private:'never forwarded'});if(mode==='revoked')return json(404,{code:'MEDICAL_SHARE_NOT_FOUND'});
  18 |     if(path.endsWith(`/DOCUMENT/${document}/download`)){if(downloadMode==='revoked')return json(404,{code:'MEDICAL_SHARE_NOT_FOUND'});if(downloadMode==='error')return json(500,{private:'storage-secret'});response.writeHead(200,{'Content-Type':'application/pdf','Content-Length':documentBytes.length,'Content-Disposition':'attachment; filename="selected-history.pdf"','Cache-Control':'private, no-store'});return setTimeout(()=>response.end(documentBytes),150);}
  19 |     if(path===root)return json(200,{appointmentId:appointment,status:mode==='none'?'NOT_SHARED':'SHARED',resources:mode==='none'?[]:refs});
  20 |     if(path.endsWith(result))return json(200,mode==='malformed'?{type:'RESULT',id:result,content:'Private malformed payload',publishedAt:'2026-10-01T10:00:00.000Z',storageUrl:'private-source'}:{type:'RESULT',id:result,content:'Selected original result',publishedAt:'2026-10-01T10:00:00.000Z'});
  21 |     if(path.endsWith(document))return json(200,{type:'DOCUMENT',id:document,fileName:'selected-history.pdf',mimeType:'application/pdf',createdAt:'2026-10-02T10:00:00.000Z'});
  22 |     if(path.endsWith(amendmentA)||path.endsWith(amendmentB)){const first=path.endsWith(amendmentA);return json(200,{type:'AMENDMENT',id:first?amendmentA:amendmentB,content:first?'First selected amendment':'Second selected amendment',version:first?1:2,publishedAt:first?'2026-10-03T10:00:00.000Z':'2026-10-04T10:00:00.000Z'});}
  23 |   }return json(404,{code:'NOT_FOUND'});
  24 | });await new Promise<void>(resolve=>server.listen(mockPort,'127.0.0.1',resolve));});
  25 | test.afterAll(async()=>{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));});
  26 | test.beforeEach(()=>{mode='none';role='CLINIC_VETERINARIAN';reads=0;downloadMode='ok';});
  27 | async function session(context:BrowserContext,baseURL:string|undefined){if(!baseURL)throw new Error('baseURL required');const token=await new SignJWT({roles:[role],clinicIds:[clinic],locationIds:[location]}).setProtectedHeader({alg:'HS256'}).setSubject('vet-user').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode('clinic-e2e-secret-at-least-32-bytes'));await context.addCookies([{name:'vethelp_clinic_session',value:token,url:baseURL,httpOnly:true,sameSite:'Lax'}]);}
  28 | const route=`/clinics/${clinic}/locations/${location}/vet/visits/${hold}`;
  29 | test('no grant preserves operational context and neutral section wording',async({page,context,baseURL})=>{await session(context,baseURL);await page.goto(route);await expect(page.getByRole('heading',{name:'Данные записи'})).toBeVisible();await expect(page.getByText('Владелец не предоставил медицинские данные для этой записи')).toBeVisible();await expect(page.getByText('У питомца нет медицинской истории')).toHaveCount(0);});
  30 | test('selected content, ordered explicit Amendments, document metadata and keyboard/axe',async({page,context,baseURL})=>{mode='shared';await session(context,baseURL);await page.goto(route);await expect(page.getByText('Selected original result')).toBeVisible();await expect(page.getByRole('heading',{name:'selected-history.pdf'})).toBeVisible();const items=page.locator('[aria-labelledby="shared-medical-title"] ol li');await expect(items).toHaveCount(2);await expect(items.nth(0)).toContainText('First selected amendment');await expect(items.nth(1)).toContainText('Second selected amendment');await expect(page.getByText('Unselected result')).toHaveCount(0);const refresh=page.getByRole('button',{name:'Обновить предоставленные данные'});await refresh.focus();await page.keyboard.press('Enter');await expect(page.getByText('Selected original result')).toBeVisible();expect((await new AxeBuilder({page}).include('[aria-labelledby="vet-visit-detail-title"]').analyze()).violations).toEqual([]);});
  31 | test('revoked access clears content without breaking the operational page',async({page,context,baseURL})=>{mode='shared';await session(context,baseURL);await page.goto(route);await expect(page.getByText('Selected original result')).toBeVisible();mode='revoked';await page.getByRole('button',{name:'Обновить предоставленные данные'}).click();await expect(page.getByText('Медицинские данные для этой записи недоступны.')).toBeVisible();await expect(page.getByText('Selected original result')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Milo'})).toBeVisible();});
  32 | for(const deniedRole of ['CLINIC_ADMIN','CLINIC_RECEPTIONIST'])test(`${deniedRole} BFF medical denial before upstream`,async({page,context,baseURL})=>{role=deniedRole;await session(context,baseURL);for(const path of [bff,`${bff}/resources/DOCUMENT/${document}/download`]){const response=await page.request.get(path);expect(response.status()).toBe(404);expect(await response.json()).toEqual({code:'MEDICAL_SHARE_NOT_FOUND'});}expect(reads).toBe(0);});
  33 | test('keyboard downloads actual selected bytes with loading state',async({page,context,baseURL})=>{mode='shared';await session(context,baseURL);await page.goto(route);const button=page.getByRole('button',{name:'Скачать selected-history.pdf'});await expect(button).toBeVisible();await button.focus();const downloaded=page.waitForEvent('download');await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'Загрузка документа…'})).toBeDisabled();const file=await downloaded;expect(file.suggestedFilename()).toBe('selected-history.pdf');expect(await readFile((await file.path())!)).toEqual(documentBytes);await expect(button).toBeEnabled();});
  34 | test('download error is bounded and accessible; revoked download clears medical content',async({page,context,baseURL})=>{mode='shared';downloadMode='error';await session(context,baseURL);await page.goto(route);const button=page.getByRole('button',{name:'Скачать selected-history.pdf'});await button.click();await expect(page.locator('[aria-labelledby="shared-medical-title"]').getByRole('alert')).toBeVisible();await expect(page.getByText('storage-secret')).toHaveCount(0);expect((await new AxeBuilder({page}).include('[aria-labelledby="vet-visit-detail-title"]').analyze()).violations).toEqual([]);downloadMode='revoked';await button.click();await expect(page.getByText('Медицинские данные для этой записи недоступны.')).toBeVisible();await expect(page.getByText('Selected original result')).toHaveCount(0);await expect(page.getByRole('heading',{name:'selected-history.pdf'})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Milo'})).toBeVisible();});
  35 | test('malformed payload and errors never display private content; retry is labeled',async({page,context,baseURL})=>{mode='malformed';await session(context,baseURL);await page.goto(route);await expect(page.getByText('Не удалось загрузить предоставленные данные.')).toBeVisible();await expect(page.getByText('Private malformed payload')).toHaveCount(0);mode='error';await page.getByRole('button',{name:'Обновить предоставленные данные'}).click();await expect(page.getByText('Не удалось загрузить предоставленные данные.')).toBeVisible();await expect(page.getByRole('heading',{name:'Milo'})).toBeVisible();});
  36 | 
  37 | // Closure-only coverage; accepted cases above are selected out, not rerun.
  38 | test('closure: late resource response cannot survive session capability removal',async({page,context,baseURL})=>{
  39 |  mode='shared';await session(context,baseURL);let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);let observed!:()=>void;const requested=new Promise<void>(resolve=>observed=resolve);
  40 |  await page.route(`**${bff}/resources/RESULT/${result}`,async route=>{observed();await held;await route.fulfill({json:{type:'RESULT',id:result,content:'Late old-scope medical content',publishedAt:'2026-10-01T10:00:00.000Z'}}).catch(()=>{});});
  41 |  await page.goto(route);await requested;role='CLINIC_ADMIN';await page.evaluate(()=>window.dispatchEvent(new Event('vethelp:session-changed')));
> 42 |  await expect(page.locator('[aria-labelledby="shared-medical-title"]')).toHaveCount(0);release();await expect(page.getByText('Late old-scope medical content')).toHaveCount(0);await expect(page.getByRole('heading',{name:'Milo'})).toBeVisible();
     |                                                                                                                                                                                                                                      ^ Error: expect(locator).toBeVisible() failed
  43 | });
  44 | test('closure: scope removal aborts an outstanding document and clears medical content',async({page,context,baseURL})=>{
  45 |  mode='shared';await session(context,baseURL);await page.goto(route);await expect(page.getByText('Selected original result')).toBeVisible();let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);let observed!:()=>void;const requested=new Promise<void>(resolve=>observed=resolve);let downloads=0;page.on('download',()=>downloads++);
  46 |  await page.route(`**${bff}/resources/DOCUMENT/${document}/download`,async route=>{observed();await held;await route.fulfill({status:200,headers:{'Content-Type':'application/pdf','Content-Length':String(documentBytes.length),'Content-Disposition':'attachment; filename="old-scope.pdf"'},body:documentBytes}).catch(()=>{});});
  47 |  await page.getByRole('button',{name:'Скачать selected-history.pdf'}).click();await requested;
  48 |  await page.route('**/api/auth/session',route=>route.fulfill({json:{subjectId:'vet-user',roles:['CLINIC_VETERINARIAN'],effectiveCapabilities:['clinical.visit.workspace.read','medical.shared-data.read'],clinicScopes:[]}}));
  49 |  await page.evaluate(()=>window.dispatchEvent(new Event('vethelp:session-changed')));await expect(page.locator('[aria-labelledby="shared-medical-title"]')).toHaveCount(0);release();await expect(page.getByText('Selected original result')).toHaveCount(0);expect(downloads).toBe(0);
  50 | });
  51 | for(const width of [375,1280])test(`closure: responsive keyboard medical path at ${width}px`,async({page,context,baseURL})=>{
  52 |  mode='shared';await page.setViewportSize({width,height:900});await session(context,baseURL);await page.goto(route);await expect(page.getByText('Selected original result')).toBeVisible();
  53 |  const section=page.locator('[aria-labelledby="shared-medical-title"]');const refresh=page.getByRole('button',{name:'Обновить предоставленные данные'});await refresh.focus();await expect(refresh).toBeFocused();
  54 |  const box=await section.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);expect((await page.evaluate(()=>document.documentElement.scrollWidth))).toBeLessThanOrEqual(width);
  55 |  expect((await new AxeBuilder({page}).include('[aria-labelledby="shared-medical-title"]').analyze()).violations).toEqual([]);
  56 | });
  57 | 
```
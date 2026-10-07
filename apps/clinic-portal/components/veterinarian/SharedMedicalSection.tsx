'use client';
import { useEffect, useRef, useState } from 'react';
import { useEffectiveSession } from '@/components/auth/EffectiveSessionProvider';
import { parseSharedList, parseSharedResource, type SharedResource } from '@/lib/api/shared-medical';
export function SharedMedicalSection({appointmentId,clinicId,locationId}:{appointmentId:string|null;clinicId:string;locationId:string}){
  const session=useEffectiveSession();
  const allowed=!session.loading&&!session.error&&session.hasCapability('medical.shared-data.read')&&session.hasClinicScope(clinicId,locationId);
  return allowed&&appointmentId?<SharedContent key={`${session.session?.subjectId}:${appointmentId}:${clinicId}:${locationId}`} appointmentId={appointmentId}/>:null;
}
function SharedContent({appointmentId}:{appointmentId:string}){
  const [state,setState]=useState<'loading'|'ready'|'denied'|'error'>('loading'),[resources,setResources]=useState<SharedResource[]>([]),[reload,setReload]=useState(0);
  useEffect(()=>{let active=true;const abort=new AbortController();setState('loading');setResources([]);
    const read=async(path:string)=>{const response=await fetch(path,{cache:'no-store',signal:abort.signal});if([401,403,404].includes(response.status))throw new Error('DENIED');if(!response.ok)throw new Error('UNAVAILABLE');return response.json() as Promise<unknown>;};
    const path=`/api/clinic/appointments/${appointmentId}/medical-shares`;
    void read(path).then(async value=>{const refs=parseSharedList(value,appointmentId);const items=await Promise.all(refs.map(async ref=>parseSharedResource(await read(`${path}/resources/${ref.type}/${ref.id}`),ref)));if(active){setResources(items.sort((a,b)=>time(a).localeCompare(time(b))||a.id.localeCompare(b.id)));setState('ready');}}).catch(failure=>{if(active){setResources([]);setState(failure instanceof Error&&failure.message==='DENIED'?'denied':'error');}});
    return()=>{active=false;abort.abort();};
  },[appointmentId,reload]);
  const results=resources.filter(item=>item.type==='RESULT'),amendments=resources.filter(item=>item.type==='AMENDMENT'),documents=resources.filter(item=>item.type==='DOCUMENT');
  return <section className="mt-6 border-t border-slate-200 pt-5" aria-labelledby="shared-medical-title" aria-busy={state==='loading'}><h2 id="shared-medical-title" className="text-lg font-semibold text-slate-950">Медицинские данные, которыми поделился владелец</h2>
    <p className="mt-2 text-sm text-slate-600">Только явно выбранные владельцем ресурсы для этой записи. Новые данные не добавляются автоматически.</p>
    <div aria-live="polite">{state==='loading'?<p>Загружаем предоставленные данные…</p>:state==='denied'?<p>Медицинские данные для этой записи недоступны.</p>:state==='error'?<p>Не удалось загрузить предоставленные данные.</p>:resources.length===0?<p>Владелец не предоставил медицинские данные для этой записи</p>:null}</div>
    {state==='ready'?<>{results.map(item=><article key={item.id} className="mt-4 rounded border border-slate-200 p-4"><h3 className="font-semibold">Исходный опубликованный результат</h3><p className="text-sm text-slate-600">{format(time(item))}</p><p className="whitespace-pre-wrap">{'content' in item?item.content:''}</p></article>)}
      {amendments.length?<section className="mt-4"><h3 className="font-semibold">Предоставленные уточнения</h3><ol>{amendments.map(item=><li key={item.id} className="mt-3 border-l-2 border-slate-300 pl-4"><p className="text-sm text-slate-600">{'version' in item?`Уточнение ${item.version} · `:''}{format(time(item))}</p><p className="whitespace-pre-wrap">{'content' in item?item.content:''}</p></li>)}</ol></section>:null}
      {documents.map(item=><article key={item.id} className="mt-4 rounded border border-slate-200 p-4"><h3 className="font-semibold">{'fileName' in item?item.fileName||'Медицинский документ':''}</h3><p className="text-sm text-slate-600">{format(time(item))}</p><DocumentDownload appointmentId={appointmentId} documentId={item.id} fileName={'fileName' in item?item.fileName:null} denied={()=>{setResources([]);setState('denied');}}/></article>)}</>:null}
    <button type="button" className="mt-4 min-h-11 rounded border border-slate-400 px-4 py-2" onClick={()=>setReload(value=>value+1)} disabled={state==='loading'}>Обновить предоставленные данные</button>
  </section>;
}
function DocumentDownload({appointmentId,documentId,fileName,denied}:{appointmentId:string;documentId:string;fileName:string|null;denied():void}){
  const [pending,setPending]=useState(false),[error,setError]=useState(false);
  const active=useRef(true),busy=useRef(false),request=useRef<AbortController|null>(null),objectUrl=useRef<string|null>(null);
  useEffect(()=>{const lifecycle=active,controller=request,url=objectUrl;lifecycle.current=true;return()=>{lifecycle.current=false;controller.current?.abort();if(url.current)URL.revokeObjectURL(url.current);};},[]);
  async function download(){
    if(busy.current)return;busy.current=true;setPending(true);setError(false);request.current=new AbortController();
    try{
      const response=await fetch(`/api/clinic/appointments/${appointmentId}/medical-shares/resources/DOCUMENT/${documentId}/download`,{cache:'no-store',signal:request.current.signal});
      if(!active.current)return;
      if([401,403,404].includes(response.status)){denied();return;}
      const length=Number(response.headers.get('Content-Length'));
      if(!response.ok||!Number.isSafeInteger(length)||length<=0||length>10*1024*1024)throw new Error('DOWNLOAD_UNAVAILABLE');
      const blob=await response.blob();if(!active.current)return;if(blob.size!==length)throw new Error('DOWNLOAD_UNAVAILABLE');
      objectUrl.current=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=objectUrl.current;anchor.download=fileName||'medical-document';document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(objectUrl.current);objectUrl.current=null;
    }catch{if(active.current)setError(true);}finally{if(active.current){busy.current=false;setPending(false);}}
  }
  const errorId=`document-download-error-${documentId}`;
  return <div className="mt-3"><button type="button" className="min-h-11 rounded border border-slate-400 px-4 py-2" disabled={pending} aria-describedby={error?errorId:undefined} onClick={()=>void download()}>{pending?'Загрузка документа…':`Скачать ${fileName||'медицинский документ'}`}</button>{error?<p id={errorId} role="alert" className="mt-2 text-red-700">Не удалось скачать документ. Повторите попытку.</p>:null}</div>;
}
function time(resource:SharedResource){return 'publishedAt' in resource?resource.publishedAt:resource.createdAt;}
function format(value:string){return new Date(value).toLocaleString('ru-RU');}

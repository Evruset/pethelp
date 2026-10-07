'use client';
import { useEffect, useState } from 'react';
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
      {documents.map(item=><article key={item.id} className="mt-4 rounded border border-slate-200 p-4"><h3 className="font-semibold">{'fileName' in item?item.fileName||'Медицинский документ':''}</h3><p className="text-sm text-slate-600">{format(time(item))}</p><p className="text-sm text-slate-600">Доставка файла ещё недоступна.</p></article>)}</>:null}
    <button type="button" className="mt-4 min-h-11 rounded border border-slate-400 px-4 py-2" onClick={()=>setReload(value=>value+1)} disabled={state==='loading'}>Обновить предоставленные данные</button>
  </section>;
}
function time(resource:SharedResource){return 'publishedAt' in resource?resource.publishedAt:resource.createdAt;}
function format(value:string){return new Date(value).toLocaleString('ru-RU');}

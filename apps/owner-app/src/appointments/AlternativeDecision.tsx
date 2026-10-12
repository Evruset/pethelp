import {useEffect,useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useSession} from '@/session/SessionProvider';
import {Text} from 'react-native';
import {ApiError} from '@/api/errors';
import {Button,Card,StateMessage} from '@/ui/primitives';
import {alternativeApi,type Alternative} from './alternative-api';
import {appointmentDate} from './appointment-date';
import type {AppointmentDetail} from './appointments-api';
type Command={snapshot:Alternative;decision:'accept'|'decline';key:string;correlation:string;uncertain?:boolean};
export function AlternativeDecision({token,detail,onResolved}:{token:string;detail:AppointmentDetail;onResolved():void}){
 const cache=useQueryClient(),{session}=useSession();
 const commandKey=['owner',session?.cacheScope,'alternative-command',detail.holdId];
 const retained=cache.getQueryData<Command>(commandKey);
 const [snapshot,setSnapshot]=useState<Alternative|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[command,setCommand]=useState<Command|null>(retained??null),[uncertain,setUncertain]=useState(Boolean(retained?.uncertain)),[tick,setTick]=useState(0);
 const epoch=useRef(0),flight=useRef(false),receivedAt=useRef(0);
 useEffect(()=>{const request=++epoch.current,abort=new AbortController();setSnapshot(null);setLoading(true);setError(null);void alternativeApi.read(token,detail,abort.signal).then(value=>{if(request===epoch.current){receivedAt.current=Date.now();setSnapshot(value);}}).catch(()=>{if(request===epoch.current)setError('Предложение недоступно. Обновите запись.');}).finally(()=>{if(request===epoch.current)setLoading(false);});return()=>{epoch.current++;abort.abort();};},[token,detail.holdId,detail.pet.id,detail.clinic.id,tick]);
 const [clock,setClock]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const expired=snapshot?Date.parse(snapshot.serverNow)+Math.max(0,clock-receivedAt.current)>=Date.parse(snapshot.deadline):true;
 function prepare(snapshot:Alternative,decision:'accept'|'decline'){const next={snapshot,decision,key:crypto.randomUUID(),correlation:crypto.randomUUID()};cache.setQueryDefaults(commandKey,{gcTime:Infinity});cache.setQueryData(commandKey,next);setCommand(next);}
 function clear(){cache.removeQueries({queryKey:commandKey,exact:true});setCommand(null);}
 async function submit(){if(!command||flight.current)return;flight.current=true;setBusy(true);setError(null);const request=epoch.current;const pending={...command,uncertain:true};cache.setQueryData(commandKey,pending);setUncertain(true);const matches=()=>{const active=cache.getQueryData<Command>(commandKey);return active?.key===pending.key&&active.snapshot.proposalId===pending.snapshot.proposalId&&active.decision===pending.decision;};const settle=()=>{if(matches())cache.removeQueries({queryKey:commandKey,exact:true});};
  try{await alternativeApi.decide(token,command.snapshot,command.decision,command.key,command.correlation);settle();if(request!==epoch.current)return;setCommand(null);setUncertain(false);onResolved();setTick(v=>v+1);}
  catch(failure){const rejected=failure instanceof ApiError&&failure.status&&failure.status<500;if(rejected)settle();if(request!==epoch.current)return;if(rejected){setCommand(null);setUncertain(false);setSnapshot(null);setError('Предложение изменилось, истекло или решение уже принято. Обновите предложение и запись.');onResolved();}else{if(matches())cache.setQueryData(commandKey,{...command,uncertain:true});setUncertain(true);setError('Ответ не получен. Повторите тот же запрос; новое решение пока недоступно.');}}
  finally{flight.current=false;if(request===epoch.current)setBusy(false);}
 }
 return <Card><Text accessibilityRole="header" style={{fontSize:18,fontWeight:'600'}}>Клиника предложила другое время</Text>{loading?<StateMessage kind="loading" title="Загружаем предложение"/>:null}
 {snapshot?<><Text>Исходное время: {appointmentDate(snapshot.originalSlot.startsAt)}</Text><Text>Предложено: {appointmentDate(snapshot.proposedSlot.startsAt)}</Text><Text>Ответить до: {appointmentDate(snapshot.deadline)} · время устройства</Text><Text>{snapshot.priceCopy}</Text><Text>{snapshot.state==='ALTERNATIVE_PENDING'?(expired?'Срок предложения истёк. Обновите запись.':'Первоначальная запись сохраняется до решения.'):snapshot.state==='ACCEPTED'?'Предложение принято сервером':snapshot.state==='DECLINED'?'Предложение отклонено сервером':'Предложение больше не действует'}</Text>
 {!command&&!expired&&snapshot.state==='ALTERNATIVE_PENDING'?<>{snapshot.actions.canAccept?<Button label="Принять другое время" onPress={()=>prepare(snapshot,'accept')}/>:null}{snapshot.actions.canDecline?<Button label="Отклонить другое время" variant="secondary" onPress={()=>prepare(snapshot,'decline')}/>:null}</>:null}</>:null}
 {command?<><Text>Подтвердите {command.decision==='accept'?'принятие':'отклонение'} именно этого предложения.</Text><Button label={busy?'Отправляем…':uncertain?'Повторить решение':'Подтвердить решение'} disabled={busy} onPress={()=>{void submit();}}/><Button label="Вернуться к предложению" disabled={busy||uncertain} variant="ghost" onPress={clear}/></>:null}
 {error?<Text accessibilityRole="alert">{error}</Text>:null}<Button label="Обновить предложение" variant="secondary" disabled={busy||uncertain} onPress={()=>setTick(v=>v+1)}/>
 </Card>;
}

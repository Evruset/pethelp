import {useCallback,useEffect,useRef,useState} from 'react';
import {View} from 'react-native';
import {ApiError} from '@/api/errors';
import {useSession} from '@/session/SessionProvider';
import {BodyText,Button,ConfirmationModal,InsetSection,StateMessage,StatusPill} from '@/ui/primitives';
import {uiTokens as t} from '@/ui/tokens';
import {bookingApi,type BookingChangeRequest,type BookingChangeRequestType,type BookingSnapshot} from './booking-api';
import {ReallocationOfferPanel} from './ReallocationOfferPanel';

const statusCopy={OPEN:'Запрос отправлен',PROCESSING:'Запрос обрабатывается',COMPLETED:'Изменение выполнено',REJECTED:'Изменение не удалось выполнить',CANCELLED:'Запрос отменён'} as const;
const typeCopy={CANCEL:'отмену',RESCHEDULE:'изменение времени'} as const;
const randomKey=()=>{const value=globalThis.crypto?.randomUUID?.();if(!value)throw new Error('SECURE_RANDOM_UNAVAILABLE');return value;};

export function BookingChangeRequestPanel({booking,allowCreate=true}:{booking:BookingSnapshot;allowCreate?:boolean}){
  const {session}=useSession();
  const credential=session?.opaqueCredential;
  const [request,setRequest]=useState<BookingChangeRequest|null>(null);
  const [loading,setLoading]=useState(true);
  const [submitting,setSubmitting]=useState(false);
  const [intent,setIntent]=useState<BookingChangeRequestType|null>(null);
  const [failure,setFailure]=useState<'network'|'technical'|'stale'|'processing'|null>(null);
  const mounted=useRef(true),inFlight=useRef(false),key=useRef<string|null>(null),keyType=useRef<BookingChangeRequestType|null>(null);
  const exactIdentity=useCallback((value:BookingChangeRequest)=>value.bookingHoldId===booking.holdId&&value.clinicId===booking.clinic.id&&value.locationId===booking.location.id&&value.slotId===booking.slotId,[booking]);

  const readCurrent=useCallback(async()=>{
    if(!credential||inFlight.current)return;
    inFlight.current=true;setLoading(true);setFailure(null);
    try{const current=await bookingApi.readCurrentChangeRequest(credential,booking.holdId);if(!exactIdentity(current))throw new Error('STALE_BOOKING_CHANGE_REQUEST_IDENTITY');if(mounted.current)setRequest(current);}
    catch(error){if(!mounted.current)return;if(error instanceof ApiError&&error.status===404)setRequest(null);else if(error instanceof ApiError&&(error.kind==='NETWORK'||error.kind==='TIMEOUT'))setFailure('network');else if(error instanceof Error&&error.message==='STALE_BOOKING_CHANGE_REQUEST_IDENTITY')setFailure('stale');else setFailure('technical');}
    finally{inFlight.current=false;if(mounted.current)setLoading(false);}
  },[booking.holdId,credential,exactIdentity]);

  useEffect(()=>{mounted.current=true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial read synchronizes the panel with server authority.
    void readCurrent();return()=>{mounted.current=false;inFlight.current=false;};},[readCurrent]);

  const submit=useCallback(async()=>{
    const requestType=intent??keyType.current;
    if(!credential||!requestType||inFlight.current)return;
    try{if(keyType.current!==requestType){key.current=randomKey();keyType.current=requestType;}else key.current??=randomKey();}
    catch{setIntent(null);setFailure('technical');return;}
    inFlight.current=true;setSubmitting(true);setFailure(null);
    try{const created=await bookingApi.createChangeRequest(credential,booking.holdId,requestType,key.current);if(!exactIdentity(created))throw new Error('STALE_BOOKING_CHANGE_REQUEST_IDENTITY');if(mounted.current){setRequest(created);setIntent(null);key.current=null;keyType.current=null;}}
    catch(error){if(!mounted.current)return;setIntent(null);if(error instanceof ApiError&&error.status===425)setFailure('processing');else if(error instanceof ApiError&&error.status===409){inFlight.current=false;setSubmitting(false);await readCurrent();return;}else if(error instanceof ApiError&&error.status===422)setFailure('stale');else if(error instanceof ApiError&&(error.kind==='NETWORK'||error.kind==='TIMEOUT'))setFailure('network');else if(error instanceof Error&&error.message==='STALE_BOOKING_CHANGE_REQUEST_IDENTITY')setFailure('stale');else setFailure('technical');}
    finally{inFlight.current=false;if(mounted.current)setSubmitting(false);}
  },[booking.holdId,credential,exactIdentity,intent,readCurrent]);
  const retry=()=>{if(keyType.current)void submit();else void readCurrent();};

  if(!credential||(!allowCreate&&!loading&&!request))return null;
  return <><InsetSection title="Изменить запись"><View style={{padding:t.spacing.lg,gap:t.spacing.md}}>
    {loading&&!request?<StateMessage kind="loading" title="Проверяем текущие запросы…"/>:null}
    {request?<><StatusPill label={statusCopy[request.status]} tone={request.status==='REJECTED'?'critical':request.status==='COMPLETED'?'success':'info'}/><BodyText>{`${request.requestType==='CANCEL'?'Запрос на отмену':'Запрос на изменение времени'}: ${statusCopy[request.status].toLowerCase()}.`}</BodyText><BodyText secondary>Запись не считается отменённой или перенесённой, пока её статус выше не изменится после обработки запроса.</BodyText><Button label="Обновить статус запроса" variant="secondary" disabled={loading||submitting} onPress={()=>{void readCurrent();}}/></>:null}
    {!request&&!loading&&allowCreate?<><BodyText secondary>Отправьте запрос — запись и выбранное время останутся без изменений до решения команды поддержки.</BodyText><Button label="Запросить отмену" variant="destructive" disabled={submitting} onPress={()=>setIntent('CANCEL')}/><Button label="Запросить изменение времени" variant="secondary" disabled={submitting} onPress={()=>setIntent('RESCHEDULE')}/></>:null}
    {submitting?<StateMessage kind="submitting" title="Отправляем запрос…"/>:null}
    {failure==='processing'?<StateMessage kind="conflict" title="Запрос ещё отправляется. Подождите и повторите проверку — повторный запрос не будет создан." action={<Button label="Проверить снова" onPress={()=>{void submit();}}/>}/>:null}
    {failure==='stale'?<StateMessage kind="conflict" title="Данные записи или запроса изменились. Обновите карточку записи перед новой попыткой." action={<Button label="Обновить статус запроса" onPress={()=>{void readCurrent();}}/>}/>:null}
    {failure==='network'?<StateMessage kind="error" title="Нет связи с сервером. Повторная попытка сохранит тот же запрос." action={<Button label="Повторить" onPress={retry}/>}/>:null}
    {failure==='technical'?<StateMessage kind="error" title="Не удалось безопасно обработать запрос." action={<Button label="Повторить" onPress={retry}/>}/>:null}
    <ConfirmationModal visible={intent!==null} title={intent==='CANCEL'?'Запросить отмену записи?':'Запросить изменение времени?'} body={intent?`Мы отправим запрос на ${typeCopy[intent]}. Запись и время пока останутся без изменений.`:''} confirmLabel="Отправить запрос" cancelLabel="Не отправлять" busy={submitting} onConfirm={()=>{void submit();}} onCancel={()=>{if(!submitting)setIntent(null);}}/>
  </View></InsetSection>{request?<ReallocationOfferPanel booking={booking} request={request}/>:null}</>;
}

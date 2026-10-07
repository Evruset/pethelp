import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import { useSession } from '@/session/SessionProvider';
import { Button, Card, Screen, StateMessage } from '@/ui/primitives';
import { medicalSharingApi, type MedicalSharingApi, type MedicalShare, type OwnerAppointment, type ResourceRef, type SharingContext } from './medical-sharing-api';

const refKey=(ref:ResourceRef)=>`${ref.type}:${ref.id}`;
const secureKey=()=>{const value=globalThis.crypto?.randomUUID?.();if(!value)throw new Error('SECURE_RANDOM_UNAVAILABLE');return value;};
const date=(value:string,timezone?:string)=>new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short',...(timezone?{timeZone:timezone}:{})}).format(new Date(value));

export function MedicalSharingScreen({onBack,api=medicalSharingApi}:{onBack():void;api?:MedicalSharingApi}){
  const {session}=useSession();
  return <SharingJourney key={`${session?.cacheScope}:${session?.opaqueCredential}`} credential={session?.opaqueCredential} cacheScope={session?.cacheScope} api={api} onBack={onBack}/>;
}
function SharingJourney({credential,cacheScope,api,onBack}:{credential?:string;cacheScope?:string;api:MedicalSharingApi;onBack():void}){
  const [appointment,setAppointment]=useState<OwnerAppointment|null>(null);
  const query=useQuery({queryKey:['owner',cacheScope,'medical-sharing-appointments'],enabled:Boolean(credential),queryFn:({signal})=>api.appointments(credential!,signal)});
  if(appointment&&credential)return <AppointmentSharing key={appointment.appointmentId!} appointment={appointment} credential={credential} api={api} onBack={()=>setAppointment(null)}/>;
  const entries=credential&&!query.isError?query.data?.filter(item=>item.appointmentId):undefined;
  return <ScrollView><Screen title="Мои записи — медицинские данные">
    <Text>Выберите запись, чтобы поделиться конкретными медицинскими данными с принимающей клиникой или отозвать доступ.</Text>
    {!credential?<StateMessage kind="forbidden" title="Для доступа к записям войдите в аккаунт"/>:null}
    {credential&&query.isPending?<StateMessage kind="loading" title="Загружаем записи"/>:null}
    {query.isError?<StateMessage kind="error" title="Не удалось загрузить записи" action={<Button label="Повторить" onPress={()=>{void query.refetch();}}/>}/>:null}
    {entries?.length===0?<StateMessage kind="empty" title="У вас пока нет подтверждённых записей"/>:null}
    {entries?.map(item=><Card key={item.appointmentId!}>
      <Text>{item.clinic.name}</Text><Text>{item.clinic.address}</Text><Text>{item.pet.name} · {date(item.startsAt)}</Text>
      <Button label={['CONFIRMED','RESCHEDULE_PROPOSED','COMPLETED'].includes(item.state)?'Поделиться медицинскими данными':'Просмотреть предоставленный доступ'} onPress={()=>setAppointment(item)}/>
    </Card>)}
    <Button label="Назад в личный кабинет" variant="secondary" onPress={onBack}/>
  </Screen></ScrollView>;
}
type Command={kind:'CREATE';resources:ResourceRef[];key:string;correlation:string}|{kind:'REVOKE';share:MedicalShare;key:string;correlation:string};
function AppointmentSharing({appointment,credential,api,onBack}:{appointment:OwnerAppointment;credential:string;api:MedicalSharingApi;onBack():void}){
  const [context,setContext]=useState<SharingContext|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
  const [selected,setSelected]=useState<ResourceRef[]>([]),[command,setCommand]=useState<Command|null>(null),[sending,setSending]=useState(false),[uncertain,setUncertain]=useState(false);
  const [notice,setNotice]=useState<string|null>(null);const busy=useRef(false),generation=useRef(0),controller=useRef<AbortController|null>(null);
  const load=useCallback(async()=>{
    if(busy.current)return;const current=++generation.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;
    try{const value=await api.context(credential,appointment.appointmentId!,abort.signal);if(value.appointmentId!==appointment.appointmentId||value.petId!==appointment.pet.id||value.clinicId!==appointment.clinic.id)throw new Error('INVALID_MEDICAL_SHARING_RESPONSE');if(generation.current===current)setContext(value);}
    catch{if(generation.current===current)setError('Не удалось загрузить данные доступа. Повторите попытку.');}
    finally{if(generation.current===current)setLoading(false);}
  },[api,credential,appointment.appointmentId,appointment.pet.id,appointment.clinic.id]);
  const refresh=async()=>{
    if(busy.current)return;
    setLoading(true);setError(null);setNotice(null);setContext(null);setSelected([]);await load();
  };
  useEffect(()=>{const boundary=generation,request=controller;let mounted=true;void Promise.resolve().then(()=>{if(mounted)return load();});return()=>{mounted=false;boundary.current++;request.current?.abort();};},[load]);
  const label=(resource:ResourceRef)=>{
    const detail=context?.resourceDetails.find(item=>refKey(item)===refKey(resource));
    return detail?`${detail.label} · ${date(detail.createdAt,context?.appointment.timezone)}`:resource.type==='DOCUMENT'?'Медицинский документ':resource.type==='RESULT'?'Результат приёма':'Уточнение к результату';
  };
  const prepare=(kind:'CREATE'|'REVOKE',share?:MedicalShare)=>{
    setError(null);setNotice(null);
    try{setCommand(kind==='CREATE'?{kind,resources:selected.map(item=>({...item})),key:secureKey(),correlation:secureKey()}:{kind,share:share!,key:secureKey(),correlation:secureKey()});}
    catch{setError('Не удалось подготовить безопасный запрос. Повторите попытку.');}
  };
  const submit=async()=>{
    if(!command||!context||busy.current)return;
    busy.current=true;setSending(true);setError(null);const current=++generation.current;
    const abort=new AbortController();controller.current=abort;
    try{
      const accepted=command.kind==='CREATE'?await api.create(credential,context,command.resources,command.key,command.correlation,abort.signal):await api.revoke(credential,command.share,command.key,command.correlation,abort.signal);
      if(generation.current!==current)return;
      setContext({...context,shares:[...context.shares.filter(item=>item.id!==accepted.id),accepted]});
      setNotice(accepted.status==='ACTIVE'?'Доступ предоставлен — подтверждено сервером':'Доступ отозван — подтверждено сервером');setCommand(null);setSelected([]);setUncertain(false);
    }catch(failure){
      if(generation.current!==current)return;
      if(failure instanceof ApiError&&failure.safeCode==='BOOKING_STATE_CONFLICT'){
        setError('Состояние записи или доступа изменилось. Обновите данные.');setContext(null);setCommand(null);setUncertain(false);
      }else if(failure instanceof ApiError&&failure.safeCode==='MEDICAL_SHARE_NOT_FOUND'){
        setError('Запись или выбранный ресурс больше недоступны. Обновите данные.');setContext(null);setCommand(null);setUncertain(false);
      }else if(failure instanceof ApiError&&failure.safeCode==='IDEMPOTENCY_CONFLICT'){
        setError('Запрос не соответствует сохранённым данным. Обновите данные и начните заново.');setContext(null);setCommand(null);setUncertain(false);
      }else if(failure instanceof ApiError&&['UNAUTHORIZED','FORBIDDEN','VALIDATION'].includes(failure.kind)){
        setError('Доступ недоступен или запрос отклонён. Обновите данные; при необходимости войдите в аккаунт заново.');setContext(null);setCommand(null);setUncertain(false);
      }else{
        setUncertain(true);setError('Не удалось получить подтверждение сервера. Запрос мог выполниться. Повторите тот же запрос безопасно.');
      }
    }finally{if(generation.current===current){setSending(false);busy.current=false;}}
  };
  const frozen=Boolean(command)||sending;
  return <ScrollView><Screen title="Поделиться медицинскими данными">
    {loading?<StateMessage kind="loading" title="Загружаем данные доступа"/>:null}
    {error?<StateMessage kind="error" title={error}/>:null}
    {notice?<Text accessibilityRole="alert" accessibilityLiveRegion="polite">{notice}</Text>:null}
    {context?<>
      <Card><Text>Клиника: {context.clinic.displayName}</Text><Text>{context.clinic.locationAddress}</Text><Text>Запись: {date(context.appointment.startsAt,context.appointment.timezone)}</Text><Text>Питомец: {context.pet.displayName}</Text></Card>
      <Text>Доступ предоставляется только выбранным данным для этой записи. Новые результаты и документы не будут добавлены автоматически.</Text>
      {!context.eligible?<Text>Для этой записи новый доступ предоставить нельзя. Ранее предоставленный доступ можно отозвать.</Text>:<>
        <Text accessibilityRole="header">Выберите данные</Text>
        {context.resourcesTruncated?<Text>Показаны первые 200 ресурсов. Выберите нужные данные из списка; оставшиеся ресурсы не будут добавлены автоматически.</Text>:null}
        {context.resources.length===0?<Text>Сейчас нет доступных для передачи ресурсов.</Text>:null}
        {context.resources.map(resource=>{
          const checked=selected.some(item=>refKey(item)===refKey(resource));return <Pressable key={refKey(resource)} accessibilityRole="checkbox" accessibilityLabel={label(resource)} accessibilityState={{checked,disabled:frozen}} style={{minHeight:48,justifyContent:'center'}} disabled={frozen} onPress={()=>setSelected(checked?selected.filter(item=>refKey(item)!==refKey(resource)):[...selected,resource])}><Card selected={checked}><Text>{label(resource)}</Text></Card></Pressable>;
        })}
        {!command?<Button label="Продолжить к подтверждению" disabled={!selected.length||sending} onPress={()=>prepare('CREATE')}/>:null}
      </>}
      {context.shares.length?<Text accessibilityRole="header">Предоставленный доступ</Text>:null}
      {context.shares.map(share=><Card key={share.id}><Text>{share.status==='ACTIVE'?'Активный доступ':'Доступ отозван'}</Text><Text>Создан: {date(share.createdAt,context.appointment.timezone)}</Text>{share.resources.map(resource=><Text key={refKey(resource)}>{label(resource)}</Text>)}{share.status==='ACTIVE'&&!command?<Button label="Отозвать доступ" disabled={sending} onPress={()=>prepare('REVOKE',share)}/>:null}</Card>)}
    </>:null}
    {command?<View accessibilityLabel="Подтверждение доступа" onAccessibilityEscape={()=>{if(!sending&&!uncertain)setCommand(null);}}>
      <Text accessibilityRole="header">{command.kind==='CREATE'?'Подтвердите передачу выбранных данных':'Подтвердите отзыв доступа'}</Text>
      {command.kind==='CREATE'?<>{command.resources.map(resource=><Text key={refKey(resource)}>{label(resource)}</Text>)}<Text>Только эти ресурсы будут доступны указанной клинике для этой записи.</Text></>:<Text>PetHelp остановит последующий доступ через это разрешение. Уже просмотренные или скачанные сведения не удаляются у клиники.</Text>}
      <Button label={sending?'Отправляем…':uncertain?'Повторить тот же запрос':command.kind==='CREATE'?'Подтвердить передачу':'Подтвердить отзыв'} disabled={sending} onPress={()=>{void submit();}}/>
      <Button label="Отмена" variant="secondary" disabled={sending||uncertain} onPress={()=>setCommand(null)}/>
    </View>:null}
    {!command?<Button label="Обновить данные доступа" variant="secondary" disabled={loading||sending} onPress={()=>{void refresh();}}/>:null}
    <Button label="Назад к записям" variant="secondary" disabled={sending||uncertain} onPress={onBack}/>
  </Screen></ScrollView>;
}

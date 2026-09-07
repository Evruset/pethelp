import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { useSession } from '@/session/SessionProvider';
import { BodyText, Button, Card, InlineBanner, InsetSection, ListRow, Screen, SkeletonCard, StateMessage, StatusPill } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { specialistDiscoveryApi, type SpecialistDiscoveryDoctor, type SpecialistDiscoveryOption, type SpecialistDiscoverySelection, type SpecialistDiscoverySlot } from './specialist-discovery-api';
import { DiscoveryMapSurface } from './DiscoveryMapSurface';

const timeLabel=(value:string,timeZone:string)=>new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',timeZone}).format(new Date(value));
const selectionKey=(doctor:SpecialistDiscoveryDoctor,slot:SpecialistDiscoverySlot)=>`${doctor.specialtyId}:${doctor.doctorId}:${doctor.serviceId}:${doctor.clinicId}:${doctor.locationId}:${slot.slotId}:${slot.expectedVersion}`;
const sameSelector=(left:SpecialistDiscoveryOption|null,right:SpecialistDiscoveryOption)=>{
  if(!left||left.kind!==right.kind)return false;
  if(left.kind==='SPECIALTY'&&right.kind==='SPECIALTY')return left.specialtyId===right.specialtyId;
  return left.kind==='SERVICE'&&right.kind==='SERVICE'&&left.serviceCode===right.serviceCode;
};

export function SpecialistDiscoveryScreen({onClose,onContinue}:{onClose():void;onContinue(value:SpecialistDiscoverySelection):void}){
  const {session}=useSession();
  const [entry,setEntry]=useState<'SPECIALTY'|'SERVICE'>('SPECIALTY');
  const [selector,setSelector]=useState<SpecialistDiscoveryOption|null>(null);
  const [surface,setSurface]=useState<'LIST'|'MAP'>('LIST');
  const [mapLocationId,setMapLocationId]=useState<string|null>(null);
  const [selected,setSelected]=useState<{doctor:SpecialistDiscoveryDoctor;slot:SpecialistDiscoverySlot}|null>(null);
  const [stale,setStale]=useState(false);const [checking,setChecking]=useState(false);const operation=useRef(0);
  useEffect(()=>()=>{operation.current+=1;},[]);
  const options=useQuery({queryKey:['owner',session?.cacheScope,'specialist-discovery-options'],enabled:Boolean(session),queryFn:({signal})=>specialistDiscoveryApi.options(session!.opaqueCredential,signal)});
  const results=useQuery({queryKey:['owner',session?.cacheScope,'specialist-discovery',selector?.kind,selector?.kind==='SPECIALTY'?selector.specialtyId:selector?.serviceCode],enabled:Boolean(session&&selector),queryFn:({signal})=>specialistDiscoveryApi.search(session!.opaqueCredential,selector!,signal)});
  const chooseSelector=(value:SpecialistDiscoveryOption)=>{setSelector(value);setSelected(null);setStale(false);setSurface('LIST');setMapLocationId(null);};
  const current=selected&&results.data?.doctors.find(doctor=>doctor.specialtyId===selected.doctor.specialtyId&&doctor.doctorId===selected.doctor.doctorId&&doctor.serviceId===selected.doctor.serviceId&&doctor.clinicId===selected.doctor.clinicId&&doctor.locationId===selected.doctor.locationId)?.slots.find(slot=>slot.slotId===selected.slot.slotId&&slot.expectedVersion===selected.slot.expectedVersion);
  const proceed=async()=>{if(!selected||checking)return;setChecking(true);setStale(false);const request=++operation.current;try{const refreshed=await results.refetch();if(request!==operation.current)return;const doctor=refreshed.data?.doctors.find(item=>item.specialtyId===selected.doctor.specialtyId&&item.doctorId===selected.doctor.doctorId&&item.serviceId===selected.doctor.serviceId&&item.clinicId===selected.doctor.clinicId&&item.locationId===selected.doctor.locationId);const slot=doctor?.slots.find(item=>item.slotId===selected.slot.slotId&&item.expectedVersion===selected.slot.expectedVersion);if(refreshed.isError||!doctor||!slot){setStale(true);setSelected(null);return;}onContinue({specialtyId:doctor.specialtyId,doctorId:doctor.doctorId,serviceId:doctor.serviceId,clinicId:doctor.clinicId,locationId:doctor.locationId,slotId:slot.slotId,expectedSlotVersion:slot.expectedVersion});}catch{if(request===operation.current)setStale(true);}finally{if(request===operation.current)setChecking(false);}};
  const choices=entry==='SPECIALTY'?options.data?.specialties.map(item=>({kind:'SPECIALTY' as const,...item})):options.data?.services.map(item=>({kind:'SERVICE' as const,...item}));
  const doctorCard=(doctor:SpecialistDiscoveryDoctor)=><Card key={`${doctor.doctorId}:${doctor.serviceId}`}><StatusPill label={doctor.specialtyName} tone="info"/><Text accessibilityRole="header" style={{...t.typography.sectionTitle,color:t.color.textPrimary}}>{doctor.doctorName}</Text><BodyText>{doctor.serviceName}</BodyText><BodyText secondary>{doctor.clinicName} · {doctor.address}</BodyText><View accessibilityRole="radiogroup" accessibilityLabel={`Ближайшее время — ${doctor.doctorName}`} style={{gap:t.spacing.sm,paddingTop:t.spacing.sm}}>{doctor.slots.map(slot=><Card key={slot.slotId} selected={selected?selectionKey(selected.doctor,selected.slot)===selectionKey(doctor,slot):false} onPress={()=>{setSelected({doctor,slot});setStale(false);}} accessibilityLabel={`${doctor.doctorName}, ${timeLabel(slot.startsAt,doctor.timezone)}`}><BodyText>{timeLabel(slot.startsAt,doctor.timezone)}</BodyText></Card>)}</View></Card>;
  return <Screen title="Найти специалиста" subtitle="Выберите специальность или услугу — покажем только врачей с опубликованным свободным временем." backAction={onClose}>
    <View style={{flexDirection:'row',gap:t.spacing.sm}}><View style={{flex:1}}><Button label="По специальности" variant={entry==='SPECIALTY'?'primary':'secondary'} onPress={()=>{setEntry('SPECIALTY');setSelector(null);setSelected(null);}}/></View><View style={{flex:1}}><Button label="По услуге" variant={entry==='SERVICE'?'primary':'secondary'} onPress={()=>{setEntry('SERVICE');setSelector(null);setSelected(null);}}/></View></View>
    {options.isPending?<View style={{gap:t.spacing.md}}><StateMessage kind="loading" title="Загружаем направления"/><SkeletonCard/><SkeletonCard/></View>:null}
    {options.isError?<StateMessage kind="error" title="Не удалось загрузить направления" body="Проверьте соединение и повторите." action={<Button label="Повторить" onPress={()=>{void options.refetch();}}/>}/>:null}
    {!options.isError&&options.data&&choices?.length===0?<StateMessage kind="empty" title="Сейчас нет направлений с доступным временем"/>:null}
    {!options.isError&&choices&&choices.length>0?<InsetSection title={entry==='SPECIALTY'?'Специальности':'Услуги'}><View accessibilityRole="radiogroup">{choices.map((item,index)=><View key={item.kind==='SPECIALTY'?item.specialtyId:item.serviceCode}>{index>0?<View style={{height:1,backgroundColor:t.color.separator,marginLeft:t.spacing.lg}}/>:null}<ListRow title={item.name} selected={sameSelector(selector,item)} onPress={()=>chooseSelector(item)}/></View>)}</View></InsetSection>:null}
    {selector?<View style={{flexDirection:'row',gap:t.spacing.sm}}><View style={{flex:1}}><Button label="Список" variant={surface==='LIST'?'primary':'secondary'} onPress={()=>setSurface('LIST')}/></View><View style={{flex:1}}><Button label="Карта" variant={surface==='MAP'?'primary':'secondary'} onPress={()=>setSurface('MAP')}/></View></View>:null}
    {selector&&results.isPending?<View style={{gap:t.spacing.md}}><StateMessage kind="loading" title="Ищем врачей со свободным временем"/><SkeletonCard/><SkeletonCard/><SkeletonCard/></View>:null}
    {selector&&results.isError?<StateMessage kind="error" title="Не удалось обновить доступность" body="Старые результаты не используются." action={<Button label="Повторить" onPress={()=>{void results.refetch();}}/>}/>:null}
    {selector&&!results.isError&&results.data?.doctors.length===0?<StateMessage kind="empty" title="Свободных специалистов пока нет" body="Выберите другое направление или повторите позже."/>:null}
    {selector&&surface==='MAP'&&!results.isError&&results.data?.doctors.length?<DiscoveryMapSurface doctors={results.data.doctors} selectedLocationId={mapLocationId} onSelectLocation={(pin)=>{setMapLocationId(pin.locationId);setSelected(null);setStale(false);}} onShowList={()=>setSurface('LIST')}/>:null}
    {selector&&surface==='MAP'&&mapLocationId&&!results.isError?results.data?.doctors.filter(doctor=>doctor.locationId===mapLocationId).map(doctorCard):null}
    {selector&&surface==='LIST'&&!results.isError?results.data?.doctors.map(doctorCard):null}
    {results.isFetching&&results.data&&!results.isPending?<InlineBanner title="Обновляем доступность" body="Перед продолжением используем только свежий ответ сервера."/>:null}
    {stale||selected&&!current?<StateMessage kind="error" title="Выбранное время больше недоступно" body="Выберите другой вариант из обновлённого списка."/>:null}
    {selector?<><Button label={checking?'Проверяем…':'Продолжить'} disabled={!selected||!current||checking||results.isError||results.isFetching} onPress={()=>{void proceed();}}/><Button label="Обновить" variant="secondary" disabled={results.isFetching} onPress={()=>{setSelected(null);setStale(false);void results.refetch();}}/></>:null}
  </Screen>;
}

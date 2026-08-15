import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { Button, Card, Screen, StateMessage } from '@/ui/primitives';
import { useSession } from '@/session/SessionProvider';
import { clinicServiceApi, type ClinicServiceHandoff } from './clinic-service-api';
import type { ClinicCatalogHandoff } from './clinic-catalog-api';

export function ClinicServiceScreen({clinic,onBack,onContinue}:{clinic:ClinicCatalogHandoff;onBack():void;onContinue(value:ClinicServiceHandoff):void}){
  const {session}=useSession(); const [selectedServiceId,setSelectedServiceId]=useState<string|null>(null); const [stale,setStale]=useState(false); const [refreshFailed,setRefreshFailed]=useState(false); const [checking,setChecking]=useState(false);
  const query=useQuery({queryKey:['owner',session?.cacheScope,'clinic-services',clinic.clinicId,clinic.locationId],enabled:Boolean(session),queryFn:({signal})=>clinicServiceApi.read(session!.opaqueCredential,clinic.clinicId,clinic.locationId,signal)});
  const selectionMissing=Boolean(selectedServiceId&&query.data&&!query.data.services.some(service=>service.serviceId===selectedServiceId));
  const proceed=async()=>{if(!selectedServiceId||checking)return;setChecking(true);setStale(false);setRefreshFailed(false);try{const refreshed=await query.refetch();if(refreshed.isError){setRefreshFailed(true);return;}const service=refreshed.data?.services.find(item=>item.serviceId===selectedServiceId);if(!service){setSelectedServiceId(null);setStale(true);return;}onContinue({clinicId:clinic.clinicId,locationId:clinic.locationId,serviceId:service.serviceId});}catch{setRefreshFailed(true);}finally{setChecking(false);}};
  return <Screen title="Клиника и услуга">
    {query.isPending?<StateMessage kind="loading" title="Загружаем услуги"/>:null}
    {query.isError?<StateMessage kind="error" title="Не удалось обновить карточку клиники" action={<Button label="Повторить" onPress={()=>{void query.refetch();}}/>}/>:null}
    {!query.isError&&query.data?<><Card><View style={{gap:6}}><Text style={{fontWeight:'600'}}>{query.data.name}</Text><Text>{query.data.address}</Text>{query.data.phone?<Text>{query.data.phone}</Text>:null}</View></Card>{query.data.services.length===0?<StateMessage kind="empty" title="В этой клинике пока нет доступных услуг"/>:query.data.services.map(service=><Card key={service.serviceId} selected={service.serviceId===selectedServiceId} onPress={()=>{setSelectedServiceId(service.serviceId);setStale(false);}}><Text style={{fontWeight:'600'}}>{service.name}</Text><Text>Информационная цена: {service.price.amount} {service.price.currency}</Text></Card>)}</>:null}
    {stale||selectionMissing?<StateMessage kind="error" title="Выбранная услуга больше недоступна. Выберите другую."/>:null}
    {refreshFailed?<StateMessage kind="error" title="Не удалось проверить услугу. Повторите попытку."/>:null}
    <Button label={checking?'Проверяем…':'Продолжить'} disabled={!selectedServiceId||selectionMissing||checking||query.isError} onPress={()=>{void proceed();}}/>
    <Button label="Назад к каталогу" onPress={onBack}/>
  </Screen>;
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { BodyText, Button, Card, InsetSection, ListRow, Screen, SkeletonCard, StateMessage } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { useSession } from '@/session/SessionProvider';
import { clinicServiceApi, type ClinicServiceHandoff } from './clinic-service-api';
import type { ClinicCatalogHandoff } from './clinic-catalog-api';

export function ClinicServiceScreen({clinic,preferredServiceId,onBack,onContinue}:{clinic:ClinicCatalogHandoff;preferredServiceId?:string;onBack():void;onContinue(value:ClinicServiceHandoff):void}){
  const {session}=useSession(); const [selectedServiceId,setSelectedServiceId]=useState<string|null>(preferredServiceId??null); const [stale,setStale]=useState(false); const [refreshFailed,setRefreshFailed]=useState(false); const [checking,setChecking]=useState(false);
  const query=useQuery({queryKey:['owner',session?.cacheScope,'clinic-services',clinic.clinicId,clinic.locationId],enabled:Boolean(session),queryFn:({signal})=>clinicServiceApi.read(session!.opaqueCredential,clinic.clinicId,clinic.locationId,signal)});
  const selectionMissing=Boolean(selectedServiceId&&query.data&&!query.data.services.some(service=>service.serviceId===selectedServiceId));
  const proceed=async()=>{if(!selectedServiceId||checking)return;setChecking(true);setStale(false);setRefreshFailed(false);try{const refreshed=await query.refetch();if(refreshed.isError){setRefreshFailed(true);return;}const service=refreshed.data?.services.find(item=>item.serviceId===selectedServiceId);if(!service){setSelectedServiceId(null);setStale(true);return;}onContinue({clinicId:clinic.clinicId,locationId:clinic.locationId,serviceId:service.serviceId});}catch{setRefreshFailed(true);}finally{setChecking(false);}};
  return <Screen title="Клиника и услуга" subtitle="Выберите услугу — цена носит информационный характер." backAction={onBack}>
    {query.isPending?<View style={{gap:t.spacing.md}}><StateMessage kind="loading" title="Загружаем услуги"/><SkeletonCard/><SkeletonCard/><SkeletonCard/></View>:null}
    {query.isError?<StateMessage kind="error" title="Не удалось обновить карточку клиники" body="Покажем услуги после безопасного обновления." action={<Button label="Повторить" onPress={()=>{void query.refetch();}}/>}/>:null}
    {!query.isError&&query.data?<><Card><BodyText>{query.data.name}</BodyText><BodyText secondary>{query.data.address}</BodyText>{query.data.phone?<BodyText secondary>{query.data.phone}</BodyText>:null}</Card>{query.data.services.length===0?<StateMessage kind="empty" title="Пока нет доступных услуг" body="Выберите другую клинику или вернитесь позже."/>:<InsetSection title="Услуги" footer="Цена справочная. Оплата не выполняется в приложении.">{query.data.services.map((service,index)=><View key={service.serviceId}>{index>0?<View style={{height:1,backgroundColor:t.color.separator,marginLeft:t.spacing.lg}}/>:null}<ListRow title={service.name} subtitle="Информационная цена" detail={`${service.price.amount} ${service.price.currency}`} selected={service.serviceId===selectedServiceId} onPress={()=>{setSelectedServiceId(service.serviceId);setStale(false);}}/></View>)}</InsetSection>}</>:null}
    {stale||selectionMissing?<StateMessage kind="error" title="Выбранная услуга больше недоступна. Выберите другую."/>:null}
    {refreshFailed?<StateMessage kind="error" title="Не удалось проверить услугу. Повторите попытку."/>:null}
    <Button label={checking?'Проверяем…':'Продолжить'} disabled={!selectedServiceId||selectionMissing||checking||query.isError} onPress={()=>{void proceed();}}/>
    <Button label="Назад к каталогу" variant="ghost" onPress={onBack}/>
  </Screen>;
}

import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { Button, Card, Screen, StateMessage } from '@/ui/primitives';
import { useSession } from '@/session/SessionProvider';
import { clinicCatalogApi, type ClinicCatalogHandoff } from './clinic-catalog-api';

export function ClinicCatalogScreen({onClose,onOpenClinic}:{onClose():void;onOpenClinic(clinic:ClinicCatalogHandoff):void}){
  const {session}=useSession();
  const query=useQuery({queryKey:['owner',session?.cacheScope,'clinic-catalog'],enabled:Boolean(session),queryFn:({signal})=>clinicCatalogApi.list(session!.opaqueCredential,signal)});
  return <Screen title="Клиники">
    {query.isPending?<StateMessage kind="loading" title="Загружаем клиники"/>:null}
    {query.isError?<StateMessage kind="error" title="Не удалось загрузить клиники" action={<Button label="Повторить" onPress={()=>{void query.refetch();}}/>}/>:null}
    {!query.isError&&query.data?.clinics.length===0?<StateMessage kind="empty" title="Сейчас нет клиник для онлайн-записи"/>:null}
    {!query.isError&&query.data?.clinics.map(clinic=><Card key={clinic.locationId}><View style={{gap:6}}><Text style={{fontWeight:'600'}}>{clinic.name}</Text><Text>{clinic.address}</Text>{clinic.phone?<Text>{clinic.phone}</Text>:null}<Button label="Открыть клинику" onPress={()=>onOpenClinic({clinicId:clinic.clinicId,locationId:clinic.locationId})}/></View></Card>)}
    <Button label="Назад" onPress={onClose}/>
  </Screen>;
}

import {useState} from 'react';
import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { Button, Card, Field, Screen, StateMessage } from '@/ui/primitives';
import { useSession } from '@/session/SessionProvider';
import { clinicCatalogApi, type ClinicCatalogHandoff } from './clinic-catalog-api';

export function ClinicCatalogScreen({onClose,onOpenClinic}:{onClose():void;onOpenClinic(clinic:ClinicCatalogHandoff):void}){
  const {session}=useSession();
  const [search,setSearch]=useState('');
  const term=search.trim().toLocaleLowerCase('ru-RU');
  const query=useQuery({queryKey:['owner',session?.cacheScope,'clinic-catalog'],enabled:Boolean(session),queryFn:({signal})=>clinicCatalogApi.list(session!.opaqueCredential,signal)});
  const clinics=!query.isError?query.data?.clinics.filter(clinic=>`${clinic.name} ${clinic.address}`.toLocaleLowerCase('ru-RU').includes(term)):undefined;
  return <Screen title="Клиники" step="Запись · шаг 2 из 5" onBack={onClose}>
    <Text>Найдите клинику или филиал, затем выберите услугу и свободное время.</Text><Field label="Название клиники или адрес" value={search} onChangeText={setSearch} maxLength={100} autoCapitalize="none"/>
    {query.isPending?<StateMessage kind="loading" title="Загружаем клиники"/>:null}
    {query.isError?<StateMessage kind="error" title="Не удалось загрузить клиники" action={<Button label="Повторить" onPress={()=>{void query.refetch();}}/>}/>:null}
    {!query.isError&&query.data?.clinics.length===0?<StateMessage kind="empty" title="Сейчас нет клиник для онлайн-записи"/>:null}
    {!query.isError&&clinics?.map(clinic=><Card key={clinic.locationId}><View style={{gap:6}}><Text style={{fontWeight:'700',fontSize:18}}>{clinic.name}</Text><Text>Филиал: {clinic.address}</Text>{clinic.phone?<Text>{clinic.phone}</Text>:null}<Button label="Открыть клинику" variant="secondary" onPress={()=>onOpenClinic({clinicId:clinic.clinicId,locationId:clinic.locationId})}/></View></Card>)}
    {clinics?.length===0&&Boolean(term)&&Boolean(query.data?.clinics.length)?<StateMessage kind="empty" title="По этому запросу клиник не найдено" action={<Button label="Сбросить поиск" variant="secondary" onPress={()=>setSearch('')}/>}/>:null}
  </Screen>;
}

import { useQuery } from '@tanstack/react-query';
import { View } from 'react-native';
import { BodyText, Button, Card, Screen, SkeletonCard, StateMessage } from '@/ui/primitives';
import { uiTokens as t } from '@/ui/tokens';
import { useSession } from '@/session/SessionProvider';
import { clinicCatalogApi, type ClinicCatalogHandoff } from './clinic-catalog-api';

export function ClinicCatalogScreen({onClose,onOpenClinic}:{onClose():void;onOpenClinic(clinic:ClinicCatalogHandoff):void}){
  const {session}=useSession();
  const query=useQuery({queryKey:['owner',session?.cacheScope,'clinic-catalog'],enabled:Boolean(session),queryFn:({signal})=>clinicCatalogApi.list(session!.opaqueCredential,signal)});
  return <Screen title="Клиники" subtitle="Выберите место, где будет удобно показать питомца." backAction={onClose}>
    {query.isPending?<View style={{gap:t.spacing.md}}><StateMessage kind="loading" title="Загружаем клиники"/><SkeletonCard/><SkeletonCard/><SkeletonCard/></View>:null}
    {query.isError?<StateMessage kind="error" title="Не удалось загрузить клиники" body="Список не изменён. Проверьте соединение и повторите." action={<Button label="Повторить" onPress={()=>{void query.refetch();}}/>}/>:null}
    {!query.isError&&query.data?.clinics.length===0?<StateMessage kind="empty" title="Пока нет клиник для онлайн-записи" body="Попробуйте обновить список немного позже."/>:null}
    {!query.isError&&query.data?.clinics.map(clinic=><Card key={clinic.locationId}><BodyText>{clinic.name}</BodyText><BodyText secondary>{clinic.address}</BodyText>{clinic.phone?<BodyText secondary>{clinic.phone}</BodyText>:null}<View style={{paddingTop:t.spacing.sm}}><Button label="Выбрать клинику" variant="secondary" onPress={()=>onOpenClinic({clinicId:clinic.clinicId,locationId:clinic.locationId})}/></View></Card>)}
    <Button label="Назад" variant="ghost" onPress={onClose}/>
  </Screen>;
}

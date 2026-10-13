import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import { useSession } from '@/session/SessionProvider';
import { Button, Card, Screen, StateMessage, StatusBadge } from '@/ui/primitives';
import { appointmentsApi, type Appointment, type AppointmentDetail } from './appointments-api';

import { AlternativeDecision } from './AlternativeDecision';
import { MedicalSharingScreen } from '@/medical-sharing/MedicalSharingScreen';

import {appointmentDate} from './appointment-date';
export function AppointmentCard({ appointment, onPress }: { appointment: Appointment; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Открыть запись: ${appointment.pet.name}, ${appointment.clinic.name}, ${appointmentDate(appointment.startsAt)}`} onPress={onPress}>
    <Card><View style={{ gap: 8 }}><StatusBadge label={appointment.presentation.label} tone={appointment.presentation.tone}/><Text style={{ fontSize: 18, fontWeight: '600' }}>{appointmentDate(appointment.startsAt)}</Text><Text>{appointment.pet.name} · {appointment.clinic.name}</Text><Text>{appointment.clinic.address}</Text><Text style={{ color: '#126b5b' }}>Подробнее →</Text></View></Card>
  </Pressable>;
}
export function OwnerAppointmentsScreen({ onBack, onBook, initialHoldId, petId }: { onBack(): void; onBook(): void; initialHoldId?: string; petId?: string }) {
  const { session } = useSession();
  const cache = useQueryClient();
  const [selected, setSelected] = useState(initialHoldId ?? null);
  const [tab, setTab] = useState<'upcoming' | 'history'>('upcoming');
  const query = useQuery({ queryKey: ['owner', session?.cacheScope, 'appointments'], enabled: Boolean(session), queryFn: ({ signal }) => appointmentsApi.list(session!.opaqueCredential, signal) });
  if (selected) return <AppointmentDetails key={`${session?.cacheScope}:${selected}`} holdId={selected} onBack={() => setSelected(null)} onBook={onBook}/>;
  const items = !query.isError ? query.data?.filter(item => (!petId || item.pet.id === petId) && (tab === 'history' ? item.bucket === 'HISTORY' : item.bucket !== 'HISTORY')).sort((a,b) => tab === 'history' ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)) : undefined;
  return <Screen title="Мои записи" onBack={()=>{void cache.invalidateQueries({queryKey:['owner',session?.cacheScope,'appointments']});onBack();}} backLabel="На главную">
    <View style={{ flexDirection: 'row', flexWrap:'wrap', gap: 12 }}><Button label="Предстоящие" variant={tab === 'upcoming' ? 'primary' : 'secondary'} onPress={() => setTab('upcoming')}/><Button label="История" variant={tab === 'history' ? 'primary' : 'secondary'} onPress={() => setTab('history')}/></View>
    {query.isPending ? <StateMessage kind="loading" title="Загружаем записи"/> : null}
    {query.isError ? <StateMessage kind="error" title="Не удалось обновить записи. Актуальный статус неизвестен." action={<Button label="Повторить" onPress={() => { void query.refetch(); }}/>} /> : null}
    {items?.length === 0 ? <StateMessage kind="empty" title={tab === 'history' ? 'История приёмов пока пуста' : 'Предстоящих записей пока нет'} action={<Button label="Записать питомца" onPress={onBook}/>} /> : null}
    {items?.some(item=>item.bucket==='REQUIRES_ACTION')?<Text style={{fontWeight:'600',color:'#65409c'}}>Некоторым записям требуется ваше решение — откройте детали.</Text>:null}
    {items?.map(item => <AppointmentCard key={item.holdId} appointment={item} onPress={() => setSelected(item.holdId)}/>)}
    <Button label="Обновить записи" variant="secondary" disabled={query.isFetching} onPress={() => { void query.refetch(); }}/>
  </Screen>;
}
function AppointmentDetails({ holdId, onBack, onBook }: { holdId: string; onBack(): void; onBook(): void }) {
  const { session } = useSession(); const cache = useQueryClient();
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  type CancelCommand = { detail: AppointmentDetail; key: string; uncertain: boolean };
  const commandKey = ['owner', session?.cacheScope, 'appointment-cancel-command', holdId];
  const [command, setCommand] = useState<CancelCommand | null>(() => cache.getQueryData<CancelCommand>(commandKey) ?? null);
  const active = useRef(true), flight = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const query = useQuery({ queryKey: ['owner', session?.cacheScope, 'appointment', holdId], enabled: Boolean(session), queryFn: ({ signal }) => appointmentsApi.read(session!.opaqueCredential, holdId, signal) });
  const [sharing,setSharing]=useState(false);
  const detail = !query.isError ? query.data : undefined;
  async function cancel() {
    if (!session || !detail || flight.current) return;
    const pending = command ?? { detail, key: crypto.randomUUID(), uncertain: false };
    // Manual cancellation has no replay contract. After an uncertain response, only read back.
    if (pending.uncertain && pending.detail.cancellation.cancellationPolicyCode !== 'ACTIVE_HOLD_RELEASE_V1') { void query.refetch(); return; }
    cache.setQueryDefaults(commandKey, { gcTime: Infinity });
    setCommand(pending); cache.setQueryData(commandKey, pending); flight.current = true; setBusy(true); setMessage(null);
    try {
      await appointmentsApi.cancel(session.opaqueCredential, pending.detail, pending.key);
      await cache.invalidateQueries({ queryKey: ['owner', session.cacheScope, 'appointments'] });
      if (!active.current) return;
      setMessage(pending.detail.cancellation.cancellationPolicyCode === 'ACTIVE_HOLD_RELEASE_V1' ? 'Отмена отправлена. Проверьте обновлённый статус.' : 'Запрос на отмену отправлен. Запись остаётся действующей до решения клиники.');
      pending.uncertain = true; cache.setQueryData(commandKey, { ...pending }); setCommand({ ...pending }); setConfirming(false);
      await query.refetch();
    } catch (error) {
      if (!active.current) return;
      const rejected = error instanceof ApiError && error.status && error.status < 500;
      pending.uncertain = !rejected; cache.setQueryData(commandKey, { ...pending }); setCommand({ ...pending });
      if (pending.detail.cancellation.cancellationPolicyCode === 'CLINIC_CONFIRMATION_REQUIRED_V1') setConfirming(false);
      setMessage(rejected ? 'Клиника уже обновила запись или отмена недоступна. Обновите статус.' : 'Ответ не получен. Статус отмены неизвестен. Обновите запись; при необходимости свяжитесь с клиникой.');
      if (rejected) { setCommand(null); cache.removeQueries({ queryKey: commandKey, exact: true }); setConfirming(false); await query.refetch(); }
    } finally { flight.current = false; if (active.current) setBusy(false); }
  }
  if(sharing) return <MedicalSharingScreen initialHoldId={holdId} onBack={()=>setSharing(false)}/>;
  return <Screen title="Детали записи" backLabel="Назад к записям" backDisabled={busy || confirming && Boolean(command?.uncertain)} onBack={()=>{void cache.invalidateQueries({queryKey:['owner',session?.cacheScope,'appointments']});onBack();}}>
    {query.isPending ? <StateMessage kind="loading" title="Загружаем запись"/> : null}
    {query.isError ? <StateMessage kind="error" title="Запись недоступна. Обновите данные или вернитесь к списку."/> : null}
    {detail ? <><StatusBadge label={detail.presentation.label} tone={detail.presentation.tone}/><Text>{detail.presentation.description}</Text>{detail.appointmentLifecycle?.state==='CANCELLED_BY_CLINIC'?<Card><Text>Приём отменён клиникой</Text>{detail.appointmentLifecycle.reasonText?<Text>Причина: {detail.appointmentLifecycle.reasonText}</Text>:null}</Card>:null}<Card><View style={{ gap: 8 }}><Text style={{ fontSize: 20, fontWeight: '600' }}>{appointmentDate(detail.startsAt)}</Text><Text>{detail.pet.name} · {detail.service.name ?? 'Приём'}</Text><Text>{detail.clinic.name}</Text><Text>{detail.location.address}</Text>{detail.location.phone ? <Button label={`Позвонить: ${detail.location.phone}`} variant="secondary" onPress={() => { void Linking.openURL(`tel:${detail.location.phone!.replace(/[^+\d]/g, '')}`).catch(() => setMessage('Не удалось открыть телефон. Номер указан в карточке клиники.')); }}/>:null}</View></Card>
      {detail.actions.canReviewAlternative ? <AlternativeDecision key={`${session?.cacheScope}:${session?.opaqueCredential}:${holdId}`} token={session!.opaqueCredential} detail={detail} onResolved={()=>{void query.refetch();void cache.invalidateQueries({queryKey:['owner',session?.cacheScope,'appointments']});}}/> : null}
      {detail.appointmentId ? <Button label="Медицинские данные для этого приёма" variant="secondary" onPress={()=>setSharing(true)}/> : null}
      {detail.cancellation.canCancel && detail.cancellation.cancellationPolicyCode === 'CLINIC_CONFIRMATION_REQUIRED_V1' ? <Card><Text>Для отмены подтверждённого приёма свяжитесь с клиникой. Запись действует до подтверждения отмены сервером.</Text></Card> : null}
      <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '600' }}>История статуса</Text>{detail.timeline.map((event,index) => <Card key={`${event.at}:${index}`}><Text>{appointmentDate(event.at)} · {event.label}</Text><Text>{event.description}</Text></Card>)}
      {detail.cancellation.canCancel && detail.cancellation.cancellationPolicyCode === 'ACTIVE_HOLD_RELEASE_V1' && !command?.uncertain ? <Button label="Отменить запись" variant="secondary" disabled={busy} onPress={() => setConfirming(true)}/> : null}
      {confirming ? <Card><Text>{detail.cancellation.cancellationPolicyCode === 'ACTIVE_HOLD_RELEASE_V1' ? 'Отменить заявку и освободить выбранное время?' : 'Отправить клинике запрос на отмену? До решения клиники запись останется действующей.'}</Text><Button label={busy ? 'Отправляем…' : 'Подтвердить отмену'} disabled={busy} onPress={() => { void cancel(); }}/><Button label="Вернуться к деталям" variant="ghost" disabled={busy || Boolean(command?.uncertain)} onPress={() => setConfirming(false)}/></Card> : null}
      {command?.uncertain && command.detail.cancellation.cancellationPolicyCode === 'ACTIVE_HOLD_RELEASE_V1' && confirming ? <Button label="Проверить отмену повторно" disabled={busy} onPress={() => { void cancel(); }}/> : null}
      {detail.bucket === 'HISTORY' ? <Button label="Записать снова" onPress={onBook}/> : null}
    </> : null}
    {message || command?.uncertain ? <Text accessibilityRole="alert">{message ?? "Предыдущий запрос на отмену уже отправлялся. Проверьте актуальный статус или свяжитесь с клиникой."}</Text> : null}
    <Button label="Обновить статус" variant="secondary" disabled={busy || query.isFetching} onPress={() => { void query.refetch(); }}/>
  </Screen>;
}

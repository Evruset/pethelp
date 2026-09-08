'use client';

import { useState } from 'react';
import type { ClinicScheduleService, DoctorShiftInventory } from '@/lib/api/clinic-schedule';

type Props = { clinicId: string; locationId: string; services: ClinicScheduleService[]; initialInventory: DoctorShiftInventory; canManage: boolean };
const localAtZone = (date: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('sv-SE', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
};

function GeneratedSlotPreview({slots,timezone}:{slots:DoctorShiftInventory['generatedSlots'];timezone:string}){
  if(!slots.length) return <p className="mt-3 text-sm text-slate-500">Сначала сгенерируйте окна для предварительного просмотра.</p>;
  return <div className="mt-3" aria-label="Предпросмотр сгенерированных окон">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Предпросмотр · {slots.length}</p>
    <ul className="mt-2 grid gap-2 sm:grid-cols-2">
      {slots.map((slot)=>{const occupancy=slot.booked_count>0?'Записан':slot.held_count>0?'Удерживается':slot.publication_state==='BLOCKED'?'Заблокирован':slot.publication_state==='PUBLISHED'?'Опубликован':'Черновик';return <li key={slot.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
        <span className="font-semibold text-slate-900">{new Date(slot.starts_at).toLocaleTimeString('ru-RU',{timeZone:timezone,hour:'2-digit',minute:'2-digit'})}–{new Date(slot.ends_at).toLocaleTimeString('ru-RU',{timeZone:timezone,hour:'2-digit',minute:'2-digit'})}</span>
        <span className="ml-2 text-slate-600">{slot.service_name} · {occupancy}</span>
      </li>})}
    </ul>
  </div>;
}

export function DoctorShiftPanel({ clinicId, locationId, services, initialInventory, canManage }: Props) {
  const [inventory, setInventory] = useState(initialInventory);
  const [doctorId, setDoctorId] = useState(initialInventory.doctors[0]?.doctor_id ?? '');
  const [serviceId, setServiceId] = useState(services.find((item) => item.active)?.id ?? '');
  const [startsAt, setStartsAt] = useState(localAtZone(new Date(Date.now() + 86_400_000), initialInventory.timezone));
  const [endsAt, setEndsAt] = useState(localAtZone(new Date(Date.now() + 90_000_000), initialInventory.timezone));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const selectedDoctor = inventory.doctors.find((item) => item.doctor_id === doctorId);

  async function refresh() {
    const url = new URL(`/api/clinic/${clinicId}/locations/${locationId}/schedule/doctor-shift-inventory`, window.location.origin);
    url.searchParams.set('from', new Date().toISOString());
    url.searchParams.set('to', new Date(Date.now() + 14 * 86_400_000).toISOString());
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('REFRESH_FAILED');
    const next = await response.json() as DoctorShiftInventory;
    setInventory(next);
    setDoctorId((current) => next.doctors.some((doctor) => doctor.doctor_id === current) ? current : (next.doctors[0]?.doctor_id ?? ''));
  }

  async function command(action: string, body: Record<string, unknown>, shiftVersion?: number):Promise<boolean> {
    if(!canManage||!inventory.mutationEnabled){setNotice('Изменения DoctorShift недоступны в текущем режиме.');return false;}
    setBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/clinic/${clinicId}/locations/${locationId}/schedule/doctor-shift-inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), ...(shiftVersion ? { 'If-Match': String(shiftVersion) } : {}) },
        body: JSON.stringify({ action, ...body }), cache: 'no-store',
      });
      const payload = await response.json().catch(() => null) as { code?: string } | null;
      if (!response.ok) throw new Error(payload?.code ?? 'BACKEND_UNAVAILABLE');
      await refresh(); setNotice('Изменения сохранены в авторитетном расписании.'); return true;
    } catch (error) { const code=error instanceof Error?error.message:'BACKEND_UNAVAILABLE';setNotice(code.includes('STALE')||code.includes('CONFLICT')?'Смена уже изменена другим пользователем. Данные обновлены — повторите действие.':`Действие не выполнено: ${code}`);if(code.includes('STALE')||code.includes('CONFLICT'))await refresh().catch(()=>undefined);return false; }
    finally { setBusy(false); }
  }

  async function createShift() {
    if (!selectedDoctor) { setNotice('Сначала выберите связанного врача.'); return; }
    if (editingShiftId) {
      const shift=inventory.shifts.find((item)=>item.id===editingShiftId); if(!shift) return;
      if(await command('update', { shiftId: shift.id, startsAt, endsAt }, shift.version))setEditingShiftId(null); return;
    }
    if (!inventory.doctorServices.some((item) => item.doctor_id === doctorId && item.service_id === serviceId && item.active)) {
      if(!await command('assign-service', { staffId: selectedDoctor.staff_id, doctorId, serviceId }))return;
    }
    await command('create-shift', { staffId: selectedDoctor.staff_id, doctorId, startsAt, endsAt });
  }

  return <section className="mt-4 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm" aria-labelledby="doctor-shifts-heading">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h2 id="doctor-shifts-heading" className="text-lg font-semibold text-slate-950">Смены врачей и публикация</h2><p className="mt-1 text-sm text-slate-600">Генерация создает черновик. Owner App увидит только опубликованные окна.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">Pilot capacity: 1</span></div>
    {notice ? <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">{notice}</p> : null}
    {!canManage?<p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status">Режим просмотра: создание, публикация и изменение смен доступны только администратору клиники.</p>:null}
    {canManage&&!inventory.mutationEnabled?<p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">DoctorShift работает в режиме чтения: публикация и изменения выключены rollout-флагом.</p>:null}
    {inventory.doctors.length === 0 ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-amber-900">Нет активного врача со связью staff ↔ каталог. Выберите явное соответствие без сопоставления по имени.</p>
      {canManage?<div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select aria-label="Сотрудник-ветеринар" id="mapping-staff" className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm">{inventory.veterinarians.filter((item)=>!item.catalog_doctor_id).map((item)=><option key={item.id} value={item.id}>{item.display_name}</option>)}</select>
        <select aria-label="Врач каталога" id="mapping-doctor" className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm">{inventory.catalogDoctors.map((item)=><option key={item.id} value={item.id}>{item.full_name}</option>)}</select>
        <button type="button" disabled={busy||!inventory.mutationEnabled||!inventory.veterinarians.some((item)=>!item.catalog_doctor_id)||!inventory.catalogDoctors.length} onClick={()=>{const staff=document.querySelector<HTMLSelectElement>('#mapping-staff')?.value;const doctor=document.querySelector<HTMLSelectElement>('#mapping-doctor')?.value;if(staff&&doctor)void command('map-doctor',{staffId:staff,doctorId:doctor});}} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">Связать врача</button>
      </div>:null}
    </div> : canManage?<div className="mt-4 grid gap-3 md:grid-cols-5">
      <label><span className="text-xs font-semibold uppercase text-slate-500">Врач</span><select value={doctorId} onChange={(event)=>setDoctorId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">{inventory.doctors.map((doctor)=><option key={doctor.doctor_id} value={doctor.doctor_id}>{doctor.full_name}</option>)}</select></label>
      <label><span className="text-xs font-semibold uppercase text-slate-500">Услуга</span><select value={serviceId} onChange={(event)=>setServiceId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">{services.filter((item)=>item.active).map((service)=><option key={service.id} value={service.id}>{service.displayName} · {service.durationMinutes} мин</option>)}</select></label>
      <label><span className="text-xs font-semibold uppercase text-slate-500">Начало</span><input type="datetime-local" value={startsAt} onChange={(event)=>setStartsAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      <label><span className="text-xs font-semibold uppercase text-slate-500">Конец</span><input type="datetime-local" value={endsAt} onChange={(event)=>setEndsAt(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
      <div className="flex items-end"><button type="button" disabled={busy||!inventory.mutationEnabled||!serviceId} onClick={()=>void createShift()} className="w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300">{editingShiftId?'Сохранить смену':'Создать смену'}</button></div>
    </div>:null}
    <div className="mt-5 grid gap-3 lg:grid-cols-2">{inventory.shifts.map((shift)=>{const shiftRuns=inventory.runs.filter((item)=>item.doctor_shift_id===shift.id);const run=shift.status==='PUBLISHED'?(shiftRuns.find((item)=>item.status==='PUBLISHED')??shiftRuns[0]):shiftRuns[0];const slots=run?inventory.generatedSlots.filter((item)=>item.generation_run_id===run.id):[];const protectedInventory=slots.some((slot)=>slot.held_count>0||slot.booked_count>0);return <article key={shift.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{new Date(shift.startsAt).toLocaleString('ru-RU',{timeZone:shift.timezone})} — {new Date(shift.endsAt).toLocaleTimeString('ru-RU',{timeZone:shift.timezone,hour:'2-digit',minute:'2-digit'})}</p><p className="mt-1 text-xs text-slate-500">{shift.timezone} · v{shift.version} · generation {shift.generationVersion}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{shift.status}</span></div><GeneratedSlotPreview slots={slots} timezone={shift.timezone}/>{protectedInventory?<p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Смена защищена удержанием или записью. Снять публикацию, заблокировать или отменить её можно после освобождения окон.</p>:null}{canManage?<div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy||!inventory.mutationEnabled||shift.status!=='DRAFT'} onClick={()=>{setEditingShiftId(shift.id);setStartsAt(localAtZone(new Date(shift.startsAt),shift.timezone));setEndsAt(localAtZone(new Date(shift.endsAt),shift.timezone));}} className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:text-slate-400">Изменить</button><button type="button" disabled={busy||!inventory.mutationEnabled||shift.status!=='DRAFT'} onClick={()=>void command('generate',{shiftId:shift.id},shift.version)} className="min-h-11 rounded-lg border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-800 disabled:text-slate-400">Сгенерировать</button>{shift.status==='DRAFT'&&run?.status==='GENERATED'?<button type="button" disabled={busy||!inventory.mutationEnabled} onClick={()=>void command('publish',{runId:run.id})} className="min-h-11 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Опубликовать {run.slot_count}</button>:null}{run?.status==='PUBLISHED'?<button type="button" disabled={busy||!inventory.mutationEnabled||protectedInventory} onClick={()=>void command('unpublish',{runId:run.id})} className="min-h-11 rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold text-amber-800 disabled:text-slate-400">Снять публикацию</button>:null}<button type="button" disabled={busy||!inventory.mutationEnabled||protectedInventory||shift.status==='BLOCKED'||shift.status==='CANCELLED'} onClick={()=>void command('block',{shiftId:shift.id},shift.version)} className="min-h-11 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 disabled:text-slate-400">Заблокировать</button><button type="button" disabled={busy||!inventory.mutationEnabled||protectedInventory||shift.status==='CANCELLED'} onClick={()=>void command('cancel',{shiftId:shift.id},shift.version)} className="min-h-11 rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-800 disabled:text-slate-400">Отменить смену</button></div>:null}</article>})}</div>
  </section>;
}

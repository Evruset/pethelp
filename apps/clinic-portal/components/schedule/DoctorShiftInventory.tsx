import type { ClinicDoctorShift, ClinicScheduleSlot } from '@/lib/api/clinic-schedule';

type Props = { shifts?: ClinicDoctorShift[]; slots: ClinicScheduleSlot[]; staffId: string; timezone?: string; loading: boolean; failed: boolean };

/** Read-only inventory. Shift publication never substitutes for a bookable slot. */
export function DoctorShiftInventory({ shifts, slots, staffId, timezone, loading, failed }: Props) {
  const visible=(shifts??[]).filter(shift=>!staffId||shift.staff.id===staffId);
  const zone=timezone??'UTC';
  const day=(value:string)=>new Intl.DateTimeFormat('ru-RU',{timeZone:zone,day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value));
  const time=(value:string)=>new Intl.DateTimeFormat('ru-RU',{timeZone:zone,hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  return <section id="schedule-shifts" aria-labelledby="doctor-shifts-title" className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="p-5"><h2 id="doctor-shifts-title" className="text-lg font-semibold text-slate-950">Смены врачей</h2>
      <p className="mt-1 text-sm text-slate-600">Рабочее время специалистов. Запись доступна только на опубликованные окна. Время смен: {zone}.</p>
      {!loading&&!failed&&shifts!==undefined?<p className="mt-2 text-sm font-medium text-slate-700">Показано смен: {visible.length}</p>:null}</div>
    {loading||failed||shifts===undefined?<p aria-live="polite" className="px-5 pb-5 text-sm text-slate-600">{failed?'Данные о сменах сейчас недоступны.':loading?'Обновляем смены…':'Данные о сменах сейчас недоступны.'}</p>:visible.length===0?<p className="px-5 pb-5 text-sm text-slate-600">В выбранном периоде и с этим фильтром смен нет.</p>:<div className="overflow-x-auto">
      <table aria-label="Смены врачей" className="vh-product-table min-w-full border-collapse text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="p-3">Дата</th><th className="p-3">Врач</th><th className="p-3">Рабочее время</th><th className="p-3">Статус</th><th className="p-3">Окна в выбранном периоде</th></tr></thead><tbody>
        {visible.map(shift=>{const related=slots.filter(slot=>slot.staff?.id===shift.staff.id&&slot.startsAt>=shift.startsAt&&slot.endsAt<=shift.endsAt);return <tr key={shift.id} className="border-t border-slate-200 odd:bg-white even:bg-slate-50"><td data-label="Дата" className="p-3 font-medium">{day(shift.startsAt)}</td><td data-label="Врач" className="p-3">{shift.doctor.displayName}</td><td data-label="Рабочее время" className="p-3">{time(shift.startsAt)}–{time(shift.endsAt)}{day(shift.startsAt)!==day(shift.endsAt)?` (${day(shift.endsAt)})`:''}</td><td data-label="Статус" className="p-3">{shift.status==='PUBLISHED'?'Опубликована':'Отменена'}</td><td data-label="Окна в выбранном периоде" className="p-3">{related.length}</td></tr>;})}
      </tbody></table></div>}
  </section>;
}

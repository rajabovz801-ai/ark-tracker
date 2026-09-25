export type AttendanceRecord={checked_in:string|null;checked_out:string|null;status:'pending'|'present'|'absent';late_min:number;};
export function dailyCounts(records:AttendanceRecord[],grace=5){
  const present=records.filter(r=>r.checked_in!==null).length;
  const absent=records.filter(r=>r.status==='absent'&&r.checked_in===null).length;
  const pending=records.filter(r=>r.status==='pending'&&r.checked_in===null).length;
  const late=records.filter(r=>r.checked_in!==null&&r.late_min>grace).length;
  const missingCheckout=records.filter(r=>r.checked_in!==null&&r.checked_out===null).length;
  return {total:records.length,present,absent,pending,late,missingCheckout,percent:records.length?Math.round(present*100/records.length):0};
}
export function tashkentDate(at:Date=new Date()):string{
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at);
  const value=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return value.year+'-'+value.month+'-'+value.day;
}
export function formatTashkent(at:string|null,locale='uz-UZ'){if(!at)return '—';return new Intl.DateTimeFormat(locale,{timeZone:'Asia/Tashkent',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at));}
export function durationMinutes(start:string|null,end:string|null){if(!start||!end)return null;return Math.max(0,Math.floor((Date.parse(end)-Date.parse(start))/60000));}
export function durationLabel(minutes:number|null){if(minutes===null)return '—';return Math.floor(minutes/60)+' soat '+String(minutes%60)+' daqiqa';}
export function statusLabel(r:AttendanceRecord,closed:boolean,grace=5){if(!r.checked_in)return closed?'Kelmadi':'Kutilmoqda';if(r.checked_out)return r.late_min>grace?'Kechikib ketdi':'Ketdi';return r.late_min>grace?'Kechikdi':'Keldi';}

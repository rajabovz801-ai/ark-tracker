'use client';
import {useState} from 'react';
import {FileDown,Eye,Printer,CalendarDays,Download,Trash2,ArchiveRestore,Plus} from 'lucide-react';
import {tashkentDate} from '@/lib/domain';
import type {AdminData} from '@/lib/types';
export function ReportsPanel({data,date,setDate,onPdf,previewUrl,busy,act,onAddLesson}:{data:AdminData;date:string;setDate:(s:string)=>void;onPdf:(mode:'preview'|'download'|'print',date:string,groupId:string)=>Promise<void>;previewUrl:string;busy:boolean;act:(action:string,params?:Record<string,unknown>)=>Promise<unknown>;onAddLesson:()=>void}){
 const [groupId,setGroupId]=useState('');
 async function restore(recordId:number,lessonDate:string|null,groupName:string){
  if(!window.confirm('O‘chirilgan '+groupName+' darsini tiklaysizmi? Davomat yozuvlari va vaqtlar qaytariladi.'))return;
  try{
   await act('restoreLesson',{auditId:recordId});
   if(lessonDate)setDate(lessonDate);
  }catch{/* Error appears in admin panel */ }
 }
 async function deleteSelectedDay(){
  if(!sessions.length)return;
  const title=groupId?data.groups.find(g=>g.id===groupId)?.name||'Guruh':'Barcha guruhlar';
  const answer=window.prompt(date+' sanasidagi '+title+' uchun '+sessions.length+' ta darsni va ularning davomatini o‘chirasiz. Tasdiqlash uchun sanani aynan yozing: '+date);
  if(answer!==date)return;
  try{await act('deleteDay',{date,groupId:groupId||null});}catch{/* API error is shown globally */ }
 }
 const sessions=data.sessions.filter(s=>s.lesson_date===date&&(!groupId||s.group_id===groupId));
 const records=data.attendance.filter(a=>sessions.some(s=>s.id===a.session_id));
 const present=records.filter(a=>a.checked_in).length,absent=records.filter(a=>a.status==='absent'&&!a.checked_in).length,late=records.filter(a=>a.checked_in&&a.late_min>(data.groups.find(g=>g.id===data.sessions.find(s=>s.id===a.session_id)?.group_id)?.late_grace_min??5)).length;
 const missing=records.filter(a=>a.checked_in&&!a.checked_out&&data.sessions.find(s=>s.id===a.session_id)?.status==='closed').length;
 return <section className="panel-block"><div className="section-heading"><div><span className="eyebrow">REPORTING</span><h2>Bugungi va tarixiy hisobotlar</h2><p>Sana yoki guruhni tanlang. Davomatni saqlash, ko‘rish yoki kerak bo‘lsa o‘chirish mumkin.</p></div><button className="btn btn-outline" onClick={onAddLesson}><Plus size={16}/> Dars qo‘shish</button></div>
 <div className="report-controls"><label>Sana<input type="date" max={tashkentDate()} value={date} onChange={e=>setDate(e.target.value)}/></label><label>Guruh<select value={groupId} onChange={e=>setGroupId(e.target.value)}><option value="">Barcha guruhlar</option>{data.groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></label></div>
 <div className="stat-grid four"><div className="stat-card good"><span>Kelganlar</span><strong>{present}</strong></div><div className="stat-card danger"><span>Kelmaganlar</span><strong>{absent}</strong></div><div className="stat-card warn"><span>Kechikkanlar</span><strong>{late}</strong></div><div className="stat-card"><span>Ketishni unutganlar</span><strong>{missing}</strong></div></div>
 <div className="report-grid"><div className="report-preview"><div className="card-title"><FileDown size={19}/><h3>PDF ko‘rinishi</h3></div>{previewUrl?<iframe title="Davomat hisobotining PDF ko‘rinishi" src={previewUrl} className="pdf-frame"/>:<div className="pdf-empty"><FileDown size={46}/><h3>Hisobot ko‘rinishini oching</h3><p>PDFni ko‘rish tugmasini bosing. Hisobot haqiqiy bazadagi ma’lumotlardan tuziladi.</p></div>}</div><aside className="report-aside"><div className="side-panel"><div className="card-title"><Download size={19}/><h3>Hisobotni olish</h3></div><button className="btn btn-primary btn-block" disabled={!sessions.length||busy} onClick={()=>onPdf('download',date,groupId)}><FileDown size={18}/> PDF yuklab olish</button><button className="btn btn-outline btn-block" disabled={!sessions.length||busy} onClick={()=>onPdf('preview',date,groupId)}><Eye size={18}/> PDF ko‘rinishi</button><button className="btn btn-outline btn-block" disabled={!sessions.length||busy} onClick={()=>onPdf('print',date,groupId)}><Printer size={18}/> Chop etish</button></div><div className="side-panel"><div className="card-title"><CalendarDays size={19}/><h3>Tanlangan darslar</h3></div>{sessions.length?sessions.map(s=><div className="side-row" key={s.id}><b>{data.groups.find(g=>g.id===s.group_id)?.name}</b><span className={'badge '+(s.status==='closed'?'badge-grey':'badge-green')}>{s.status==='closed'?'Yakunlangan':'Faol'}</span></div>):<p className="muted">Tanlangan sanada dars yo‘q.</p>}</div><div className="side-panel"><h3>Davomat ulushi</h3><div className="big-percent">{records.length?Math.round(present*100/records.length):0}%</div><div className="bar-track"><i style={{width:(records.length?Math.round(present*100/records.length):0)+'%'}}/></div><p className="muted">Kechikkanlar kelganlarga qo‘shib hisoblanadi.</p></div></aside></div>
 <div className="report-audit-card"><div className="card-heading"><div><h2>O‘chirilgan darslar tarixi</h2><p>O‘chirishdan oldingi davomat audit nusxasiga yoziladi. Kerak bo‘lsa, shu yerdan tiklash mumkin.</p></div><ArchiveRestore size={20}/></div>{data.deletedRecords.length?<div className="audit-list">{data.deletedRecords.slice(0,20).map(record=><div className="audit-row" key={record.id}><div><b>{record.snapshot?.group?.name||'Guruh'} · {record.lesson_date||'Sanasiz'}</b><small>{(record.snapshot?.attendance||[]).length} nafar o‘quvchi · {new Date(record.deleted_at).toLocaleString('uz-UZ',{timeZone:'Asia/Tashkent'})}</small></div><div className="audit-controls">{record.restored_at?<span className="badge badge-green">Tiklangan</span>:<><span className="badge badge-grey">Auditda saqlangan</span><button className="btn btn-outline btn-small" disabled={busy} onClick={()=>void restore(record.id,record.lesson_date,record.snapshot?.group?.name||'Guruh')}><ArchiveRestore size={15}/> Tiklash</button></>}</div></div>)}</div>:<p className="muted">Hali o‘chirilgan darslar yo‘q.</p>}</div>
 <div className="report-danger-zone"><div><h3>Kunlik ma’lumotlarni o‘chirish</h3><p>Tanlangan sana va guruhdagi darslar, kelish-ketish yozuvlari o‘chiriladi. Ularning nusxasi audit tarixida saqlanadi.</p></div><button className="btn btn-danger-light" disabled={!sessions.length||busy} onClick={()=>void deleteSelectedDay()}><Trash2 size={17}/> {groupId?'Guruhning shu kunini o‘chirish':'Shu kunning barchasini o‘chirish'} ({sessions.length})</button></div>
 </section>;
}

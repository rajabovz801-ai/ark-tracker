import {authorize,rest} from './server';
export async function loadAdmin(req:Request){
 const {token,admin}=await authorize(req);
 const url=new URL(req.url),date=/^\d{4}-\d{2}-\d{2}$/;
 const from=date.test(url.searchParams.get('from')||'')?url.searchParams.get('from')!:'2026-01-01';
 const to=date.test(url.searchParams.get('to')||'')?url.searchParams.get('to')!:'2099-12-31';
 const [groups,students,memberships,sessions,events,devices,deletedRecords]=await Promise.all([
  rest('sa_groups?select=*&order=name',token),
  rest('sa_students?select=*&order=name',token),
  rest('sa_memberships?select=*',token),
  rest('sa_sessions?select=*&lesson_date=gte.'+from+'&lesson_date=lte.'+to+'&order=opened_at.desc&limit=500',token),
  rest('sa_events?select=id,session_id,student_id,actor_type,action,created_at&order=created_at.desc&limit=80',token),
  rest('sa_devices?select=id,label,active,last_seen,created_at&order=created_at.desc',token),
  rest('sa_deleted_records?select=id,kind,target_id,group_id,lesson_date,deleted_at,restored_at,restored_by,snapshot&order=deleted_at.desc&limit=50',token)
 ]);
 const ids=(sessions as {id:string}[]).map(s=>s.id);
 const attendance=ids.length?await rest('sa_attendance?select=*&session_id=in.('+ids.join(',')+')&limit=5000',token):[];
 return {groups,students,memberships,sessions,attendance,events,devices,deletedRecords,admin};
}

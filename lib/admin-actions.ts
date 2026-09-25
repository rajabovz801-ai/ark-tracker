import {authorize,rest,isUuid,ApiError} from './server';
const s=(x:unknown)=>typeof x==='string'?x.trim():'';
const validTime=(x:string)=>/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(x);
const mutate=(table:string,token:string,method:'POST'|'PATCH',payload:Record<string,unknown>,query='')=>rest(table+query,token,{method,body:JSON.stringify(payload)});
export async function adminAction(req:Request,token:string,body:any){
 if(!body||typeof body.action!=='string')throw new ApiError('Amal ko‘rsatilmagan');
 const action:string=body.action;
 if(action==='claim'){if(!/^[a-f0-9]{48}$/i.test(s(body.code)))throw new ApiError('Aktivatsiya kodi noto‘g‘ri');return rest('rpc/sa_claim_owner',token,{method:'POST',body:JSON.stringify({p_code:s(body.code)})});}
 await authorize(req);
 const rpc=async(name:string,payload:Record<string,unknown>)=>rest('rpc/'+name,token,{method:'POST',body:JSON.stringify(payload)});
 if(action==='deleteGroup'){if(!isUuid(body.id))throw new ApiError('Guruh noto‘g‘ri');return rpc('sa_remove_group',{p_group_id:body.id});}
 if(action==='deleteStudent'){if(!isUuid(body.id))throw new ApiError('O‘quvchi noto‘g‘ri');return rpc('sa_remove_student',{p_student_id:body.id});}
 if(action==='addLesson'||action==='editLesson'){
   if(action==='addLesson'&&!isUuid(body.groupId)||action==='editLesson'&&!isUuid(body.sessionId))throw new ApiError('Dars yoki guruh noto‘g‘ri');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(s(body.date))||!validTime(s(body.start))||!validTime(s(body.end)))throw new ApiError('Dars sanasi va vaqtini tekshiring');
   return rpc(action==='addLesson'?'sa_add_lesson':'sa_edit_lesson',
     action==='addLesson'?{p_group_id:body.groupId,p_date:body.date,p_start:body.start,p_end:body.end}
       :{p_id:body.sessionId,p_date:body.date,p_start:body.start,p_end:body.end});
 }
 if(action==='addLessonStudent'){
   if(!isUuid(body.sessionId)||!isUuid(body.studentId))throw new ApiError('Dars yoki o‘quvchi noto‘g‘ri');
   return rpc('sa_add_lesson_student',{p_session_id:body.sessionId,p_student_id:body.studentId});
 }
 if(action==='deleteLesson'){
   if(!isUuid(body.sessionId))throw new ApiError('Dars noto‘g‘ri');
   return rpc('sa_delete_lesson',{p_id:body.sessionId});
 }
 if(action==='deleteDay'){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(s(body.date))||body.groupId&&!isUuid(body.groupId))throw new ApiError('Sana yoki guruh noto‘g‘ri');
   return rpc('sa_delete_day',{p_date:body.date,p_group_id:body.groupId||null});
 }
 if(action==='addGroup'){
  const name=s(body.name),teacher=s(body.teacher).slice(0,100),start=s(body.starts_at)||'09:00',end=s(body.ends_at)||'10:30';
  if(name.length<2||name.length>80||!validTime(start)||!validTime(end))throw new ApiError('Guruh ma’lumotlarini tekshiring');
  return mutate('sa_groups',token,'POST',{name,teacher,starts_at:start,ends_at:end,late_grace_min:Math.min(120,Math.max(0,Number(body.late_grace_min)||5)),weekdays:Array.isArray(body.weekdays)?body.weekdays:[1,3,5]});
 }
 if(action==='editGroup'){
  if(!isUuid(body.id))throw new ApiError('Guruh ID noto‘g‘ri');
  const patch:Record<string,unknown>={};
  for(const key of ['name','teacher','starts_at','ends_at'])if(typeof body[key]==='string')patch[key]=s(body[key]);
  if(body.late_grace_min!==undefined)patch.late_grace_min=Math.min(120,Math.max(0,Number(body.late_grace_min)||0));
  if(Array.isArray(body.weekdays))patch.weekdays=body.weekdays.filter((d:unknown)=>Number.isInteger(d)&&Number(d)>=0&&Number(d)<=6);
  if(typeof body.archived==='boolean')patch.archived=body.archived;
  if(body.archived===true){const active=await rest('sa_sessions?select=id&group_id=eq.'+body.id+'&status=eq.active&limit=1',token);if(active.length)throw new ApiError('Guruhni arxivlashdan oldin faol darsni yakunlang yoki o‘chiring');}
  if(!Object.keys(patch).length)throw new ApiError('O‘zgartirish mavjud emas');
  return mutate('sa_groups',token,'PATCH',patch,'?id=eq.'+body.id);
 }
 if(action==='addStudent'){
  const name=s(body.name),groupIds=[...new Set((Array.isArray(body.groupIds)?body.groupIds:[]).filter(isUuid))] as string[];
  if(name.length<2||name.length>120||!groupIds.length)throw new ApiError('Ism va guruhni tanlang');
  const student=(await mutate('sa_students',token,'POST',{name}))[0];
  try{
   for(const group_id of groupIds){
    await mutate('sa_memberships',token,'POST',{group_id,student_id:student.id});
    const sessions=await rest('sa_sessions?select=id&group_id=eq.'+group_id+'&status=eq.active',token);
    for(const session of sessions)await rest('sa_attendance?on_conflict=session_id,student_id',token,{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({session_id:session.id,student_id:student.id})});
   }
  }catch(e){await rpc('sa_remove_student',{p_student_id:student.id}).catch(()=>null);throw e;}
  return student;
 }
 if(action==='editStudent'){
  if(!isUuid(body.id))throw new ApiError('O‘quvchi ID noto‘g‘ri');
  const patch:Record<string,unknown>={};
  if(typeof body.name==='string'){if(s(body.name).length<2)throw new ApiError('Ism juda qisqa');patch.name=s(body.name).slice(0,120);}
  if(typeof body.archived==='boolean')patch.archived=body.archived;
  if(Object.keys(patch).length)await mutate('sa_students',token,'PATCH',patch,'?id=eq.'+body.id);
  if(Array.isArray(body.groupIds)){
   const target=[...new Set(body.groupIds.filter(isUuid))] as string[];
   const existing=await rest('sa_memberships?select=group_id,active&student_id=eq.'+body.id,token);
   for(const row of existing)if(!target.includes(row.group_id)&&row.active)await mutate('sa_memberships',token,'PATCH',{active:false},'?student_id=eq.'+body.id+'&group_id=eq.'+row.group_id);
   for(const group_id of target){
    const found=existing.find((r:any)=>r.group_id===group_id);
    if(!found)await mutate('sa_memberships',token,'POST',{student_id:body.id,group_id});
    else if(!found.active)await mutate('sa_memberships',token,'PATCH',{active:true},'?student_id=eq.'+body.id+'&group_id=eq.'+group_id);
    const sessions=await rest('sa_sessions?select=id&group_id=eq.'+group_id+'&status=eq.active',token);
    for(const session of sessions)await rest('sa_attendance?on_conflict=session_id,student_id',token,{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({session_id:session.id,student_id:body.id})});
   }
  }
  return {ok:true};
 }
 if(action==='open'||action==='end'||action==='manual'||action==='device'){
  const rpc=action==='open'?'sa_open_session':action==='end'?'sa_end_session':action==='manual'?'sa_manual_mark':'sa_create_device';
  const payload=action==='open'?{p_group_id:body.groupId}:action==='end'?{p_session_id:body.sessionId}:action==='manual'?{p_session_id:body.sessionId,p_student_id:body.studentId,p_action:body.operation,p_at:body.at||null,p_note:body.note??null}:{p_label:s(body.label)||'Note 10'};
  if(action==='open'&&!isUuid(body.groupId)||action==='end'&&!isUuid(body.sessionId)||action==='manual'&&(!isUuid(body.sessionId)||!isUuid(body.studentId)))throw new ApiError('ID noto‘g‘ri');
  return rest('rpc/'+rpc,token,{method:'POST',body:JSON.stringify(payload)});
 }
 if(action==='editDevice'){if(!isUuid(body.id)||typeof body.active!=='boolean')throw new ApiError('Qurilma ma’lumotlarini tekshiring');return mutate('sa_devices',token,'PATCH',{active:body.active},'?id=eq.'+body.id);}
 throw new ApiError('Noma’lum amal');
}

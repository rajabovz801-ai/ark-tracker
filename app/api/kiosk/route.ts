import {rest,errorResponse,ApiError,isUuid} from '@/lib/server';
import {SUPABASE_PUBLISHABLE_KEY} from '@/lib/config';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 try{
  const body=await req.json().catch(()=>null);
  if(!body||typeof body.token!=='string'||!/^[a-f0-9]{48}$/i.test(body.token))throw new ApiError('Terminalni administrator ulashi kerak',401);
  if(body.action==='snapshot'){
   const data=await rest('rpc/sa_kiosk_snapshot',SUPABASE_PUBLISHABLE_KEY,{method:'POST',body:JSON.stringify({p_token:body.token})});
   return Response.json(data,{headers:{'Cache-Control':'no-store'}});
  }
  if(body.action==='in'||body.action==='out'){
   if(!isUuid(body.sessionId)||!isUuid(body.studentId))throw new ApiError('O‘quvchi yoki dars tanlanmagan');
   const data=await rest('rpc/sa_kiosk_event',SUPABASE_PUBLISHABLE_KEY,{method:'POST',body:JSON.stringify({p_token:body.token,p_session_id:body.sessionId,p_student_id:body.studentId,p_action:body.action})});
   return Response.json(data,{headers:{'Cache-Control':'no-store'}});
  }
  throw new ApiError('Noma’lum amal');
 }catch(e){return errorResponse(e);}
}

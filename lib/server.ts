import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config';
export class ApiError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export const isUuid=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
export function tokenOf(req:Request){return (req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');}
export async function rest(path:string,token:string,init:RequestInit={}):Promise<any>{
 const headers:Record<string,string>={'apikey':SUPABASE_PUBLISHABLE_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json','Prefer':'return=representation',...(init.headers as Record<string,string>||{})};
 const response=await fetch(SUPABASE_URL+'/rest/v1/'+path,{...init,headers,cache:'no-store'});
 const raw=await response.text();let data:any;try{data=raw?JSON.parse(raw):null;}catch{data=raw;}
 if(!response.ok)throw new ApiError(typeof data?.message==='string'?data.message:'Ma’lumotlarni olishda xatolik',response.status);
 return data;
}
export async function authorize(req:Request,requireAdmin=true){
 const token=tokenOf(req);if(!token)throw new ApiError('Hisobga kirish talab etiladi',401);
 const response=await fetch(SUPABASE_URL+'/auth/v1/user',{headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token},cache:'no-store'});
 if(!response.ok)throw new ApiError('Sessiya tugagan. Qayta kiring',401);
 const user=await response.json();if(!isUuid(user.id))throw new ApiError('Sessiya noto‘g‘ri',401);
 if(!requireAdmin)return {token,user,admin:null};
 const admins=await rest('sa_admins?select=user_id,display_name,role&user_id=eq.'+user.id,token);
 if(!Array.isArray(admins)||!admins.length)throw new ApiError('Administrator huquqi yo‘q',403);
 return {token,user,admin:admins[0]};
}
export function errorResponse(e:unknown){const status=e instanceof ApiError?e.status:500;return Response.json({error:e instanceof Error?e.message:'Server xatosi'},{status});}

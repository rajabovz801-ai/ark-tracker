import {authorize,errorResponse} from '@/lib/server';
import {loadAdmin} from '@/lib/admin-data';
import {adminAction} from '@/lib/admin-actions';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return Response.json(await loadAdmin(req),{headers:{'Cache-Control':'no-store'}});}catch(e){return errorResponse(e);}}
export async function POST(req:Request){try{const {token}=await authorize(req,false);const body=await req.json();return Response.json(await adminAction(req,token,body));}catch(e){return errorResponse(e);}}

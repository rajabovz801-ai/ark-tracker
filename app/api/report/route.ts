import PDFDocument from 'pdfkit';
import {authorize,rest,errorResponse,isUuid,ApiError} from '@/lib/server';
import {dailyCounts,formatTashkent,durationLabel,durationMinutes} from '@/lib/domain';
import type {Group,Student,Session,Attendance} from '@/lib/types';
export const dynamic='force-dynamic';
const clean=(v:unknown)=>String(v??'').replace(/[\u2018\u2019\u02bb\u02bc]/g,"'").replace(/[^\x20-\x7e\u00a0-\u00ff]/g,'?');
export async function GET(req:Request){
 try{
  const {token}=await authorize(req);
  const params=new URL(req.url).searchParams;
  const id=params.get('session'),date=params.get('date'),group=params.get('group');
  if(id&&!isUuid(id)||group&&!isUuid(group)||date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new ApiError('Hisobot parametrlari noto‘g‘ri');
  if(!id&&!date)throw new ApiError('Sana yoki darsni tanlang');
  const filter=id?'id=eq.'+id:'lesson_date=eq.'+date+(group?'&group_id=eq.'+group:'');
  const [sessions,groups,students]=await Promise.all([
   rest('sa_sessions?select=*&'+filter+'&order=planned_start.asc',token) as Promise<Session[]>,
   rest('sa_groups?select=*',token) as Promise<Group[]>,
   rest('sa_students?select=id,name',token) as Promise<Student[]>
  ]);
  if(!sessions.length)throw new ApiError('Tanlangan sanada hisobot yo‘q',404);
  const ids=sessions.map(s=>s.id);
  const attendance=await rest('sa_attendance?select=*&session_id=in.('+ids.join(',')+')&limit=5000',token) as Attendance[];
  const names=new Map(students.map(s=>[s.id,s.name]));
  const gs=new Map(groups.map(g=>[g.id,g]));
  const doc=new PDFDocument({size:'A4',margin:42,bufferPages:true,info:{Title:'ARK Education | Daily Attendance Report',Author:'ARK EDUCATION'}});
  const chunks:Buffer[]=[];
  const done=new Promise<Buffer>((resolve,reject)=>{doc.on('data',(c:Buffer)=>chunks.push(Buffer.from(c)));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
  for(let i=0;i<sessions.length;i++){
   if(i)doc.addPage();
   const session=sessions[i],g=gs.get(session.group_id);
   const rec=attendance.filter(a=>a.session_id===session.id);
   const stats=dailyCounts(rec,g?.late_grace_min??5);
   function header(continued=false){
    doc.rect(0,0,595,85).fill('#182D45');
    doc.font('Helvetica-Bold').fontSize(17).fillColor('#F2D6A0').text('ARK EDUCATION',44,24);
    doc.font('Helvetica').fontSize(8).fillColor('#FFFFFF').text('SMART ATTENDANCE  |  BILIM  -  INTIZOM  -  NATIJA',44,51);
    doc.rect(44,88,508,2).fill('#C79B54');
    doc.fillColor('#182D45').font('Helvetica-Bold').fontSize(17).text(continued?'DAVOMAT HISOBOTI (DAVOMI)':'KUNLIK DAVOMAT HISOBOTI',44,107);
    doc.fontSize(10).font('Helvetica').fillColor('#5b6775');
    doc.text('Sana: '+clean(session.lesson_date)+'   |   Guruh: '+clean(g?.name||'—'),44,136);
    doc.text('O‘qituvchi: '+clean(g?.teacher||'—')+'   |   Dars: '+formatTashkent(session.planned_start)+' - '+formatTashkent(session.planned_end),44,153);
    if(!continued){
     const tiles=[['JAMI',stats.total],['KELDI',stats.present],['KELMADI',stats.absent],['KECHIKDI',stats.late],['KETISH YO‘Q',stats.missingCheckout]];
     tiles.forEach(([label,count],n)=>{const x=44+n*103;doc.roundedRect(x,180,96,54,5).fill('#F4F6F9');doc.fillColor('#6B7789').font('Helvetica').fontSize(8).text(String(label),x+10,190,{width:77});doc.fillColor('#182D45').font('Helvetica-Bold').fontSize(18).text(String(count),x+10,204);});
     doc.font('Helvetica').fontSize(9).fillColor('#657080').text('Davomat: '+stats.percent+'%. Kechikkanlar kelganlar tarkibida hisoblanadi.',44,247);
    }
    const y=continued?184:272;
    doc.rect(44,y,507,27).fill('#E9EEF5');
    const h=['#','O‘QUVCHI','KELDI','KETDI','DAVOMIYLIGI','HOLAT'],x=[52,76,260,321,381,468],w=[20,175,56,56,81,76];
    doc.font('Helvetica-Bold').fillColor('#182D45').fontSize(8);h.forEach((t,j)=>doc.text(t,x[j],y+9,{width:w[j]}));
    return y+29;
   }
   let y=header(),row=0;
   const ordered=[...rec].sort((a,b)=>(names.get(a.student_id)||'').localeCompare(names.get(b.student_id)||'','uz'));
   if(!ordered.length){doc.font('Helvetica').fontSize(11).fillColor('#7c8793').text('Hozircha ro‘yxatda o‘quvchi yo‘q.',48,y+18);}
   for(const a of ordered){
    if(y>738){doc.addPage();y=header(true);}
    const late=a.checked_in!==null&&a.late_min>(g?.late_grace_min??5);
    const label=!a.checked_in?(session.status==='closed'?'KELMADI':'KUTILMOQDA'):late?'KECHIKDI':a.checked_out?'KETDI':'KELDI';
    if(row%2===1)doc.rect(44,y,507,23).fill('#F9FAFC');
    const values=[String(++row),clean(names.get(a.student_id)||'—').slice(0,31),formatTashkent(a.checked_in),formatTashkent(a.checked_out),durationLabel(durationMinutes(a.checked_in,a.checked_out)),label];
    const x=[52,76,260,321,381,468],w=[20,175,56,56,81,77];
    doc.font('Helvetica').fontSize(8.5).fillColor('#24354A');
    values.forEach((v,j)=>doc.text(clean(v),x[j],y+7,{width:w[j],height:14,ellipsis:true,lineBreak:false}));
    doc.moveTo(44,y+23).lineTo(551,y+23).strokeColor('#E7EBF0').lineWidth(.5).stroke();
    y+=24;
   }
  }
  const pages=doc.bufferedPageRange();
  for(let i=pages.start;i<pages.start+pages.count;i++){
    doc.switchToPage(i);
    doc.page.margins.bottom=10;
    doc.moveTo(44,797).lineTo(551,797).strokeColor('#C79B54').stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#637083').text('ARK EDUCATION  |  Smart Attendance',44,805,{lineBreak:false});
    doc.text('Sahifa '+(i+1)+' / '+pages.count,455,805,{width:95,align:'right',lineBreak:false});
  }
  doc.end();const pdf=await done;
  return new Response(new Uint8Array(pdf) as BodyInit,{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="ark-attendance-report.pdf"','Cache-Control':'private, no-store'}});
 }catch(e){return errorResponse(e);}
}

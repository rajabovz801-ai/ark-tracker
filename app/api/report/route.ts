import PDFDocument from 'pdfkit';
import {authorize,rest,errorResponse,isUuid,ApiError} from '@/lib/server';
import {dailyCounts,formatTashkent,durationLabel,durationMinutes,statusLabel} from '@/lib/domain';
import type {Group,Student,Session,Attendance} from '@/lib/types';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const cy:Record<string,string>={А:'A',а:'a',Б:'B',б:'b',В:'V',в:'v',Г:'G',г:'g',
Д:'D',д:'d',Е:'E',е:'e',Ё:'Yo',ё:'yo',Ж:'J',ж:'j',З:'Z',з:'z',И:'I',и:'i',
Й:'Y',й:'y',К:'K',к:'k',Л:'L',л:'l',М:'M',м:'m',Н:'N',н:'n',О:'O',о:'o',
П:'P',п:'p',Р:'R',р:'r',С:'S',с:'s',Т:'T',т:'t',У:'U',у:'u',Ф:'F',ф:'f',
Х:'X',х:'x',Ц:'Ts',ц:'ts',Ч:'Ch',ч:'ch',Ш:'Sh',ш:'sh',Щ:'Sh',щ:'sh',
Э:'E',э:'e',Ю:'Yu',ю:'yu',Я:'Ya',я:'ya',Ў:"O'",ў:"o'",Ғ:"G'",ғ:"g'",
Қ:'Q',қ:'q',Ҳ:'H',ҳ:'h'};
const clean=(v:unknown)=>[...String(v??'')].map(c=>cy[c]??c).join('')
 .replace(/[‘’ʻʼ]/g,"'").replace(/[–—]/g,'-').normalize('NFKD')
 .replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'');
const LANDSCAPE_PAGE_ROWS=27;
export async function GET(req:Request){
 try{
  const {token}=await authorize(req);
  const params=new URL(req.url).searchParams;
  const id=params.get('session'),date=params.get('date'),group=params.get('group');
  if((id&&!isUuid(id))||(group&&!isUuid(group))||(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date)))
    throw new ApiError('Hisobot parametrlari noto‘g‘ri');
  if(!id&&!date)throw new ApiError('Sana yoki darsni tanlang');
  const filter=id?'id=eq.'+id:'lesson_date=eq.'+date+(group?'&group_id=eq.'+group:'');
  const [sessions,groups,students]=await Promise.all([
    rest('sa_sessions?select=*&'+filter+'&order=planned_start.asc',token) as Promise<Session[]>,
    rest('sa_groups?select=*',token) as Promise<Group[]>,
    rest('sa_students?select=id,name',token) as Promise<Student[]>
  ]);
  if(!sessions.length)throw new ApiError('Tanlangan sanada hisobot yo‘q',404);
  const ids=sessions.map(s=>s.id);
  const records=await rest('sa_attendance?select=*&session_id=in.('+ids.join(',')+')&limit=5000',token) as Attendance[];
  const names=new Map(students.map(s=>[s.id,s.name]));
  const groupMap=new Map(groups.map(g=>[g.id,g]));
  const doc=new PDFDocument({size:'A4',layout:'landscape',bufferPages:true,
    margins:{top:0,bottom:0,left:0,right:0},
    info:{Title:'ARK Education | Landscape Attendance',Author:'ARK Education Centre'}});
  const chunks:Buffer[]=[];
  const done=new Promise<Buffer>((resolve,reject)=>{
    doc.on('data',(chunk:Buffer)=>chunks.push(Buffer.from(chunk)));
    doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);
  });
  const left=32,right=810,width=right-left;
  function label(text:unknown,x:number,y:number,w:number,size=9,bold=false,color='#111111',align:'left'|'right'|'center'='left'){
    doc.font(bold?'Helvetica-Bold':'Helvetica').fillColor(color).fontSize(size)
      .text(clean(text),x,y,{width:w,height:size+4,align,ellipsis:true,lineBreak:false});
  }
  function top(session:Session,g:Group|undefined,stats:ReturnType<typeof dailyCounts>,part:number,shownFrom:number,shownTo:number,count:number){
    doc.rect(left,24,width,68).fill('#171717');
    doc.rect(left,24,7,68).fill('#707070');
    label('ARK EDUCATION CENTRE',50,33,width-36,10,true,'#FFFFFF');
    label((g?.name||'Guruh')+(part>0?'  /  DAVOMI '+(part+1):''),50,49,530,20,true,'#FFFFFF');
    label(session.lesson_date,642,56,155,11,true,'#FFFFFF','right');
    const values=[['JAMI',stats.total],['KELDI',stats.present],['KELMADI',stats.absent],
      ['KECHIKDI',stats.late],['DAVOMAT',stats.percent+'%']] as const;
    const tile=(width-7*4)/5;
    values.forEach(([name,num],i)=>{
      const x=left+i*(tile+7);
      doc.roundedRect(x,100,tile,43,4).fill('#F3F3F3');
      doc.roundedRect(x,100,tile,43,4).strokeColor('#CACACA').lineWidth(.4).stroke();
      label(name,x+10,106,tile-20,8,true,'#555555');
      label(num,x+10,119,tile-20,17,true);
    });
    label('O‘qituvchi: '+(g?.teacher||'—')+'   |   '+formatTashkent(session.planned_start)+' - '+
      formatTashkent(session.planned_end)+'   |   O‘quvchilar: '+shownFrom+' - '+shownTo+' / '+count,
      left,148,width,9,false,'#555555');
    doc.rect(left,164,width,22).fill('#E9E9E9');
    const columns=[
      {name:'#',x:41,w:28},
      {name:'O‘QUVCHI',x:77,w:295},
      {name:'KELDI',x:385,w:62},
      {name:'KETDI',x:465,w:62},
      {name:'DAVOMIYLIGI',x:549,w:101},
      {name:'HOLAT',x:670,w:110}
    ];
    columns.forEach(c=>label(c.name,c.x,170,c.w,8.5,true,'#333333'));
    return columns;
  }
  let pageCount=0;
  for(const session of sessions){
    const g=groupMap.get(session.group_id);
    const rec=records.filter(a=>a.session_id===session.id)
      .sort((a,b)=>(names.get(a.student_id)||'').localeCompare(names.get(b.student_id)||'','uz'));
    const stats=dailyCounts(rec,g?.late_grace_min??5);
    const parts=Math.max(1,Math.ceil(rec.length/LANDSCAPE_PAGE_ROWS));
    for(let part=0;part<parts;part++){
      if(pageCount++)doc.addPage();
      const from=part*LANDSCAPE_PAGE_ROWS,slice=rec.slice(from,from+LANDSCAPE_PAGE_ROWS);
      const cols=top(session,g,stats,part,slice.length?from+1:0,from+slice.length,rec.length);
      for(const [i,row] of slice.entries()){
        const y=186+i*13.7;
        if(i%2===1)doc.rect(left,y,width,13.7).fill('#F8F8F8');
        const status=statusLabel(row,session.status==='closed',g?.late_grace_min??5,session.planned_start).toLocaleUpperCase('uz-UZ');
        const values=[String(from+i+1).padStart(2,'0'),names.get(row.student_id)||'O‘quvchi',
          formatTashkent(row.checked_in),formatTashkent(row.checked_out),
          durationLabel(durationMinutes(row.checked_in,row.checked_out)),status];
        cols.forEach((c,n)=>label(values[n],c.x,y+2.5,c.w,n===1?8.8:8.5,
          n===1||n===5,n===0?'#777777':'#111111'));
        doc.moveTo(left,y+13.7).lineTo(right,y+13.7).strokeColor('#D9D9D9').lineWidth(.25).stroke();
      }
      if(!rec.length)label('Bu guruhda davomat yozuvlari yo‘q.',left,205,width,12);
    }
  }
  const range=doc.bufferedPageRange();
  for(let i=range.start;i<range.start+range.count;i++){
    doc.switchToPage(i);
    doc.moveTo(left,571).lineTo(right,571).strokeColor('#555555').lineWidth(.5).stroke();
    label('ARK EDUCATION CENTRE  /  SMART ATTENDANCE',left,578,650,8,true,'#666666');
    label('SAHIFA '+(i+1)+' / '+range.count,right-125,578,125,8,true,'#333333','right');
  }
  doc.end();
  const pdf=await done;
  return new Response(new Uint8Array(pdf) as BodyInit,{headers:{
    'Content-Type':'application/pdf',
    'Content-Disposition':'attachment; filename="ARK_Davomat_'+clean(date||sessions[0]?.lesson_date||'hisobot')+'_landscape.pdf"',
    'Cache-Control':'private, no-store'
  }});
 }catch(e){return errorResponse(e);}
}

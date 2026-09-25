'use client';
import {useEffect,useState,useCallback} from 'react';
import {GraduationCap,Users,ArrowLeft,Search,CheckCircle2,LogIn,LogOut,LockKeyhole,WifiOff,RefreshCcw,ShieldCheck} from 'lucide-react';
import {formatTerminalDate} from '@/lib/terminal';
type KStudent={id:string;name:string;checked_in:string|null;checked_out:string|null;status:string;};
type KSession={id:string;group_id:string;name:string;planned_start:string;students:KStudent[];};
type Snapshot={ok:boolean;sessions:KSession[]};
const TOKEN_KEY='ark-attendance-terminal-token';
class TerminalAuthError extends Error {}

async function kiosk(token:string,body:Record<string,unknown>):Promise<any>{
 const res=await fetch('/api/kiosk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,...body}),cache:'no-store'});
 const json=await res.json().catch(()=>({error:'Server javobi olinmadi'}));
 if(!res.ok){if(json.code==='TERMINAL_UNAUTHORIZED')throw new TerminalAuthError(json.error||'Terminal kodi noto‘g‘ri');throw new Error(json.error||'Aloqa xatosi');}return json;
}
export default function Terminal(){
 const [token,setToken]=useState(''),[code,setCode]=useState(''),[snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [group,setGroup]=useState(''),[student,setStudent]=useState(''),[query,setQuery]=useState(''),[result,setResult]=useState<'in'|'out'|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[now,setNow]=useState(new Date());
 const reset=useCallback(()=>{setGroup('');setStudent('');setQuery('');setResult(null);setError('');},[]);
 const disconnect=useCallback(()=>{
  localStorage.removeItem(TOKEN_KEY);
  setToken('');setCode('');setSnapshot(null);
  reset();setError('Terminal kodi noto‘g‘ri yoki bekor qilingan. Administrator sozlamalaridan yangi kod olib, qayta ulang.');
 },[reset]);
 const reload=useCallback(async(t:string)=>{
  if(!t)return;
  try{
   const data=await kiosk(t,{action:'snapshot'}) as Snapshot;
   setSnapshot(data);setError('');
  }catch(e){
   if(e instanceof TerminalAuthError){disconnect();return;}
   setSnapshot(null);setError(e instanceof Error?e.message:'Server bilan aloqa yo‘q. Qayta urinib ko‘ring.');
  }
 },[disconnect]);
 useEffect(()=>{const v=localStorage.getItem(TOKEN_KEY)||'';setToken(v);if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});},[]);
 useEffect(()=>{if(!token)return;setLoading(true);reload(token).finally(()=>setLoading(false));const id=setInterval(()=>{void reload(token);},7000);return()=>clearInterval(id);},[token,reload]);
 useEffect(()=>{if(snapshot&&group&&!snapshot.sessions.some(s=>s.id===group)){setGroup('');setStudent('');setQuery('');}},[snapshot,group]);
 useEffect(()=>{const id=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(id);},[]);
 useEffect(()=>{if(!result)return;const timer=setTimeout(reset,3000);return()=>clearTimeout(timer);},[result,reset]);
 const selected=snapshot?.sessions.find(x=>x.id===group);
 const person=selected?.students.find(x=>x.id===student);
 async function saveToken(){
  const candidate=code.trim();
  if(!/^[a-f0-9]{48}$/i.test(candidate)){setError('Admin paneldagi 48 belgili terminal kodini kiriting');return;}
  setLoading(true);setError('');
  try{
   // Validate the token on the server BEFORE saving it to this browser.
   const data=await kiosk(candidate,{action:'snapshot'}) as Snapshot;
   localStorage.setItem(TOKEN_KEY,candidate);
   setSnapshot(data);setCode('');setToken(candidate);
  }catch(e){
   setError(e instanceof TerminalAuthError?'Kod noto‘g‘ri yoki bloklangan. Admin panelidan yangi kod oling.':e instanceof Error?e.message:'Server bilan aloqa yo‘q');
  }finally{setLoading(false);}
 }
 async function action(a:'in'|'out'){if(!person||!selected||busy)return;setBusy(true);setError('');try{await kiosk(token,{action:a,sessionId:selected.id,studentId:person.id});await reload(token);setResult(a);}catch(e){if(e instanceof TerminalAuthError){disconnect();}else{setError(e instanceof Error?e.message:'Davomat saqlanmadi');}}finally{setBusy(false);}}
 return <main className="terminal-page"><div className="terminal-wrap"><header className="terminal-top"><div className="terminal-logo"><span className="logo-mark">A</span><span><b>ARK EDUCATION</b><small>SMART ATTENDANCE</small></span></div><div className="terminal-date">{formatTerminalDate(now)}<small>{new Intl.DateTimeFormat('uz-UZ',{timeZone:'Asia/Tashkent',hour:'2-digit',minute:'2-digit'}).format(now)}</small></div></header>
 {!token?<section className="terminal-main terminal-setup"><LockKeyhole size={39} className="gold-color"/><h1>Terminalni ulash</h1><p>Administrator sozlamalarda yaratilgan kodni bir marta kiriting. Bu telefon faqat davomat uchun ishlaydi.</p><input autoComplete="off" spellCheck={false} placeholder="Qurilma kodi" value={code} onChange={e=>setCode(e.target.value)}/><button className="btn btn-primary btn-block" disabled={loading} onClick={saveToken}>{loading?'Kod tekshirilmoqda...':'Terminalni faollashtirish'}</button><p className="muted">Kod olish: admin panel → Sozlamalar → Qurilma kodini yaratish.</p>{error&&<div className="message error">{error}</div>}</section>:
 <section className="terminal-main">
 {result?<div className="terminal-success"><CheckCircle2 size={76} color="#188a51"/><h1>{result==='in'?'Xush kelibsiz!':'Yaxshi boring!'}</h1><h2>{person?.name||'Davomat saqlandi'}</h2><p>{result==='in'?'Kelish':'Ketish'} vaqti qayd etildi</p><span className="badge badge-green">Muvaffaqiyatli</span><small>3 soniyadan keyin bosh sahifaga qaytadi</small><button className="btn btn-outline" onClick={reset}>Bosh sahifa</button></div>:
 !group?<><div className="terminal-title"><span className="step-dot">1</span><div><h1>Guruhingizni tanlang</h1><p>Davomat uchun guruh ustiga bosing</p></div></div>{loading&&!snapshot?<div className="notice">Tekshirilmoqda...</div>:error&&!snapshot?<div className="terminal-empty"><WifiOff size={46}/><h2>Server bilan aloqa yo‘q</h2><p>Internetni tekshiring. Xatolik bartaraf etilgach, qayta urinib ko‘ring.</p><button className="btn btn-outline" onClick={()=>reload(token)}><RefreshCcw size={17}/> Qayta urinish</button></div>:snapshot?.sessions.length?<div className="terminal-groups">{snapshot.sessions.map(s=><button key={s.id} className="terminal-group-card" onClick={()=>setGroup(s.id)}><span className="group-symbol"><Users size={28}/></span><strong>{s.name}</strong><small>{s.students.length} nafar o‘quvchi</small></button>)}</div>:<div className="terminal-empty"><GraduationCap size={46}/><h2>Hozir faol dars yo‘q</h2><p>Terminal muvaffaqiyatli ulangan. Administrator avval o‘quvchilarni qo‘shib, guruh darsini ochishi kerak. Shunda guruhlar shu yerda paydo bo‘ladi.</p><button className="btn btn-outline" onClick={()=>reload(token)}><RefreshCcw size={17}/> Yangilash</button></div>}</>:
 !student?<><button className="back-button" onClick={()=>{setGroup('');setQuery('');}}><ArrowLeft size={18}/> Guruhlarga qaytish</button><div className="terminal-title"><span className="step-dot">2</span><div><h1>{selected?.name} guruhi</h1><p>Ro‘yxatdan o‘zingizni toping</p></div></div><div className="terminal-search"><Search size={21}/><input autoFocus placeholder="Ism yoki familiyani qidiring..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="terminal-students">{selected?.students.filter(st=>st.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(st=><button key={st.id} className="terminal-student" onClick={()=>setStudent(st.id)}><span className="student-initial">{st.name.charAt(0).toUpperCase()}</span><span>{st.name}</span><b>›</b></button>)}</div></>:
 <><button className="back-button" onClick={()=>{setStudent('');setError('');}}><ArrowLeft size={18}/> O‘quvchilar ro‘yxati</button><div className="terminal-title"><span className="step-dot">3</span><div><h1>Davomatni tasdiqlang</h1><p>Ism-sharifingizni tekshiring</p></div></div><div className="person-card"><div className="person-avatar">{person?.name?.[0]||'?'}</div><h2>{person?.name}</h2><span>{selected?.name} guruhi</span><span className={'badge '+(person?.checked_out?'badge-blue':person?.checked_in?'badge-green':'badge-grey')}>{person?.checked_out?'Bugun ketgan':person?.checked_in?'Hozir markazda':'Bugun hali kelmagan'}</span></div>{!person?.checked_in?<button className="terminal-big green" disabled={busy} onClick={()=>action('in')}><LogIn size={29}/><span><b>KELDIM</b><small>Kelish vaqtimni qayd etish</small></span>→</button>:!person.checked_out?<button className="terminal-big navy" disabled={busy} onClick={()=>action('out')}><LogOut size={29}/><span><b>KETDIM</b><small>Ketish vaqtimni qayd etish</small></span>→</button>:<div className="message ok">Bugungi kelish va ketish allaqachon belgilangan.</div>}<small className="terminal-notice"><ShieldCheck size={15}/> Davomat o‘qituvchi nazoratidagi terminal orqali saqlanadi.</small></>}
 {error&&<div className="message error"><WifiOff size={17}/>{error}</div>}
 <footer className="terminal-footer">ARK EDUCATION • BILIM | INTIZOM | NATIJA</footer>
 </section>}
 </div></main>;
}

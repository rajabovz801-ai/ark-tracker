'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {GraduationCap,Mail,LockKeyhole,ArrowRight,ShieldCheck} from 'lucide-react';
import {supabase} from '@/lib/supabase';
export default function Login(){
 const router=useRouter();const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[mode,setMode]=useState<'login'|'signup'>('login'),[loading,setLoading]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{if(data.session)router.replace('/admin');});},[router]);
 async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError('');setNotice('');
  try{
   if(mode==='signup'){const {data,error}=await supabase.auth.signUp({email,password});if(error)throw error;if(data.session)router.replace('/admin');else setNotice('Emailingizga tasdiqlash havolasi yuborildi. Tasdiqlab, tizimga kiring.');}
   else{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;router.replace('/admin');}
  }catch(e){setError(e instanceof Error?e.message:'Kirishda xatolik');}finally{setLoading(false);}
 }
 return <main className="login-shell"><section className="login-brand"><div className="gold-mark">A</div><h1>ARK EDUCATION</h1><p>Smart Attendance</p><div className="login-quote">Bilim. Intizom. Natija.</div><div className="login-description">Markazdagi har bir dars va har bir o‘quvchining davomati yagona xavfsiz tizimda.</div></section><section className="login-panel"><div className="login-form"><div className="login-icon"><GraduationCap size={28}/></div><h2>{mode==='login'?'Administrator kirishi':'Administrator akkaunti'}</h2><p className="muted">Supabase Auth orqali himoyalangan kirish</p><form onSubmit={submit}><label>Email manzili<input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label><label>Parol<input autoComplete={mode==='signup'?'new-password':'current-password'} type="password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Kamida 8 ta belgi"/></label>{error&&<div className="message error">{error}</div>}{notice&&<div className="message ok">{notice}</div>}<button className="btn btn-primary btn-block" disabled={loading}>{loading?'Tekshirilmoqda...':mode==='login'?'Kirish':'Ro‘yxatdan o‘tish'} <ArrowRight size={18}/></button></form><button className="text-button" onClick={()=>{setMode(mode==='login'?'signup':'login');setNotice('');setError('');}}>{mode==='login'?'Akkauntingiz yo‘qmi? Ro‘yxatdan o‘ting':'Akkauntingiz bormi? Kirish'}</button><div className="login-tip"><ShieldCheck size={18}/> O‘quvchilar terminaliga administrator paroli kerak emas.</div><a className="terminal-link" href="/terminal">Davomat terminalini ochish →</a></div></section></main>;
}

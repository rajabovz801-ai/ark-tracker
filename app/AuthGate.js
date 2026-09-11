'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock3, LogIn, LogOut, RefreshCw, ShieldCheck, UserPlus, Users } from 'lucide-react';
import AccessCenter from './AccessCenter';
import { AccountantPortal, ShopManagerPortal, StudentPortal } from './RolePortals';
import { STATE_KEY, clearSession, ensureFreshSession, fetchMyProfile, readSession, signIn, signUp } from './arkAuthClient';

const SCOPE_KEY = 'ark-auth-cache-scope';

function roleName(role) {
  return ({ owner:'Owner', admin:'Admin', teacher:'Teacher', accountant:'Accountant', shop_manager:'Shop Manager', student:'Student' })[role] || role;
}

export default function AuthGate({ children }) {
  const [session,setSession]=useState(null);
  const [profile,setProfile]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [cloudReady,setCloudReady]=useState(false);
  const [cloudError,setCloudError]=useState('');
  const [accessOpen,setAccessOpen]=useState(false);
  const [pendingCount,setPendingCount]=useState(0);

  const loadIdentity = async (existing = readSession()) => {
    setLoading(true); setError('');
    try {
      const fresh = await ensureFreshSession(existing);
      if (!fresh) { setSession(null); setProfile(null); return; }
      const p = await fetchMyProfile(fresh);
      setSession(fresh); setProfile(p);
    } catch (e) {
      clearSession(); setSession(null); setProfile(null); setError(e.message || 'Session expired.');
    } finally { setLoading(false); }
  };

  useEffect(()=>{ loadIdentity(); },[]);

  const logout = () => {
    clearSession();
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(SCOPE_KEY);
    window.location.reload();
  };

  const scopeSignature = useMemo(()=> profile && session ? [session.user?.id,profile.role,(profile.course_ids||[]).join(','),(profile.group_names||[]).join(','),profile.student_id||''].join('|') : '',[profile,session]);

  useEffect(()=>{
    if (!session || !profile || profile.status !== 'active' || !['owner','admin','teacher'].includes(profile.role)) return;
    const current = localStorage.getItem(SCOPE_KEY);
    if (current !== scopeSignature) {
      localStorage.removeItem(STATE_KEY);
      localStorage.setItem(SCOPE_KEY, scopeSignature);
    }
    window.__ARK_AUTH_PROFILE__ = profile;
    const ready = () => { setCloudError(''); setCloudReady(true); };
    const fail = e => { setCloudError(e?.detail?.message || 'Cloud sync is unavailable.'); setCloudReady(false); };
    window.addEventListener('ark-cloud-ready', ready);
    window.addEventListener('ark-cloud-error', fail);
    if (window.__ARK_CLOUD_READY__) ready();
    else {
      let script = document.getElementById('ark-cloud-sync');
      if (!script) {
        script = document.createElement('script');
        script.id = 'ark-cloud-sync';
        script.src = '/cloud-sync.js';
        script.async = true;
        script.onerror = () => fail({ detail: { message: 'Could not load cloud sync.' } });
        document.head.appendChild(script);
      }
    }
    return ()=>{window.removeEventListener('ark-cloud-ready',ready);window.removeEventListener('ark-cloud-error',fail)};
  },[session,profile,scopeSignature]);

  if (loading) return <AuthLoading/>;
  if (!session || !profile) return <AuthScreen initialError={error} onSignedIn={s=>loadIdentity(s)}/>;

  if (profile.status === 'pending' || profile.role === 'pending') return <StatusScreen icon={Clock3} title="Approval pending" text="Your account was created successfully. The Owner must choose your role before the ARK Tracker opens." action="Check status" onAction={()=>loadIdentity(session)} onLogout={logout}/>;
  if (profile.status === 'suspended') return <StatusScreen icon={ShieldCheck} title="Account suspended" text="This account is temporarily blocked. Contact the ARK administrator." action="Check again" onAction={()=>loadIdentity(session)} onLogout={logout}/>;
  if (profile.status === 'rejected') return <StatusScreen icon={ShieldCheck} title="Access not approved" text="This registration has not been approved for ARK Tracker access." action="Check again" onAction={()=>loadIdentity(session)} onLogout={logout}/>;

  if (profile.role === 'student') return <RoleFrame profile={profile} onLogout={logout}><StudentPortal session={session} profile={profile}/></RoleFrame>;
  if (profile.role === 'accountant') return <RoleFrame profile={profile} onLogout={logout}><AccountantPortal session={session} profile={profile}/></RoleFrame>;
  if (profile.role === 'shop_manager') return <RoleFrame profile={profile} onLogout={logout}><ShopManagerPortal session={session} profile={profile}/></RoleFrame>;

  if (!['owner','admin','teacher'].includes(profile.role)) return <StatusScreen icon={ShieldCheck} title="Role not configured" text="Ask the Owner to assign a valid ARK Tracker role." action="Refresh" onAction={()=>loadIdentity(session)} onLogout={logout}/>;

  if (!cloudReady) return <div className="auth-cloud-wait"><div className="auth-spinner"/><h2>Connecting ARK Cloud</h2><p>{cloudError || 'Loading your permitted workspace without touching existing data.'}</p>{cloudError&&<button className="primary" onClick={()=>window.location.reload()}><RefreshCw size={15}/>Retry</button>}</div>;

  return <div className={`ark-role-shell role-${profile.role}`}>
    {children}
    <SessionDock profile={profile} onLogout={logout} onAccess={profile.role==='owner'?()=>setAccessOpen(true):null} pendingCount={pendingCount}/>
    {profile.role==='owner'&&<AccessCenter session={session} open={accessOpen} onClose={()=>setAccessOpen(false)} onCount={setPendingCount}/>} 
  </div>;
}

function RoleFrame({profile,onLogout,children}) {
  return <div className={`ark-role-shell role-${profile.role}`}>{children}<SessionDock profile={profile} onLogout={onLogout}/></div>;
}

function SessionDock({profile,onLogout,onAccess,pendingCount=0}) {
  return <div className="session-dock">
    {onAccess&&<button className="access-button" onClick={onAccess}><Users size={15}/> Access requests {pendingCount>0&&<b>{pendingCount}</b>}</button>}
    <div className="session-user"><div className="session-avatar">{(profile.full_name||profile.email||'U')[0].toUpperCase()}</div><div><b>{profile.full_name||'ARK User'}</b><span>{roleName(profile.role)}</span></div><button title="Log out" onClick={onLogout}><LogOut size={16}/></button></div>
  </div>;
}

function AuthLoading(){return <div className="auth-page"><div className="auth-loading-card"><div className="auth-spinner"/><b>Opening ARK Tracker…</b></div></div>}

function StatusScreen({icon:Icon,title,text,action,onAction,onLogout}) {
  return <div className="auth-page"><section className="status-card"><div className="status-icon"><Icon size={30}/></div><span className="eyebrow">ARK EDUCATION CENTRE</span><h1>{title}</h1><p>{text}</p><div className="status-actions"><button className="primary" onClick={onAction}><RefreshCw size={15}/>{action}</button><button className="ghost" onClick={onLogout}><LogOut size={15}/>Log out</button></div></section></div>;
}

function AuthScreen({initialError,onSignedIn}) {
  const [mode,setMode]=useState('login');
  const [fullName,setFullName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState(initialError||'');
  const [message,setMessage]=useState('');

  const submit=async e=>{
    e.preventDefault();setBusy(true);setError('');setMessage('');
    try{
      if(mode==='login'){
        const s=await signIn(email,password);onSignedIn(s);
      }else{
        if(!fullName.trim())throw new Error('Enter your full name.');
        if(password.length<6)throw new Error('Password must contain at least 6 characters.');
        const result=await signUp(fullName,email,password);
        if(result.session)onSignedIn(result.session);
        else{setMessage('Account created. Check your email if confirmation is required, then sign in. Your ARK role will stay Pending until the Owner approves it.');setMode('login')}
      }
    }catch(err){setError(err.message||'Authentication failed.')}finally{setBusy(false)}
  };

  return <div className="auth-page">
    <section className="auth-brand-panel"><div className="auth-logo">A</div><span>ARK EDUCATION CENTRE</span><h1>ARK Tracker</h1><p>Courses, attendance, finance, rewards and the ARK Shop — with controlled role access.</p><div className="auth-feature"><ShieldCheck size={18}/><div><b>Protected workspace</b><span>New users enter as Pending. The Owner decides every role.</span></div></div></section>
    <section className="auth-card"><div className="auth-tabs"><button className={mode==='login'?'active':''} onClick={()=>{setMode('login');setError('');setMessage('')}}>Sign in</button><button className={mode==='signup'?'active':''} onClick={()=>{setMode('signup');setError('');setMessage('')}}>Register</button></div><span className="eyebrow">SECURE ACCESS</span><h2>{mode==='login'?'Welcome back':'Create account'}</h2><p>{mode==='login'?'Use your ARK Tracker account.':'Your first status will be Pending until the Owner assigns a role.'}</p>
      {error&&<div className="auth-error">{error}</div>}{message&&<div className="auth-success">{message}</div>}
      <form onSubmit={submit}>{mode==='signup'&&<label><span>Full name</span><input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Name Surname" autoComplete="name"/></label>}<label><span>Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" required autoComplete="email"/></label><label><span>Password</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required autoComplete={mode==='login'?'current-password':'new-password'}/></label><button className="primary auth-submit" disabled={busy}>{mode==='login'?<LogIn size={17}/>:<UserPlus size={17}/>} {busy?'Please wait…':mode==='login'?'Sign in':'Register'}</button></form>
    </section>
  </div>;
}

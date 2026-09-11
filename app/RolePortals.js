'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Coins, CreditCard, Package, RefreshCw, Save, ShoppingBag, Upload, UserCheck, Users, Wallet } from 'lucide-react';
import { buyShopItem, currentMonthKey, formatMoney, levelFor, loadTrackerState, saveTrackerState, uploadShopImage } from './arkAuthClient';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function LoadingCard({text='Loading workspace…'}) { return <div className="role-loading"><div className="auth-spinner"/><b>{text}</b></div>; }
function ErrorBox({text}) { return text ? <div className="auth-error">{text}</div> : null; }

function useRemoteState(session) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{setData(await loadTrackerState(session));}catch(e){setError(e.message||'Could not load data.');}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  return {data,setData,loading,error,setError,load};
}

export function AccountantPortal({session, profile}) {
  const remote=useRemoteState(session);
  const [year,setYear]=useState(new Date().getFullYear());
  const [query,setQuery]=useState('');
  const [dirty,setDirty]=useState(false);
  const [saving,setSaving]=useState(false);
  const now=new Date();
  const todayKey=currentMonthKey();
  const currentDay=now.getDate();

  const students=useMemo(()=>((remote.data?.students||[]).filter(s=>!s.archived&&String(s.name||'').toLowerCase().includes(query.toLowerCase()))),[remote.data,query]);
  const payments=remote.data?.payments||{};

  const patchStudent=(id,patch)=>{remote.setData(p=>({...p,students:(p.students||[]).map(s=>s.id===id?{...s,...patch}:s)}));setDirty(true)};
  const setPayment=(id,key,value)=>{const amount=Math.max(0,Number(value||0));remote.setData(p=>({...p,payments:{...(p.payments||{}),[id]:{...(p.payments?.[id]||{}),[key]:{amount,paidAt:amount>0?new Date().toISOString():null}}}}));setDirty(true)};
  const save=async()=>{setSaving(true);remote.setError('');try{await saveTrackerState(session,remote.data);setDirty(false);await remote.load()}catch(e){remote.setError(e.message||'Could not save finance changes.')}finally{setSaving(false)}};

  const debtFor=s=>{
    const fee=Number(s.monthlyFee||0); if(!fee) return 0;
    const start=s.paymentStart||todayKey;
    let debt=0;
    for(let y=Number(start.slice(0,4));y<=now.getFullYear();y++){
      const from=y===Number(start.slice(0,4))?Number(start.slice(5,7)):1;
      const to=y===now.getFullYear()?now.getMonth()+1:12;
      for(let m=from;m<=to;m++){
        const key=`${y}-${String(m).padStart(2,'0')}`;
        const dueDay=Math.min(28,Math.max(1,Number(s.paymentDay||5)));
        const isDue=key<todayKey||(key===todayKey&&currentDay>dueDay);
        if(isDue) debt+=Math.max(0,fee-Number(payments?.[s.id]?.[key]?.amount||0));
      }
    }
    return debt;
  };
  const currentCollected=students.reduce((sum,s)=>sum+Number(payments?.[s.id]?.[todayKey]?.amount||0),0);
  const totalDebt=students.reduce((sum,s)=>sum+debtFor(s),0);
  const overdueCount=students.filter(s=>debtFor(s)>0).length;

  if(remote.loading&&!remote.data)return <LoadingCard/>;
  return <main className="role-portal cream-portal">
    <header className="portal-head"><div><span className="eyebrow">ARK FINANCE</span><h1>Accountant workspace</h1><p>{profile.full_name} · monthly payments and debt control</p></div><div className="portal-actions"><button className="ghost" onClick={remote.load}><RefreshCw size={15}/>Refresh</button><button className="primary" disabled={!dirty||saving} onClick={save}><Save size={16}/>{saving?'Saving…':'Save changes'}</button></div></header>
    <ErrorBox text={remote.error}/>
    <section className="portal-kpis"><PortalKpi icon={Wallet} label="Collected this month" value={formatMoney(currentCollected)}/><PortalKpi icon={AlertTriangle} label="Outstanding debt" value={formatMoney(totalDebt)}/><PortalKpi icon={Users} label="Overdue students" value={overdueCount}/><PortalKpi icon={CreditCard} label="Students" value={students.length}/></section>
    <section className="panel finance-workspace"><div className="panel-head"><div><span className="eyebrow">PAYMENT REGISTER</span><h2>Parents & monthly payments</h2><p>Set monthly fee, due date and the month payments start. Unpaid amounts automatically appear as debt.</p></div><div className="row-actions"><input className="year-input" type="number" value={year} onChange={e=>setYear(Number(e.target.value)||now.getFullYear())}/><input className="portal-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search student"/></div></div>
      <div className="table-wrap finance-table role-finance-table"><table><thead><tr><th className="sticky-col">Student</th><th>Parent</th><th>Parent phone</th><th>Monthly fee</th><th>Due day</th><th>Start month</th>{MONTHS.map(m=><th key={m}>{m}</th>)}<th>Debt</th></tr></thead><tbody>{students.map(s=>{
        const fee=Number(s.monthlyFee||0); const dueDay=Math.min(28,Math.max(1,Number(s.paymentDay||5))); const start=s.paymentStart||todayKey; const debt=debtFor(s);
        return <tr key={s.id} className={debt>0?'debt-row':''}><td className="sticky-col"><b>{s.name}</b><span className="subline">{s.group}</span></td><td><input className="finance-input text" value={s.parentName||''} onChange={e=>patchStudent(s.id,{parentName:e.target.value})}/></td><td><input className="finance-input text" value={s.parentPhone||''} onChange={e=>patchStudent(s.id,{parentPhone:e.target.value})}/></td><td><input className="finance-input money" type="number" value={s.monthlyFee||''} onChange={e=>patchStudent(s.id,{monthlyFee:Number(e.target.value||0)})}/></td><td><input className="finance-input due" type="number" min="1" max="28" value={dueDay} onChange={e=>patchStudent(s.id,{paymentDay:Math.min(28,Math.max(1,Number(e.target.value||5)))})}/></td><td><input className="finance-input start" type="month" value={start} onChange={e=>patchStudent(s.id,{paymentStart:e.target.value})}/></td>{MONTHS.map((m,i)=>{const key=`${year}-${String(i+1).padStart(2,'0')}`;const amount=Number(payments?.[s.id]?.[key]?.amount||0);const started=key>=start;const isPastDue=started&&(key<todayKey||(key===todayKey&&currentDay>dueDay));const status=!started?'na':fee>0&&amount>=fee?'paid':amount>0?'partial':isPastDue?'overdue':'pending';return <td key={key}><div className={`month-cell ${status}`}><input className="finance-input month" type="number" value={amount||''} onChange={e=>setPayment(s.id,key,e.target.value)} placeholder="0"/><small>{status==='paid'?'Paid':status==='partial'?'Partial':status==='overdue'?'Overdue':status==='pending'?'Pending':'—'}</small></div></td>})}<td><strong className={debt>0?'debt-value':''}>{formatMoney(debt)}</strong></td></tr>;
      })}</tbody></table></div>
    </section>
  </main>;
}

export function ShopManagerPortal({session, profile}) {
  const remote=useRemoteState(session);
  const [name,setName]=useState('');const [price,setPrice]=useState(300);const [stock,setStock]=useState(10);const [file,setFile]=useState(null);const [busy,setBusy]=useState(false);const [dirty,setDirty]=useState(false);
  const students=remote.data?.students||[]; const items=remote.data?.shopItems||[]; const orders=remote.data?.shopOrders||[];
  const patchItem=(id,patch)=>{remote.setData(p=>({...p,shopItems:(p.shopItems||[]).map(i=>i.id===id?{...i,...patch}:i)}));setDirty(true)};
  const patchOrder=(id,status)=>{remote.setData(p=>({...p,shopOrders:(p.shopOrders||[]).map(o=>o.id===id?{...o,status}:o)}));setDirty(true)};
  const add=async()=>{if(!name.trim()||Number(price)<=0)return;setBusy(true);remote.setError('');try{const imageUrl=file?await uploadShopImage(session,file):'';const item={id:crypto.randomUUID(),name:name.trim(),price:Number(price),stock:Math.max(0,Number(stock||0)),active:true,imageUrl};const next={...remote.data,shopItems:[...(items||[]),item]};await saveTrackerState(session,next);setName('');setFile(null);setDirty(false);await remote.load()}catch(e){remote.setError(e.message||'Could not add product.')}finally{setBusy(false)}};
  const replaceImage=async(id,newFile)=>{if(!newFile)return;setBusy(true);remote.setError('');try{const imageUrl=await uploadShopImage(session,newFile);const next={...remote.data,shopItems:(items||[]).map(i=>i.id===id?{...i,imageUrl}:i)};await saveTrackerState(session,next);await remote.load()}catch(e){remote.setError(e.message||'Could not upload image.')}finally{setBusy(false)}};
  const save=async()=>{setBusy(true);remote.setError('');try{await saveTrackerState(session,remote.data);setDirty(false);await remote.load()}catch(e){remote.setError(e.message||'Could not save shop.')}finally{setBusy(false)}};
  if(remote.loading&&!remote.data)return <LoadingCard/>;
  return <main className="role-portal cream-portal">
    <header className="portal-head"><div><span className="eyebrow">ARK SHOP</span><h1>Shop manager</h1><p>{profile.full_name} · products, coin prices, stock and orders</p></div><div className="portal-actions"><button className="ghost" onClick={remote.load}><RefreshCw size={15}/>Refresh</button><button className="primary" disabled={!dirty||busy} onClick={save}><Save size={16}/>Save</button></div></header>
    <ErrorBox text={remote.error}/>
    <section className="panel shop-manager-add"><div><span className="eyebrow">NEW PRODUCT</span><h2>Add reward</h2></div><div className="manager-add-grid"><label><span>Name</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="ARK Notebook"/></label><label><span>Coin price</span><input type="number" value={price} onChange={e=>setPrice(Number(e.target.value)||0)}/></label><label><span>Stock</span><input type="number" value={stock} onChange={e=>setStock(Number(e.target.value)||0)}/></label><label className="image-upload"><span>Product image</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><button className="primary" disabled={busy} onClick={add}><Package size={16}/>{busy?'Uploading…':'Add product'}</button></div></section>
    <section className="manager-shop-grid">{items.map(item=><article className="manager-product panel" key={item.id}><div className="product-image">{item.imageUrl?<img src={item.imageUrl} alt=""/>:<ShoppingBag size={30}/>}</div><input className="product-name-input" value={item.name||''} onChange={e=>patchItem(item.id,{name:e.target.value})}/><div className="product-edit-row"><label><span>Coins</span><input type="number" value={item.price||0} onChange={e=>patchItem(item.id,{price:Number(e.target.value||0)})}/></label><label><span>Stock</span><input type="number" value={item.stock||0} onChange={e=>patchItem(item.id,{stock:Number(e.target.value||0)})}/></label></div><div className="product-bottom"><label className="toggle-line"><input type="checkbox" checked={item.active!==false} onChange={e=>patchItem(item.id,{active:e.target.checked})}/><span>Active</span></label><label className="mini-upload"><Upload size={14}/><span>Image</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>replaceImage(item.id,e.target.files?.[0])}/></label></div></article>)}</section>
    <section className="panel"><div className="panel-head"><div><span className="eyebrow">ORDERS</span><h2>Student requests</h2></div><span className="tag">{orders.filter(o=>o.status==='pending').length} pending</span></div><div className="portal-order-list">{orders.slice(0,100).map(o=>{const s=students.find(x=>x.id===o.studentId);const item=items.find(x=>x.id===o.itemId);return <div className="portal-order" key={o.id}><div><b>{s?.name||'Student'} · {item?.name||'Reward'}</b><span>{o.price} 🪙 · {o.createdAt?new Date(o.createdAt).toLocaleDateString():''}</span></div><select value={o.status||'pending'} onChange={e=>patchOrder(o.id,e.target.value)}><option value="pending">Pending</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>})}{!orders.length&&<div className="access-empty"><Check size={24}/><b>No orders yet</b></div>}</div></section>
  </main>;
}

export function StudentPortal({session, profile}) {
  const remote=useRemoteState(session); const [buying,setBuying]=useState('');
  const student=remote.data?.students?.[0]; const items=(remote.data?.shopItems||[]).filter(i=>i.active!==false); const orders=remote.data?.shopOrders||[];
  const buy=async item=>{setBuying(item.id);remote.setError('');try{await buyShopItem(session,item.id);await remote.load()}catch(e){remote.setError(e.message||'Purchase failed.')}finally{setBuying('')}};
  if(remote.loading&&!remote.data)return <LoadingCard text="Opening ARK Shop…"/>;
  if(!student)return <main className="student-portal"><div className="student-wait"><UserCheck size={34}/><h1>Profile link required</h1><p>Your account is active, but the admin still needs to connect it to your student profile.</p></div></main>;
  return <main className="student-portal">
    <header className="student-hero"><div><span className="eyebrow">ARK STUDENT</span><h1>Welcome, {student.name}</h1><p>{student.group} · rewards marketplace</p></div><button className="ghost" onClick={remote.load}><RefreshCw size={15}/>Refresh</button></header>
    <ErrorBox text={remote.error}/>
    <section className="student-wallet"><div><Coins size={23}/><span>ARK Coins</span><strong>{Number(student.pts||0).toLocaleString()}</strong></div><div><Wallet size={23}/><span>XP</span><strong>{Number(student.xp||0).toLocaleString()}</strong></div><div><UserCheck size={23}/><span>Level</span><strong>{levelFor(student.xp)}</strong></div></section>
    <section className="student-shop-section"><div className="student-section-head"><div><span className="eyebrow">ARK SHOP</span><h2>Spend your coins</h2></div><span>{items.length} rewards</span></div><div className="student-shop-grid">{items.map(item=><article className="student-product" key={item.id}><div className="student-product-image">{item.imageUrl?<img src={item.imageUrl} alt={item.name}/>:<ShoppingBag size={35}/>}</div><div className="student-product-copy"><h3>{item.name}</h3><b>{Number(item.price||0).toLocaleString()} 🪙</b><span>{item.stock} in stock</span></div><button className="primary full" disabled={buying===item.id||Number(item.stock||0)<=0||Number(student.pts||0)<Number(item.price||0)} onClick={()=>buy(item)}>{buying===item.id?'Buying…':Number(student.pts||0)<Number(item.price||0)?'Not enough coins':'Buy now'}</button></article>)}</div></section>
    <section className="student-orders"><div className="student-section-head"><div><span className="eyebrow">MY ORDERS</span><h2>Purchase history</h2></div></div>{orders.length?<div className="portal-order-list">{orders.map(o=>{const item=items.find(i=>i.id===o.itemId);return <div className="portal-order" key={o.id}><div><b>{item?.name||'Reward'}</b><span>{o.price} 🪙 · {o.createdAt?new Date(o.createdAt).toLocaleDateString():''}</span></div><span className={`order-status ${o.status}`}>{o.status}</span></div>})}</div>:<div className="access-empty"><ShoppingBag size={24}/><b>No purchases yet</b><span>Your orders will appear here.</span></div>}</section>
  </main>;
}

function PortalKpi({icon:Icon,label,value}) { return <div className="portal-kpi"><div><Icon size={20}/></div><span>{label}</span><strong>{value}</strong></div>; }

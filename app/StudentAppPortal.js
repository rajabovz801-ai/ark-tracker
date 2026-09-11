'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, CheckCircle2, Coins, Home, PackageCheck, RefreshCw,
  ShoppingBag, UserRound, Wallet, XCircle
} from 'lucide-react';
import { buyShopItem, levelFor, loadTrackerState } from './arkAuthClient';

function taskState(value) {
  if (value === true || value === 'done') return 'done';
  if (value === 'partial') return 'partial';
  if (value === 'notdone') return 'notdone';
  return 'unset';
}

function prettyDate(value) {
  try { return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return value; }
}

function timeText(value) {
  try { return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return ''; }
}

export default function StudentAppPortal({ session, profile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('home');
  const [buying, setBuying] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setData(await loadTrackerState(session)); }
    catch (e) { setError(e.message || 'Could not load your ARK profile.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const student = data?.students?.[0];
  const items = (data?.shopItems || []).filter(i => i.active !== false);
  const orders = (data?.shopOrders || []).filter(o => !student || !o.studentId || o.studentId === student.id);
  const transactions = (data?.coinTransactions || []).filter(t => !student || t.studentId === student.id);
  const records = student ? (data?.records?.[student.id] || {}) : {};

  const progress = useMemo(() => {
    let present = 0, absent = 0, done = 0, partial = 0, missed = 0;
    const days = Object.entries(records)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, rec]) => {
        if (rec?.attendance === 'present') present++;
        if (rec?.attendance === 'absent') absent++;
        let d = 0, p = 0, m = 0;
        Object.values(rec?.modules || {}).forEach(value => {
          const s = taskState(value);
          if (s === 'done') { done++; d++; }
          else if (s === 'partial') { partial++; p++; }
          else if (s === 'notdone') { missed++; m++; }
        });
        return { date, attendance: rec?.attendance || '', done: d, partial: p, missed: m };
      });
    const marked = present + absent;
    const attendance = marked ? Math.round((present / marked) * 100) : 0;
    const homeworkTotal = done + partial + missed;
    const homework = homeworkTotal ? Math.round(((done + partial * .5) / homeworkTotal) * 100) : 0;
    return { present, absent, done, partial, missed, attendance, homework, days };
  }, [records]);

  const recentOrders = orders.slice(0, 4);
  const recentTransactions = transactions.slice(0, 20);

  const buy = async item => {
    setBuying(item.id); setError('');
    try { await buyShopItem(session, item.id); await load(); }
    catch (e) { setError(e.message || 'Purchase failed.'); }
    finally { setBuying(''); }
  };

  if (loading && !data) return <div className="student-app-loading"><div className="auth-spinner"/><b>Opening ARK Student…</b></div>;
  if (!student) return <main className="student-app student-app-empty"><UserRound size={38}/><h1>Profile link required</h1><p>Your account is active, but the admin still needs to connect it to your student profile.</p></main>;

  const level = levelFor(student.xp);

  return <main className="student-app">
    <header className="student-app-top">
      <div className="student-app-brand"><span>A</span><div><b>ARK</b><small>STUDENT</small></div></div>
      <button className="student-refresh" onClick={load} aria-label="Refresh"><RefreshCw size={17}/></button>
    </header>

    {error && <div className="student-app-error">{error}</div>}

    <div className="student-app-body">
      {tab === 'home' && <>
        <section className="student-welcome-card">
          <span className="student-kicker">WELCOME BACK</span>
          <h1>{student.name}</h1>
          <p>{student.group || 'ARK Student'} · {level}</p>
          <div className="student-balance-line"><div><Coins size={19}/><span>ARK Coins</span></div><strong>{Number(student.pts || 0).toLocaleString()}</strong></div>
        </section>

        <section className="student-mini-grid">
          <button onClick={() => setTab('results')}><BarChart3 size={19}/><span>Attendance</span><b>{progress.attendance}%</b></button>
          <button onClick={() => setTab('results')}><CheckCircle2 size={19}/><span>Homework</span><b>{progress.homework}%</b></button>
          <button onClick={() => setTab('wallet')}><Wallet size={19}/><span>XP</span><b>{Number(student.xp || 0).toLocaleString()}</b></button>
          <button onClick={() => setTab('shop')}><ShoppingBag size={19}/><span>Shop</span><b>{items.length} items</b></button>
        </section>

        <section className="student-app-section">
          <div className="student-section-title"><div><span>ARK SHOP</span><h2>Popular rewards</h2></div><button onClick={() => setTab('shop')}>See all</button></div>
          <div className="student-home-products">{items.slice(0, 3).map(item => <button key={item.id} onClick={() => setTab('shop')} className="student-home-product">
            <div>{item.imageUrl ? <img src={item.imageUrl} alt={item.name}/> : <ShoppingBag size={25}/>}</div><span>{item.name}</span><b>{Number(item.price || 0).toLocaleString()} 🪙</b>
          </button>)}</div>
        </section>

        <section className="student-app-section">
          <div className="student-section-title"><div><span>RECENT</span><h2>Your activity</h2></div></div>
          <div className="student-activity-list">
            {progress.days.slice(0, 3).map(day => <div key={day.date} className="student-activity-row"><div className={day.attendance === 'present' ? 'ok' : day.attendance === 'absent' ? 'bad' : ''}>{day.attendance === 'present' ? <CheckCircle2 size={18}/> : day.attendance === 'absent' ? <XCircle size={18}/> : <BarChart3 size={18}/>}</div><div><b>{prettyDate(day.date)}</b><span>{day.attendance === 'present' ? 'Present' : day.attendance === 'absent' ? 'Absent' : 'Attendance not marked'} · {day.done} homework done</span></div></div>)}
            {!progress.days.length && <div className="student-app-empty-row">No activity has been marked yet.</div>}
          </div>
        </section>
      </>}

      {tab === 'results' && <>
        <section className="student-page-head"><span>MY PROGRESS</span><h1>Results</h1><p>Your attendance and homework history.</p></section>
        <section className="student-result-summary">
          <div><span>Attendance</span><strong>{progress.attendance}%</strong><small>{progress.present} present · {progress.absent} absent</small></div>
          <div><span>Homework</span><strong>{progress.homework}%</strong><small>{progress.done} done · {progress.partial} partial</small></div>
        </section>
        <section className="student-app-section"><div className="student-section-title"><div><span>HISTORY</span><h2>Recent days</h2></div></div><div className="student-results-list">
          {progress.days.slice(0, 30).map(day => <div key={day.date} className="student-result-row"><div><b>{prettyDate(day.date)}</b><span>{day.attendance === 'present' ? 'Present' : day.attendance === 'absent' ? 'Absent' : 'Not marked'}</span></div><div className="student-task-pills"><span className="done">{day.done} done</span>{day.partial > 0 && <span className="partial">{day.partial} partial</span>}{day.missed > 0 && <span className="missed">{day.missed} missed</span>}</div></div>)}
          {!progress.days.length && <div className="student-app-empty-row">No result history yet.</div>}
        </div></section>
      </>}

      {tab === 'shop' && <>
        <section className="student-page-head student-shop-head"><span>ARK SHOP</span><h1>Rewards</h1><p>Spend coins. Your XP and level stay untouched.</p><div className="student-shop-balance"><Coins size={18}/><b>{Number(student.pts || 0).toLocaleString()} coins</b></div></section>
        <section className="student-app-shop-grid">{items.map(item => <article className="student-app-product" key={item.id}>
          <div className="student-app-product-image">{item.imageUrl ? <img src={item.imageUrl} alt={item.name}/> : <ShoppingBag size={34}/>}</div>
          <div className="student-app-product-copy"><h3>{item.name}</h3><b>{Number(item.price || 0).toLocaleString()} 🪙</b><span>{Number(item.stock || 0)} in stock</span></div>
          <button disabled={buying === item.id || Number(item.stock || 0) <= 0 || Number(student.pts || 0) < Number(item.price || 0)} onClick={() => buy(item)}>{buying === item.id ? 'Buying…' : Number(item.stock || 0) <= 0 ? 'Out of stock' : Number(student.pts || 0) < Number(item.price || 0) ? 'Need more coins' : 'Buy now'}</button>
        </article>)}</section>
        <section className="student-app-section"><div className="student-section-title"><div><span>ORDERS</span><h2>My purchases</h2></div></div><div className="student-order-list">{recentOrders.map(o => { const item = items.find(i => i.id === o.itemId); return <div className="student-order-row" key={o.id}><div><PackageCheck size={18}/></div><div><b>{item?.name || 'Reward'}</b><span>{Number(o.price || 0).toLocaleString()} 🪙 · {timeText(o.createdAt)}</span></div><em className={`status-${o.status || 'pending'}`}>{o.status || 'pending'}</em></div> })}{!recentOrders.length && <div className="student-app-empty-row">No purchases yet.</div>}</div></section>
      </>}

      {tab === 'wallet' && <>
        <section className="student-page-head"><span>ARK WALLET</span><h1>{Number(student.pts || 0).toLocaleString()} coins</h1><p>Coins can be spent. XP only grows your level.</p></section>
        <section className="student-wallet-cards"><div><Coins size={21}/><span>Available coins</span><strong>{Number(student.pts || 0).toLocaleString()}</strong></div><div><Wallet size={21}/><span>Total XP</span><strong>{Number(student.xp || 0).toLocaleString()}</strong></div><div><UserRound size={21}/><span>Current level</span><strong>{level}</strong></div></section>
        <section className="student-app-section"><div className="student-section-title"><div><span>TRANSACTIONS</span><h2>Coin history</h2></div></div><div className="student-transaction-list">{recentTransactions.map(t => <div className="student-transaction-row" key={t.id}><div className={Number(t.amount || 0) >= 0 ? 'plus' : 'minus'}>{Number(t.amount || 0) >= 0 ? '+' : '−'}</div><div><b>{t.reason || 'ARK Coins'}</b><span>{timeText(t.createdAt)}</span></div><strong className={Number(t.amount || 0) >= 0 ? 'positive' : 'negative'}>{Number(t.amount || 0) > 0 ? '+' : ''}{Number(t.amount || 0).toLocaleString()}</strong></div>)}{!recentTransactions.length && <div className="student-app-empty-row">No coin transactions yet.</div>}</div></section>
      </>}

      {tab === 'profile' && <>
        <section className="student-page-head"><span>MY PROFILE</span><h1>{student.name}</h1><p>Your ARK student information.</p></section>
        <section className="student-profile-card"><div className="student-profile-avatar">{String(student.name || 'S')[0].toUpperCase()}</div><h2>{student.name}</h2><span>{student.group || 'No group'}</span><div className="student-profile-fields"><div><small>Level</small><b>{level}</b></div><div><small>Coins</small><b>{Number(student.pts || 0).toLocaleString()}</b></div><div><small>XP</small><b>{Number(student.xp || 0).toLocaleString()}</b></div><div><small>Account</small><b>{profile.email || session.user?.email || 'ARK Student'}</b></div></div></section>
      </>}
    </div>

    <nav className="student-app-nav" aria-label="Student navigation">
      <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}><Home size={20}/><span>Home</span></button>
      <button className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}><BarChart3 size={20}/><span>Results</span></button>
      <button className={tab === 'shop' ? 'active shop-tab' : 'shop-tab'} onClick={() => setTab('shop')}><ShoppingBag size={21}/><span>Shop</span></button>
      <button className={tab === 'wallet' ? 'active' : ''} onClick={() => setTab('wallet')}><Wallet size={20}/><span>Wallet</span></button>
      <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><UserRound size={20}/><span>Profile</span></button>
    </nav>
  </main>;
}

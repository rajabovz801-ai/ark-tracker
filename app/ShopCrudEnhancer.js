'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, Save, ShoppingBag, Trash2 } from 'lucide-react';

const STATE_KEY='ark-tracker-v1';
const RETURN_KEY='ark-return-page';

function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch{return {}}}
function writeState(next){
  localStorage.setItem(STATE_KEY,JSON.stringify(next));
  sessionStorage.setItem(RETURN_KEY,'shop');
  window.dispatchEvent(new CustomEvent('ark-tracker-state-updated',{detail:{source:'shop-crud'}}));
}

export default function ShopCrudEnhancer(){
  const [mount,setMount]=useState(null);
  const [state,setState]=useState({});
  const [drafts,setDrafts]=useState({});
  const role=typeof window!=='undefined'?window.__ARK_AUTH_PROFILE__?.role:null;
  const allowed=!role||['owner','admin','shop_manager'].includes(role);

  const refresh=()=>{
    const next=readState();
    setState(next);
    setDrafts(Object.fromEntries((next.shopItems||[]).map(i=>[i.id,{name:i.name||'',price:Number(i.price||0),stock:Number(i.stock||0)}])));
  };

  useEffect(()=>{
    if(!allowed)return;
    refresh();
    const restorePage=()=>{
      if(sessionStorage.getItem(RETURN_KEY)!=='shop')return;
      const buttons=[...document.querySelectorAll('.app-shell .sidebar nav button')];
      const shop=buttons.find(b=>{const t=b.textContent?.trim().toLowerCase()||'';return t==='shop'||t==='do‘kon'||t==="do'kon"});
      if(shop){sessionStorage.removeItem(RETURN_KEY);setTimeout(()=>shop.click(),40)}
    };
    const locate=()=>{
      restorePage();
      const shell=document.querySelector('.app-shell');
      const active=shell?.querySelector('.sidebar nav button.active')?.textContent?.trim().toLowerCase()||'';
      const isShop=active==='shop'||active==='do‘kon'||active==="do'kon";
      if(!isShop){setMount(null);return}
      const stack=shell?.querySelector('.content .page-stack');
      const head=stack?.querySelector('.shop-head');
      if(!stack||!head)return;
      let host=stack.querySelector('[data-shop-crud-host="1"]');
      if(!host){host=document.createElement('div');host.dataset.shopCrudHost='1';head.insertAdjacentElement('afterend',host)}
      setMount(host);
    };
    setTimeout(locate,50);
    const obs=new MutationObserver(locate);
    obs.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
    const onState=()=>{refresh();setTimeout(locate,60)};
    window.addEventListener('storage',onState);
    return()=>{obs.disconnect();window.removeEventListener('storage',onState)};
  },[allowed]);

  const items=useMemo(()=>state.shopItems||[],[state]);
  if(!allowed||!mount)return null;

  const patchDraft=(id,patch)=>setDrafts(p=>({...p,[id]:{...(p[id]||{}),...patch}}));
  const saveItem=id=>{
    const d=drafts[id]; if(!d)return;
    const next={...state,shopItems:items.map(i=>i.id===id?{...i,name:String(d.name||'').trim()||i.name,price:Math.max(0,Number(d.price||0)),stock:Math.max(0,Number(d.stock||0))}:i)};
    writeState(next);
  };
  const deactivate=id=>{
    const item=items.find(i=>i.id===id); if(!item)return;
    if(!window.confirm(`“${item.name}” sovg‘asini o‘chirasizmi? Eski buyurtmalar saqlanadi.`))return;
    writeState({...state,shopItems:items.map(i=>i.id===id?{...i,active:false}:i)});
  };
  const restore=id=>writeState({...state,shopItems:items.map(i=>i.id===id?{...i,active:true}:i)});

  const active=items.filter(i=>i.active!==false), inactive=items.filter(i=>i.active===false);
  return createPortal(<section className="shop-crud-panel panel">
    <div className="shop-crud-head"><div><span className="eyebrow">SOVG‘ALARNI BOSHQARISH</span><h2>Mavjud sovg‘alar</h2><p>Narx va omborni o‘zgartiring yoki sovg‘ani o‘chiring.</p></div><span className="shop-count">{active.length} ta faol</span></div>
    <div className="shop-crud-list">{active.map(item=>{
      const d=drafts[item.id]||item;
      return <article className="shop-crud-row" key={item.id}>
        <div className="shop-crud-icon">{item.imageUrl?<img src={item.imageUrl} alt=""/>:<ShoppingBag size={21}/>}</div>
        <label className="shop-crud-name"><span>Nomi</span><input value={d.name||''} onChange={e=>patchDraft(item.id,{name:e.target.value})}/></label>
        <label><span>Coin narxi</span><input type="number" min="0" value={d.price??0} onChange={e=>patchDraft(item.id,{price:Number(e.target.value||0)})}/></label>
        <label><span>Ombor</span><input type="number" min="0" value={d.stock??0} onChange={e=>patchDraft(item.id,{stock:Number(e.target.value||0)})}/></label>
        <button className="shop-save-btn" onClick={()=>saveItem(item.id)}><Save size={15}/>Saqlash</button>
        <button className="shop-delete-btn" onClick={()=>deactivate(item.id)}><Trash2 size={15}/>O‘chirish</button>
      </article>;
    })}</div>
    {inactive.length>0&&<details className="shop-removed"><summary>O‘chirilgan sovg‘alar ({inactive.length})</summary><div>{inactive.map(item=><div className="shop-removed-row" key={item.id}><span><b>{item.name}</b><small>{item.price} 🪙 · Omborda {item.stock}</small></span><button onClick={()=>restore(item.id)}><RotateCcw size={14}/>Qayta tiklash</button></div>)}</div></details>}
  </section>,mount);
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, Sparkles } from 'lucide-react';
import { applyCoinReward, applyXpReward } from './rewardActions.mjs';

const STATE_KEY = 'ark-tracker-v1';
const RETURN_PAGE_KEY = 'ark-return-page';

function normalizeText(value) {
  return String(value || '')
    .toLocaleLowerCase('uz')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function setNativeSelectValue(selectEl, value) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  descriptor?.set?.call(selectEl, value);
  selectEl.dispatchEvent(new Event('input', { bubbles: true }));
  selectEl.dispatchEvent(new Event('change', { bubbles: true }));
}

function readTrackerState() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
  } catch {
    return {};
  }
}

function persistRewardState(nextState, source) {
  localStorage.setItem(STATE_KEY, JSON.stringify(nextState));
  sessionStorage.setItem(RETURN_PAGE_KEY, 'gamification');
  window.dispatchEvent(new CustomEvent('ark-tracker-state-updated', { detail: { source } }));
}

function readRewardFields(form) {
  const amountInput = form?.querySelector(':scope > input[type="number"]');
  const reasonInput = form?.querySelector(':scope > input:not([type="number"])');
  return {
    amount: Number(amountInput?.value || 0),
    reason: String(reasonInput?.value || '').trim() || 'Teacher reward',
  };
}

function StudentSearchPicker({ selectEl, rewardButton, onSelectionValidityChange }) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [options, setOptions] = useState([]);
  const [selectedValue, setSelectedValue] = useState('');
  const [searchText, setSearchText] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!selectEl) return;

    const readOptions = () => {
      const nextOptions = [...selectEl.options]
        .filter(option => option.value)
        .map(option => ({ value: option.value, label: option.textContent?.trim() || '' }));

      setOptions(nextOptions);
      setSelectedValue(current => {
        if (!current || nextOptions.some(option => option.value === current)) return current;
        setSearchText('');
        return '';
      });
    };

    readOptions();
    const observer = new MutationObserver(readOptions);
    observer.observe(selectEl, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [selectEl]);

  const selectedOption = useMemo(
    () => options.find(option => option.value === selectedValue),
    [options, selectedValue]
  );

  const selectionIsValid = Boolean(
    selectedOption && normalizeText(searchText) === normalizeText(selectedOption.label)
  );

  useEffect(() => {
    onSelectionValidityChange?.(selectionIsValid);
  }, [selectionIsValid, onSelectionValidityChange]);

  useEffect(() => {
    if (!rewardButton) return;

    rewardButton.disabled = !selectionIsValid;
    rewardButton.setAttribute('aria-disabled', selectionIsValid ? 'false' : 'true');
    rewardButton.title = selectionIsValid ? '' : 'Avval o‘quvchini qidirib tanlang';

    return () => {
      rewardButton.disabled = false;
      rewardButton.removeAttribute('aria-disabled');
      rewardButton.title = '';
    };
  }, [rewardButton, selectionIsValid]);

  useEffect(() => {
    const handleOutside = event => {
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
      setSearchText(selectedOption?.label || '');
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [selectedOption]);

  const filteredOptions = useMemo(() => {
    const typed = normalizeText(searchText);
    const selectedLabel = normalizeText(selectedOption?.label);
    const query = typed && typed !== selectedLabel ? typed : '';

    const matches = !query
      ? options
      : options.filter(option => normalizeText(option.label).includes(query));

    return [...matches].sort((a, b) => {
      if (!query) return a.label.localeCompare(b.label, 'uz');
      const aStarts = normalizeText(a.label).startsWith(query);
      const bStarts = normalizeText(b.label).startsWith(query);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return a.label.localeCompare(b.label, 'uz');
    });
  }, [options, searchText, selectedOption]);

  useEffect(() => {
    if (activeIndex >= filteredOptions.length) setActiveIndex(0);
  }, [activeIndex, filteredOptions.length]);

  const choose = option => {
    if (!selectEl || !option) return;

    setNativeSelectValue(selectEl, option.value);
    setSelectedValue(option.value);
    setSearchText(option.label);
    setOpen(false);
    setActiveIndex(0);
  };

  const handleFocus = event => {
    setOpen(true);
    setActiveIndex(0);
    if (selectionIsValid) requestAnimationFrame(() => event.currentTarget.select());
  };

  const handleKeyDown = event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => Math.min(index + 1, Math.max(0, filteredOptions.length - 1)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter' && open && filteredOptions.length) {
      event.preventDefault();
      choose(filteredOptions[activeIndex] || filteredOptions[0]);
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
      setSearchText(selectedOption?.label || '');
      inputRef.current?.blur();
    }
  };

  return <div className="ark-student-combobox" ref={rootRef}>
    <Search className="ark-student-search-icon" size={16}/>
    <input
      ref={inputRef}
      className="ark-student-search-input"
      value={searchText}
      placeholder="O‘quvchi ismini yozing..."
      autoComplete="off"
      spellCheck="false"
      role="combobox"
      aria-expanded={open}
      aria-autocomplete="list"
      aria-controls="ark-student-search-list"
      onFocus={handleFocus}
      onClick={() => setOpen(true)}
      onChange={event => {
        setSearchText(event.target.value);
        setOpen(true);
        setActiveIndex(0);
      }}
      onKeyDown={handleKeyDown}
    />

    <button
      type="button"
      className="ark-student-chevron"
      aria-label="O‘quvchilar ro‘yxatini ochish"
      onMouseDown={event => event.preventDefault()}
      onClick={() => {
        setOpen(value => !value);
        inputRef.current?.focus();
      }}
    >
      <ChevronDown size={17}/>
    </button>

    {open && <div id="ark-student-search-list" className="ark-student-search-menu" role="listbox">
      {filteredOptions.length ? filteredOptions.slice(0, 50).map((option, index) => (
        <button
          type="button"
          key={option.value}
          className={`ark-student-search-option${index === activeIndex ? ' active' : ''}`}
          role="option"
          aria-selected={option.value === selectedValue}
          onMouseEnter={() => setActiveIndex(index)}
          onMouseDown={event => event.preventDefault()}
          onClick={() => choose(option)}
        >
          <span>{option.label}</span>
          {option.value === selectedValue && <Check size={15}/>} 
        </button>
      )) : <div className="ark-student-search-empty">O‘quvchi topilmadi</div>}
    </div>}

    <style>{`
      .student-search-host{
        position:relative;
        width:100%;
        min-width:0;
      }
      .ark-student-combobox{
        position:relative;
        width:100%;
        min-width:0;
      }
      .reward-form:has(.ark-xp-action-host){
        grid-template-columns:1.4fr .65fr 1.3fr auto auto;
      }
      .reward-form .ark-student-search-input{
        width:100%;
        height:39px;
        box-sizing:border-box;
        border:1px solid #dfe4ed;
        border-radius:10px;
        background:#fff;
        color:#111827;
        padding:0 38px 0 38px;
        font:inherit;
        font-size:14px;
        line-height:1;
        outline:none;
        transition:border-color .16s ease,box-shadow .16s ease;
      }
      .reward-form .ark-student-search-input::placeholder{
        color:#98a1b1;
        opacity:1;
      }
      .reward-form .ark-student-search-input:hover{
        border-color:#cbd2dd;
      }
      .reward-form .ark-student-search-input:focus{
        border-color:#d3aa2c;
        box-shadow:0 0 0 3px rgba(215,169,52,.13);
      }
      .ark-student-search-icon{
        position:absolute;
        left:12px;
        top:50%;
        transform:translateY(-50%);
        color:#7f8998;
        pointer-events:none;
        z-index:2;
      }
      .ark-student-chevron{
        position:absolute;
        right:2px;
        top:50%;
        transform:translateY(-50%);
        width:34px;
        height:34px;
        border:0;
        background:transparent;
        border-radius:8px;
        color:#667085;
        display:grid;
        place-items:center;
        cursor:pointer;
        z-index:3;
      }
      .ark-student-chevron:hover{
        background:#f5f6f8;
      }
      .ark-student-search-menu{
        position:absolute;
        left:0;
        right:0;
        top:calc(100% + 6px);
        z-index:1000;
        max-height:270px;
        overflow:auto;
        padding:6px;
        background:#fff;
        border:1px solid #dfe3e8;
        border-radius:11px;
        box-shadow:0 16px 40px rgba(16,24,40,.15);
      }
      .ark-student-search-option{
        width:100%;
        min-height:39px;
        border:0;
        background:#fff;
        color:#172033;
        border-radius:8px;
        padding:8px 10px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        text-align:left;
        font:inherit;
        font-size:13px;
        cursor:pointer;
      }
      .ark-student-search-option:hover,
      .ark-student-search-option.active{
        background:#faf6e9;
        color:#111827;
      }
      .ark-student-search-option[aria-selected="true"]{
        font-weight:700;
      }
      .ark-student-search-option svg{
        color:#b8890a;
        flex:0 0 auto;
      }
      .ark-student-search-empty{
        padding:13px 11px;
        color:#8a93a2;
        font-size:12px;
        text-align:center;
      }
      .ark-xp-action-host{
        min-width:0;
      }
      .reward-form .ark-xp-button{
        width:100%;
        white-space:nowrap;
        border-color:#d7a934;
        background:#d7a934;
        color:#0b1739;
        box-shadow:0 8px 18px rgba(215,169,52,.18);
      }
      .reward-form .ark-xp-button:hover:not(:disabled){
        background:#e1b843;
      }
      .reward-form .primary:disabled,
      .reward-form .ark-xp-button:disabled{
        opacity:.48;
        cursor:not-allowed;
        box-shadow:none;
      }
      @media(max-width:1250px){
        .reward-form:has(.ark-xp-action-host){
          grid-template-columns:1fr 110px;
        }
        .ark-xp-action-host{
          grid-column:span 2;
        }
        .ark-xp-action-host .ark-xp-button{
          height:40px;
        }
      }
      @media(max-width:720px){
        .reward-form:has(.ark-xp-action-host){
          grid-template-columns:1fr;
        }
        .reward-form .ark-student-search-input{font-size:13px;height:39px}
        .ark-student-search-menu{max-height:235px}
        .ark-xp-action-host{grid-column:auto}
      }
    `}</style>
  </div>;
}

function XpAction({ form, selectEl, enabled }) {
  const giveXp = () => {
    if (!enabled || !form || !selectEl?.value) return;
    const { amount, reason } = readRewardFields(form);
    if (amount <= 0) {
      window.alert('XP miqdori 0 dan katta bo‘lishi kerak.');
      return;
    }

    const current = readTrackerState();
    const next = applyXpReward(current, selectEl.value, amount, reason);
    if (next === current) return;
    persistRewardState(next, 'gamification-xp-reward');
  };

  return <button
    type="button"
    className="primary ark-xp-button"
    disabled={!enabled}
    aria-disabled={enabled ? 'false' : 'true'}
    title={enabled ? 'XP faqat oshadi va levelga ta’sir qiladi' : 'Avval o‘quvchini qidirib tanlang'}
    onClick={giveXp}
  >
    <Sparkles size={16}/>
    XP berish
  </button>;
}

export default function GamificationSearchEnhancer() {
  const [mount, setMount] = useState(null);
  const [xpMount, setXpMount] = useState(null);
  const [formEl, setFormEl] = useState(null);
  const [selectEl, setSelectEl] = useState(null);
  const [rewardButton, setRewardButton] = useState(null);
  const [selectionIsValid, setSelectionIsValid] = useState(false);

  useEffect(() => {
    const returnToGamification = () => {
      if (sessionStorage.getItem(RETURN_PAGE_KEY) !== 'gamification') return;
      const navButton = [...document.querySelectorAll('.sidebar nav button')]
        .find(button => normalizeText(button.textContent).includes('gamification'));
      if (!navButton) return;
      sessionStorage.removeItem(RETURN_PAGE_KEY);
      setTimeout(() => navButton.click(), 40);
    };

    const locate = () => {
      returnToGamification();

      const form = document.querySelector('.reward-form');
      const select = form?.querySelector('select');
      const button = form?.querySelector('button.primary');

      if (!form || !select) {
        setMount(null);
        setXpMount(null);
        setFormEl(null);
        setSelectEl(null);
        setRewardButton(null);
        setSelectionIsValid(false);
        return;
      }

      let host = form.querySelector('[data-gamification-search-host="1"]');
      if (!host) {
        host = document.createElement('div');
        host.dataset.gamificationSearchHost = '1';
        host.className = 'student-search-host';
        form.insertBefore(host, select);
      }

      let actionHost = form.querySelector('[data-gamification-xp-host="1"]');
      if (!actionHost) {
        actionHost = document.createElement('div');
        actionHost.dataset.gamificationXpHost = '1';
        actionHost.className = 'ark-xp-action-host';
        button?.insertAdjacentElement('afterend', actionHost);
      }

      select.dataset.arkSearchHidden = '1';
      select.style.display = 'none';
      select.setAttribute('aria-hidden', 'true');

      setMount(host);
      setXpMount(actionHost);
      setFormEl(form);
      setSelectEl(select);
      setRewardButton(button || null);
    };

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.querySelectorAll('select[data-ark-search-hidden="1"]').forEach(select => {
        select.style.display = '';
        select.removeAttribute('aria-hidden');
        delete select.dataset.arkSearchHidden;
      });
    };
  }, []);

  useEffect(() => {
    if (!rewardButton || !formEl || !selectEl) return;

    const handleCoinClick = event => {
      if (rewardButton.disabled || !selectionIsValid || !selectEl.value) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      const { amount, reason } = readRewardFields(formEl);
      if (!amount) return;

      const current = readTrackerState();
      const next = applyCoinReward(current, selectEl.value, amount, reason);
      if (next === current) return;
      persistRewardState(next, 'gamification-coin-reward');
    };

    rewardButton.addEventListener('click', handleCoinClick, true);
    return () => rewardButton.removeEventListener('click', handleCoinClick, true);
  }, [rewardButton, formEl, selectEl, selectionIsValid]);

  return <>
    {mount && selectEl && createPortal(
      <StudentSearchPicker
        selectEl={selectEl}
        rewardButton={rewardButton}
        onSelectionValidityChange={setSelectionIsValid}
      />,
      mount
    )}
    {xpMount && formEl && selectEl && createPortal(
      <XpAction form={formEl} selectEl={selectEl} enabled={selectionIsValid}/>,
      xpMount
    )}
  </>;
}

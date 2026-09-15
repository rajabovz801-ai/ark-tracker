'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

function normalizeText(value) {
  return String(value || '')
    .toLocaleLowerCase('uz')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function StudentSearchPicker({ selectEl }) {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [options, setOptions] = useState([]);
  const [selectedValue, setSelectedValue] = useState('');
  const [searchText, setSearchText] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!selectEl) return;

    const sync = () => {
      const nextOptions = [...selectEl.options]
        .filter(option => option.value)
        .map(option => ({ value: option.value, label: option.textContent?.trim() || '' }));
      const nextValue = selectEl.value || nextOptions[0]?.value || '';
      const selected = nextOptions.find(option => option.value === nextValue);

      setOptions(nextOptions);
      setSelectedValue(nextValue);
      setSearchText(selected?.label || '');
    };

    sync();
    selectEl.addEventListener('change', sync);
    return () => selectEl.removeEventListener('change', sync);
  }, [selectEl]);

  useEffect(() => {
    const handleOutside = event => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        const selected = options.find(option => option.value === selectedValue);
        setSearchText(selected?.label || '');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [options, selectedValue]);

  const selectedOption = useMemo(
    () => options.find(option => option.value === selectedValue),
    [options, selectedValue]
  );

  const filteredOptions = useMemo(() => {
    const typed = normalizeText(searchText);
    const selectedLabel = normalizeText(selectedOption?.label);
    const query = typed === selectedLabel ? '' : typed;

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
    const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    descriptor?.set?.call(selectEl, option.value);
    selectEl.dispatchEvent(new Event('input', { bubbles: true }));
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));

    setSelectedValue(option.value);
    setSearchText(option.label);
    setOpen(false);
    setActiveIndex(0);
  };

  const handleFocus = event => {
    setOpen(true);
    setActiveIndex(0);
    requestAnimationFrame(() => event.currentTarget.select());
  };

  const handleKeyDown = event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => Math.min(index + 1, Math.max(0, filteredOptions.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open && filteredOptions.length) {
      event.preventDefault();
      choose(filteredOptions[activeIndex] || filteredOptions[0]);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setSearchText(selectedOption?.label || '');
      inputRef.current?.blur();
    }
  };

  return <div className="ark-student-combobox" ref={rootRef}>
    <Search className="ark-student-search-icon" size={18}/>
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
      <ChevronDown size={18}/>
    </button>

    {open && <div className="ark-student-search-menu" role="listbox">
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
          {option.value === selectedValue && <Check size={16}/>} 
        </button>
      )) : <div className="ark-student-search-empty">O‘quvchi topilmadi</div>}
    </div>}

    <style>{`
      .student-search-host{position:relative;min-width:0;width:100%;}
      .ark-student-combobox{position:relative;width:100%;min-width:0;}
      .ark-student-search-input{width:100%;height:50px;box-sizing:border-box;border:1px solid #d9dee7;border-radius:12px;background:#fff;color:#111827;padding:0 42px 0 42px;font:inherit;font-size:16px;outline:none;transition:border-color .16s ease,box-shadow .16s ease;background-clip:padding-box;}
      .ark-student-search-input:hover{border-color:#c7ced9;}
      .ark-student-search-input:focus{border-color:#e6b400;box-shadow:0 0 0 3px rgba(246,195,0,.16);}
      .ark-student-search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#7b8492;pointer-events:none;z-index:2;}
      .ark-student-chevron{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:0;background:transparent;border-radius:9px;color:#4b5563;display:grid;place-items:center;cursor:pointer;z-index:3;}
      .ark-student-chevron:hover{background:#f5f6f8;}
      .ark-student-search-menu{position:absolute;left:0;right:0;top:calc(100% + 7px);z-index:1000;max-height:286px;overflow:auto;padding:6px;background:#fff;border:1px solid #dfe3e8;border-radius:13px;box-shadow:0 18px 44px rgba(16,24,40,.16);}
      .ark-student-search-option{width:100%;min-height:42px;border:0;background:#fff;color:#172033;border-radius:9px;padding:9px 11px;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;font:inherit;font-size:15px;cursor:pointer;}
      .ark-student-search-option:hover,.ark-student-search-option.active{background:#f7f3e6;color:#111827;}
      .ark-student-search-option[aria-selected="true"]{font-weight:700;}
      .ark-student-search-option svg{color:#c59600;flex:0 0 auto;}
      .ark-student-search-empty{padding:14px 12px;color:#8a93a2;font-size:14px;text-align:center;}
      @media(max-width:720px){.ark-student-search-input{font-size:15px;height:48px}.ark-student-search-menu{max-height:240px}}
    `}</style>
  </div>;
}

export default function GamificationSearchEnhancer() {
  const [mount, setMount] = useState(null);
  const [selectEl, setSelectEl] = useState(null);

  useEffect(() => {
    const locate = () => {
      const form = document.querySelector('.reward-form');
      const select = form?.querySelector('select');

      if (!form || !select) {
        setMount(null);
        setSelectEl(null);
        return;
      }

      let host = form.querySelector('[data-gamification-search-host="1"]');
      if (!host) {
        host = document.createElement('div');
        host.dataset.gamificationSearchHost = '1';
        host.className = 'student-search-host';
        form.insertBefore(host, select);
      }

      select.dataset.arkSearchHidden = '1';
      select.style.display = 'none';
      select.setAttribute('aria-hidden', 'true');
      setMount(host);
      setSelectEl(select);
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

  if (!mount || !selectEl) return null;
  return createPortal(<StudentSearchPicker selectEl={selectEl}/>, mount);
}

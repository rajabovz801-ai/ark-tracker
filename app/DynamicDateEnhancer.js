'use client';

import { useEffect } from 'react';

function localISODate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,'0');
  const d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function prettyDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('uz-UZ',{day:'numeric',month:'short',year:'numeric',weekday:'short'}).format(date);
}

function ensureOption(select,value) {
  if (!value || [...select.options].some(option => option.value === value)) return;
  const option = document.createElement('option');
  option.value = value;
  option.textContent = prettyDate(value);
  option.dataset.dynamicDate = '1';
  select.appendChild(option);
}

export default function DynamicDateEnhancer() {
  useEffect(() => {
    let observer = null;
    let frame = 0;
    let currentSelect = null;
    let input = null;
    let wrapper = null;
    let onInput = null;

    const cleanupPicker = () => {
      if (input && onInput) input.removeEventListener('change',onInput);
      wrapper?.remove();
      currentSelect?.closest('.select-wrap')?.classList.remove('ark-native-date-select');
      input = null;
      wrapper = null;
      currentSelect = null;
      onInput = null;
    };

    const locate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const shell = document.querySelector('.app-shell');
        if (shell?.dataset?.pageKey !== 'Daily') {
          cleanupPicker();
          return;
        }
        const toolbar = shell.querySelector('.daily-toolbar');
        const selects = [...(toolbar?.querySelectorAll('.controls select') || [])];
        const dateSelect = selects.find(select => [...select.options].some(option => /^\d{4}-\d{2}-\d{2}$/.test(option.value)));
        if (!dateSelect) return;

        const selected = /^\d{4}-\d{2}-\d{2}$/.test(dateSelect.value) ? dateSelect.value : localISODate();
        ensureOption(dateSelect,selected);

        if (currentSelect !== dateSelect || !document.body.contains(wrapper)) {
          cleanupPicker();
          currentSelect = dateSelect;
          const nativeWrap = dateSelect.closest('.select-wrap');
          nativeWrap?.classList.add('ark-native-date-select');

          wrapper = document.createElement('label');
          wrapper.className = 'select-wrap ark-dynamic-date-picker';
          wrapper.innerHTML = '<span class="ark-date-icon" aria-hidden="true">▣</span>';
          input = document.createElement('input');
          input.type = 'date';
          input.min = '2026-09-07';
          input.value = selected;
          input.setAttribute('aria-label','Sana');
          wrapper.appendChild(input);
          nativeWrap?.insertAdjacentElement('afterend',wrapper);

          onInput = () => {
            const value = input.value;
            if (!value) return;
            ensureOption(dateSelect,value);
            dateSelect.value = value;
            dateSelect.dispatchEvent(new Event('change',{bubbles:true}));
            setTimeout(() => {
              const title = document.querySelector('.app-shell[data-page-key="Daily"] .daily-toolbar h2');
              const group = selects[0]?.value || '';
              if (title) title.textContent = `${group} · ${prettyDate(value)}`;
            },0);
          };
          input.addEventListener('change',onInput);
        }

        const actual = dateSelect.value;
        if (/^\d{4}-\d{2}-\d{2}$/.test(actual) && input && input.value !== actual) input.value = actual;
        if (input && !input.value) input.value = localISODate();
      });
    };

    locate();
    observer = new MutationObserver(locate);
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-page-key']});
    window.addEventListener('ark-page-changed',locate);
    window.addEventListener('ark-course-changed',locate);
    return () => {
      cancelAnimationFrame(frame);
      cleanupPicker();
      observer?.disconnect();
      window.removeEventListener('ark-page-changed',locate);
      window.removeEventListener('ark-course-changed',locate);
    };
  },[]);

  return null;
}

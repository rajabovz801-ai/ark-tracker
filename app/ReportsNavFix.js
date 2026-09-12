'use client';

import { useEffect } from 'react';

const LABELS = [
  { key: 'Dashboard', names: ['dashboard', 'bosh sahifa'] },
  { key: 'Daily', names: ['daily control', 'kunlik nazorat'] },
  { key: 'Students', names: ['students', 'o‘quvchilar', "o'quvchilar"] },
  { key: 'Groups', names: ['groups', 'guruhlar'] },
  { key: 'Staff', names: ['teachers & admin', 'o‘qituvchilar va adminlar', "o'qituvchilar va adminlar"] },
  { key: 'Finance', names: ['finance', 'moliya'] },
  { key: 'Reports', names: ['reports', 'hisobotlar'] },
  { key: 'Gamification', names: ['gamification', 'gamifikatsiya'] },
  { key: 'Shop', names: ['shop', 'do‘kon', "do'kon"] },
  { key: 'Leaderboard', names: ['leaderboard', 'reyting'] },
  { key: 'Black list', names: ['black list', 'qora ro‘yxat', "qora ro'yxat"] },
];

function pageKeyFromText(text = '') {
  const value = String(text).trim().toLocaleLowerCase('uz-UZ');
  const found = LABELS.find(item => item.names.some(name => value === name || value.startsWith(`${name} `)));
  return found?.key || '';
}

function reportsIcon() {
  return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 16v-5"/><path d="M12 16V8"/><path d="M17 16V5"/></svg><span>Reports</span>';
}

export default function ReportsNavFix() {
  useEffect(() => {
    let observer = null;
    let cleanupNav = null;
    let frame = 0;

    const wire = () => {
      const shell = document.querySelector('.app-shell');
      const nav = shell?.querySelector('.sidebar nav');
      if (!shell || !nav) return false;

      const profile = window.__ARK_AUTH_PROFILE__;
      const reportsAllowed = profile?.role === 'owner' || profile?.role === 'admin';
      let reports = nav.querySelector('[data-ark-reports="1"]');

      if (reportsAllowed && !reports) {
        reports = document.createElement('button');
        reports.type = 'button';
        reports.dataset.arkReports = '1';
        reports.dataset.pageKey = 'Reports';
        reports.innerHTML = reportsIcon();
        const finance = [...nav.querySelectorAll('button')].find(button => {
          const key = button.dataset.pageKey || pageKeyFromText(button.textContent);
          return key === 'Finance';
        });
        finance?.insertAdjacentElement('afterend', reports);
        if (!finance) nav.appendChild(reports);
      } else if (!reportsAllowed && reports) {
        reports.remove();
        reports = null;
      }

      [...nav.querySelectorAll('button')].forEach(button => {
        const key = button.dataset.pageKey || pageKeyFromText(button.textContent);
        if (key) button.dataset.pageKey = key;
      });

      const emit = key => {
        if (!key) return;
        shell.dataset.pageKey = key;
        window.dispatchEvent(new CustomEvent('ark-page-changed', { detail: { pageKey: key } }));
      };

      const syncActive = () => {
        const reportButton = nav.querySelector('[data-ark-reports="1"]');
        if (shell.classList.contains('reports-mode') && reportButton) {
          nav.querySelectorAll('button').forEach(button => button.classList.toggle('active', button === reportButton));
          emit('Reports');
          return;
        }
        const active = nav.querySelector('button.active');
        const key = active?.dataset.pageKey || pageKeyFromText(active?.textContent);
        if (key && key !== 'Reports') emit(key);
        reportButton?.classList.remove('active');
      };

      const onClick = event => {
        const clicked = event.target.closest('button');
        if (!clicked || !nav.contains(clicked)) return;
        const key = clicked.dataset.pageKey || pageKeyFromText(clicked.textContent);
        if (key === 'Reports') {
          event.preventDefault();
          shell.classList.add('reports-mode');
          nav.querySelectorAll('button').forEach(button => button.classList.toggle('active', button === clicked));
          emit('Reports');
          return;
        }
        shell.classList.remove('reports-mode');
        if (key) emit(key);
        requestAnimationFrame(syncActive);
      };

      cleanupNav?.();
      nav.addEventListener('click', onClick, true);
      cleanupNav = () => nav.removeEventListener('click', onClick, true);
      syncActive();
      return true;
    };

    const locate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => wire());
    };

    wire();
    observer = new MutationObserver(locate);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    window.addEventListener('ark-auth-profile-ready', locate);

    return () => {
      cancelAnimationFrame(frame);
      cleanupNav?.();
      observer?.disconnect();
      window.removeEventListener('ark-auth-profile-ready', locate);
    };
  }, []);

  return null;
}

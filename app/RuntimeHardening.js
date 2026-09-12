'use client';

import { useEffect } from 'react';
import { ensureFreshSession, readSession } from './arkAuthClient';

const LAST_COURSE_KEY = 'ark-tracker-last-course';

export default function RuntimeHardening() {
  useEffect(() => {
    let stopped = false;
    let refreshTimer = null;
    let scopeTimer = null;

    const refreshAuth = async () => {
      try {
        const current = readSession();
        if (!current?.access_token) return;
        await ensureFreshSession(current);
      } catch (error) {
        console.warn('[ARK Tracker] Background session refresh failed.', error);
      }
    };

    const enforceTeacherScope = () => {
      if (stopped) return;
      const profile = window.__ARK_AUTH_PROFILE__;
      if (!profile) return;
      window.dispatchEvent(new CustomEvent('ark-auth-profile-ready', { detail: { role: profile.role } }));
      if (profile.role !== 'teacher') return;
      const preferred = Array.isArray(profile.course_ids) && profile.course_ids.length ? profile.course_ids[0] : '';
      if (!preferred) return;

      const previous = localStorage.getItem(LAST_COURSE_KEY);
      if (previous !== preferred) localStorage.setItem(LAST_COURSE_KEY, preferred);

      const select = document.querySelector('.course-switcher select');
      if (select && select.value !== preferred && [...select.options].some(option => option.value === preferred)) {
        select.value = preferred;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (previous !== preferred) {
        window.dispatchEvent(new CustomEvent('ark-course-changed', { detail: { courseId: preferred, source: 'teacher-scope' } }));
      }
    };

    const tick = () => {
      enforceTeacherScope();
      clearTimeout(scopeTimer);
      scopeTimer = setTimeout(tick, 700);
    };

    const onFocus = () => {
      refreshAuth();
      enforceTeacherScope();
    };
    const onVisibility = () => {
      if (!document.hidden) onFocus();
    };

    refreshAuth();
    tick();
    refreshTimer = setInterval(refreshAuth, 4 * 60 * 1000);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      clearInterval(refreshTimer);
      clearTimeout(scopeTimer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}

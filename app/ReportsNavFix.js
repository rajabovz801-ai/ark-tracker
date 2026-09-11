'use client';

import { useEffect } from 'react';

export default function ReportsNavFix() {
  useEffect(() => {
    const shell = document.querySelector('.app-shell');
    const nav = shell?.querySelector('.sidebar nav');
    if (!shell || !nav) return;

    const getReportsButton = () => nav.querySelector('[data-ark-reports="1"]');
    const clearStaleActive = () => {
      const reportsButton = getReportsButton();
      if (reportsButton && !shell.classList.contains('reports-mode')) {
        reportsButton.classList.remove('active');
      }
    };

    const onNavClick = event => {
      const clicked = event.target.closest('button');
      const reportsButton = getReportsButton();
      if (clicked && reportsButton && clicked !== reportsButton) {
        reportsButton.classList.remove('active');
      }
    };

    const observer = new MutationObserver(clearStaleActive);
    observer.observe(shell, { attributes: true, attributeFilter: ['class'] });
    observer.observe(nav, { childList: true, subtree: true });
    nav.addEventListener('click', onNavClick, true);

    const frame = requestAnimationFrame(clearStaleActive);
    return () => {
      cancelAnimationFrame(frame);
      nav.removeEventListener('click', onNavClick, true);
      observer.disconnect();
    };
  }, []);

  return null;
}

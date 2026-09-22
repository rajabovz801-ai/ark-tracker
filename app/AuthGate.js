'use client';

import { useEffect, useState } from 'react';

export default function AuthGate({ children }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleReady = () => {
      setError('');
      setReady(true);
    };

    const handleError = event => {
      setReady(false);
      setError(event?.detail?.message || 'Cloud sync is unavailable.');
    };

    window.addEventListener('ark-cloud-ready', handleReady);
    window.addEventListener('ark-cloud-error', handleError);

    if (window.__ARK_CLOUD_READY__) {
      handleReady();
    } else {
      let script = document.getElementById('ark-cloud-sync');
      if (!script) {
        script = document.createElement('script');
        script.id = 'ark-cloud-sync';
        script.src = '/cloud-sync.js';
        script.async = true;
        script.onerror = () => handleError({
          detail: { message: 'Could not load ARK Cloud sync.' },
        });
        document.head.appendChild(script);
      }
    }

    return () => {
      window.removeEventListener('ark-cloud-ready', handleReady);
      window.removeEventListener('ark-cloud-error', handleError);
    };
  }, []);

  if (!ready) {
    return (
      <div className="auth-cloud-wait">
        <div className="auth-spinner"/>
        <h2>Opening ARK Tracker</h2>
        <p>{error || 'Syncing the latest tracker data…'}</p>
        {error && (
          <button className="primary" type="button" onClick={() => window.location.reload()}>
            Retry
          </button>
        )}
      </div>
    );
  }

  return children;
}

(() => {
  const workerURL = document.currentScript?.dataset.cacheWorker;
  const control = document.querySelector('[data-site-cache]');
  if (!workerURL || !control || !isSecureContext || !('serviceWorker' in navigator)) return;
  const button = control.querySelector('[data-cache-refresh]');
  const status = control.querySelector('[data-cache-status]');
  const noticeKey = 'pairs-lab:cache-refreshed';
  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register(workerURL, { updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      control.hidden = false;
      try {
        if (sessionStorage.getItem(noticeKey)) {
          status.textContent = 'Cache refreshed. Pet records kept.';
          sessionStorage.removeItem(noticeKey);
        }
      } catch (_) { /* Private browsing can disable storage. */ }
      button.addEventListener('click', async () => {
        button.disabled = true;
        status.textContent = 'Refreshing…';
        try {
          const worker = navigator.serviceWorker.controller || registration.active;
          if (!worker) throw new Error('Cache worker unavailable');
          await new Promise((resolve, reject) => {
            const channel = new MessageChannel();
            const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Cache refresh timeout')); }, 8000);
            channel.port1.onmessage = event => {
              clearTimeout(timer);
              channel.port1.close();
              event.data?.ok ? resolve() : reject(new Error('Cache refresh failed'));
            };
            worker.postMessage({ type: 'CLEAR_ASSET_CACHE' }, [channel.port2]);
          });
          try { sessionStorage.setItem(noticeKey, '1'); } catch (_) { /* Optional status only. */ }
          location.reload();
        } catch (_) {
          status.textContent = 'Could not refresh. Please try again.';
          button.disabled = false;
        }
      });
    } catch (_) {
      // Ordinary browser loading still works when service workers are blocked.
      control.hidden = true;
    }
  };
  const schedule = () => {
    if ('requestIdleCallback' in window) requestIdleCallback(register, { timeout: 2000 });
    else setTimeout(register, 1000);
  };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
})();

/**
 * AdShield Pro — Parental Guard
 * Sadece service worker tarafından engellenen sitelerde
 * blocked.html'e redirect edilmeden önce overlay gösterir.
 * Bu script yalnızca service worker tarafından dinamik olarak
 * inject edildiğinde çalışır — tüm sitelerde değil.
 */
(function () {
  const OVERLAY_ID = '__adshield_guard__';
  if (document.getElementById(OVERLAY_ID)) return;

  const el = document.createElement('div');
  el.id = OVERLAY_ID;
  el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#020617;display:flex;align-items:center;justify-content:center;';
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;opacity:.5;">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span style="color:#475569;font-size:12px;font-family:system-ui,sans-serif;">Engelleniyor...</span>
    </div>
  `;
  (document.documentElement || document.body)?.appendChild(el);
})();

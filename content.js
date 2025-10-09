// Injects an in-page warning banner if keyword interception (e.g., Zscaler) is detected
// and the page contains a password input. Relies on background cached TLS status.

(async () => {
  const browserApi = (typeof browser !== 'undefined') ? browser : chrome;

  // Per-host session suppression so closing the banner keeps it closed while the tab lives.
  const SUPPRESS_KEY = '__tlsd_dismissed_' + location.host;
  let dismissedForSession = false;
  try { dismissedForSession = sessionStorage.getItem(SUPPRESS_KEY) === '1'; } catch {}

  function hasPasswordField() {
    return !!document.querySelector('input[type="password"],input[autocomplete="current-password"],input[autocomplete="new-password"]');
  }

  function injectBanner(info) {
    if (dismissedForSession) return;
    if (document.getElementById('tls-detector-banner')) return; // already injected
    const host = location.hostname;
    // Inline SVG (was previously loaded via moz-extension URL but some site CSPs blocked it)
    const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="grad-lock" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e5e8ea"/>
      <stop offset="100%" stop-color="#6d7175"/>
    </linearGradient>
    <radialGradient id="grad-iris" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="55%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </radialGradient>
  </defs>
  <rect width="48" height="48" fill="none"/>
  <path fill="none" stroke="#8b9297" stroke-width="3.9" stroke-linecap="round" d="M13 20v-7.5c0-6.5 5.8-10.5 11-10.5h0c5.2 0 11 4 11 10.5V20"/>
  <path fill="url(#grad-lock)" stroke="#8b9297" stroke-width="2.5" d="M3 19h42v28H3z"/>
  <circle cx="24" cy="29" r="4" fill="#1f2427"/>
  <rect x="22.4" y="31" width="3.2" height="8" rx="1.6" fill="#1f2427"/>
  <g>
    <ellipse cx="22" cy="20.5" rx="22" ry="13" fill="#ffffff" stroke="#2d2d2d" stroke-width="2" transform="rotate(-11 22 20.5)"/>
    <circle cx="22" cy="20.5" r="9.5" fill="url(#grad-iris)" stroke="#1e3a8a" stroke-width="1" transform="rotate(-11 22 20.5)"/>
    <circle cx="22" cy="20.5" r="5.2" fill="#0a0a0a" transform="rotate(-11 22 20.5)"/>
    <circle cx="24.9" cy="17.9" r="2.6" fill="#ffffff" transform="rotate(-11 22 20.5)"/>
  </g>
</svg>`;
    const banner = document.createElement('div');
    banner.id = 'tls-detector-banner';
    banner.innerHTML = `
      <div class="tlsd-inner">
        <span class="tlsd-icon" role="img" aria-label="Intercepted TLS">${ICON_SVG}</span>
        <strong>Intercepted TLS detected</strong> — A certificate on <code>${host}</code> contains the keyword <code>${info.keyword}</code> while this page includes a password field. Consider avoiding credential entry.
        <button type="button" class="tlsd-close" aria-label="Dismiss warning" title="Dismiss">×</button>
      </div>`;
    const style = document.createElement('style');
    style.textContent = `
      #tls-detector-banner { position: fixed; z-index: 2147483647; top: 0; left: 0; right: 0; background: #b45309; color: #fff; font: 13px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; box-shadow: 0 2px 4px rgba(0,0,0,.25); padding: 6px 10px; display: flex; } 
      #tls-detector-banner .tlsd-inner { flex: 1; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  #tls-detector-banner .tlsd-icon { width:24px; height:24px; flex:0 0 auto; filter: drop-shadow(0 0 1px rgba(0,0,0,.4)); display:inline-flex; }
  #tls-detector-banner .tlsd-icon svg { width:24px; height:24px; display:block; }
      #tls-detector-banner code { background: rgba(255,255,255,.15); padding: 2px 4px; border-radius: 4px; font-size: 12px; }
      #tls-detector-banner .tlsd-close { background: rgba(0,0,0,.25); color: #fff; border: none; border-radius: 4px; font-size: 16px; line-height: 16px; width: 28px; height: 24px; cursor: pointer; }
      #tls-detector-banner .tlsd-close:hover { background: rgba(0,0,0,.35); }
      body.tlsd-banner-offset { margin-top: 40px !important; }
      @media (max-width:480px){ #tls-detector-banner { font-size: 12px; } }
    `;
    document.documentElement.appendChild(style);
    document.documentElement.appendChild(banner);
    document.body.classList.add('tlsd-banner-offset');
    function removeBanner() {
      if (!banner.isConnected) return;
      banner.remove();
      document.body.classList.remove('tlsd-banner-offset');
      document.removeEventListener('keydown', escHandler, true);
      dismissedForSession = true;
      try { sessionStorage.setItem(SUPPRESS_KEY, '1'); } catch {}
    }
    function escHandler(e) { if (e.key === 'Escape') removeBanner(); }
    document.addEventListener('keydown', escHandler, true);
    // Event delegation in case the button is re-rendered by frameworks
    banner.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.classList && target.classList.contains('tlsd-close')) {
        e.preventDefault();
        removeBanner();
      }
    });
  }

  async function requestStatus() {
    try {
      const host = location.hostname;
      const info = await browserApi.runtime.sendMessage({ type: 'getStatusForHost', host });
      if (!info) return;
      if (!dismissedForSession && info.detected && info.isSecure && hasPasswordField()) {
        injectBanner(info);
      }
    } catch (e) {
      // fail silently
    }
  }

  // Initial attempt after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', requestStatus, { once: true });
  } else {
    requestStatus();
  }

  // Also observe dynamic insertion of password fields
  const mo = new MutationObserver(() => {
    if (dismissedForSession) return;
    if (document.getElementById('tls-detector-banner')) return;
    if (hasPasswordField()) requestStatus();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

})();

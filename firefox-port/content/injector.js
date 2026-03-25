(() => {
  // Her zaman aktif - enabled kontrolü yok
  function stripAds(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      for (let i = obj.length - 1; i >= 0; i--) stripAds(obj[i]);
      return obj;
    }
    if (obj.playerAds && Array.isArray(obj.playerAds)) obj.playerAds.length = 0;
    if (obj.adPlacements && Array.isArray(obj.adPlacements)) obj.adPlacements.length = 0;
    if (obj.adBreaks && Array.isArray(obj.adBreaks)) obj.adBreaks.length = 0;
    if (obj.adSlots && Array.isArray(obj.adSlots)) obj.adSlots.length = 0;
    delete obj.prerollPlacement;
    delete obj.midrollPrefetchCondition;
    delete obj.adSafetyReason;
    if (obj.playerResponse && typeof obj.playerResponse === 'object') stripAds(obj.playerResponse);
    if (obj.response && typeof obj.response === 'object') stripAds(obj.response);
    return obj;
  }

  function defineCleanGetter(target, key) {
    let value = target[key];
    Object.defineProperty(target, key, {
      configurable: true, enumerable: true,
      get() { return value; },
      set(v) { value = stripAds(v); }
    });
  }

  const w = window;

  // ytInitialPlayerResponse'u temizle
  try { if ('ytInitialPlayerResponse' in w) w.ytInitialPlayerResponse = stripAds(w.ytInitialPlayerResponse); } catch {}
  try { defineCleanGetter(w, 'ytInitialPlayerResponse'); } catch {}

  // Fetch kancası
  const origFetch = w.fetch;
  w.fetch = async function(...args) {
    const origUrl = args[0] instanceof Request ? args[0].url : String(args[0] || '');
    if (/\/youtubei\/v1\/player|\/get_video_info|player\?/i.test(origUrl) &&
        !/\/youtubei\/v1\/browse|\/youtubei\/v1\/next|\/youtubei\/v1\/channel/i.test(origUrl)) {
      try {
        const res = await origFetch.apply(this, args);
        const clone = res.clone();
        const ct = clone.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await clone.json();
          stripAds(data);
          const body = JSON.stringify(data);
          return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
        }
        return res;
      } catch(e) {
        return origFetch.apply(this, args);
      }
    }
    return origFetch.apply(this, args);
  };

  // XHR kancası
  const OrigXHR = w.XMLHttpRequest;
  function WrappedXHR() { const xhr = new OrigXHR(); return wrapXHR(xhr); }
  function wrapXHR(xhr) {
    let url = '';
    const open = xhr.open;
    xhr.open = function(method, u, ...rest) {
      url = String(u || '');
      return open.call(this, method, u, ...rest);
    };
    const send = xhr.send;
    xhr.send = function(...rest) {
      this.addEventListener('readystatechange', function() {
        try {
          if (this.readyState === 4 &&
              /\/youtubei\/v1\/player|\/get_video_info|player\?/i.test(url) &&
              !/\/youtubei\/v1\/browse|\/youtubei\/v1\/next|\/youtubei\/v1\/channel/i.test(url)) {
            const ct = this.getResponseHeader('content-type') || '';
            if (ct.includes('application/json') || ct.includes('text/plain')) {
              try {
                const data = JSON.parse(this.responseText);
                stripAds(data);
                const text = JSON.stringify(data);
                Object.defineProperty(this, 'responseText', { value: text, writable: false });
                Object.defineProperty(this, 'response', { value: text, writable: false });
              } catch(e) {}
            }
          }
        } catch(e) {}
      });
      return send.apply(this, rest);
    };
    return xhr;
  }
  WrappedXHR.prototype = OrigXHR.prototype;
  w.XMLHttpRequest = WrappedXHR;
})();

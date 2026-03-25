(() => {
  // ── Yardımcı Fonksiyonlar ─────────────────────────────────────────────
  function select(selector, root = document) {
    try { return root.querySelector(selector); } catch(_) { return null; }
  }

  function selectAll(selector, root = document) {
    try { return Array.from(root.querySelectorAll(selector)); } catch(_) { return []; }
  }

  function hideElements(selectors) {
    for (const selector of selectors) {
      for (const el of selectAll(selector)) {
        if (el && el.style) {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('opacity', '0', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
        }
      }
    }
  }

  function tryClick(el) {
    if (!el) return false;
    try { el.click(); return true; } catch (_) { return false; }
  }

  // ── Reklam Tespiti ────────────────────────────────────────────────────
  // YouTube'un reklam gösterdiğini anlamak için kullandığı tüm sinyaller
  // En az 2 sinyal eşleşmeli — yanlış pozitifi önler
  function isAdPlaying() {
    let signals = 0;

    if (document.querySelector('.ad-showing'))            signals++;
    if (document.querySelector('.ad-interrupting'))       signals++;
    if (document.querySelector('.ytp-ad-player-overlay')) signals++;
    if (document.querySelector('.ytp-ad-text'))           signals++;
    if (document.querySelector('.ytp-ad-message-container')) signals++;
    if (document.querySelector('.ytp-ad-preview-container')) signals++;

    // Player class kontrolü
    const player = document.querySelector('#movie_player');
    if (player && player.classList.contains('ad-showing')) signals++;

    // ytd-player-legacy-desktop-watch-ads-renderer
    if (document.querySelector('ytd-player-legacy-desktop-watch-ads-renderer')) signals++;

    // En az 2 sinyal gerekli — tek sinyal yanlış pozitif olabilir
    return signals >= 2;
  }

  // ── Skip Butonu ───────────────────────────────────────────────────────
  function skipVideoAd() {
    const skipSelectors = [
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-ad-skip-button-container button',
      'button.ytp-skip-ad-button',
      'button.ytp-ad-skip-button',
      '.ytp-ad-skip-button-slot button',
      '[class*="skip-button"]',
    ];
    for (const sel of skipSelectors) {
      const btn = select(sel);
      if (btn && btn.offsetParent !== null && tryClick(btn)) return true;
    }
    return false;
  }

  // ── Video Reklam Hızlandırma + Atlama ────────────────────────────────
  let wasAutomuted = false;

  function handleAdPlayback() {
    const video = select('video');
    if (!video) return;

    const ad = isAdPlaying();

    if (ad) {
      // Sesi kapat
      if (!video.muted) {
        video.muted = true;
        wasAutomuted = true;
      }
      // Görünmez yap
      video.style.setProperty('opacity', '0', 'important');

      // Maksimum hıza al
      try { video.playbackRate = 16; } catch(_) {}

      // Skip butonuna bas
      const skipped = skipVideoAd();

      // Skip olmadıysa sona atla
      // Güvenlik: sadece kısa videolarda (reklam) atla, uzun videolara dokunma
      if (!skipped && Number.isFinite(video.duration) && video.duration > 0 && video.duration < 120) {
        try {
          if (video.currentTime < video.duration - 0.1) {
            video.currentTime = video.duration - 0.1;
          }
        } catch (_) {}
      }
    } else {
      // Normal video — her şeyi geri al
      if (video.playbackRate !== 1) {
        try { video.playbackRate = 1; } catch(_) {}
      }
      if (video.style.opacity === '0') {
        video.style.removeProperty('opacity');
      }
      if (wasAutomuted) {
        video.muted = false;
        wasAutomuted = false;
      }
    }
  }

  // ── Overlay & Banner Reklamları Kaldır ───────────────────────────────
  const AD_SELECTORS = [
    // Player içi
    '#player-ads',
    '.video-ads',
    '.ytp-ad-image-overlay',
    '.ytp-ad-overlay-slot',
    '.ytp-ad-module',
    '.ytp-paid-content-overlay',
    '.ytp-ad-player-overlay-instream-info',
    '.ytp-ad-preview-container',
    '.ytp-ad-progress',
    '.ytp-ad-progress-list',
    // Sayfa içi
    '#masthead-ad',
    'ytd-display-ad-renderer',
    'ytd-action-companion-ad-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-ad-slot-renderer',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-promoted-video-renderer',
    'ytd-search-pyv-renderer',
    'ytd-banner-promo-renderer',
    'ytd-statement-banner-renderer',
    'ytd-rich-item-renderer.ytd-rich-grid-row[is-ad]',
    // Shorts reklamları
    'ytd-reel-shelf-renderer',
    // Mastheads
    '.ytd-masthead-ad-v4-renderer',
    '.ytd-masthead-ad-v3-renderer',
  ];

  function removeAdOverlays() {
    hideElements(AD_SELECTORS);

    // /watch sayfasına özel
    if (window.location.pathname.includes('/watch')) {
      hideElements([
        'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-macro-markers-description-chapters"] .ad-container'
      ]);
    }
  }

  // ── Masthead Koruması ─────────────────────────────────────────────────
  // Reklam gizleme bazen gerçek header'ı da etkiler, bunu önle
  function restoreMasthead() {
    const masthead = document.querySelector('#masthead-container');
    if (masthead) {
      const cs = getComputedStyle(masthead);
      if (cs.display === 'none' || cs.visibility === 'hidden') {
        masthead.style.setProperty('display', 'block', 'important');
        masthead.style.setProperty('visibility', 'visible', 'important');
        masthead.style.removeProperty('opacity');
      }
    }
  }

  // ── Anti-Adblock Uyarısını Kapat ─────────────────────────────────────
  // YouTube bazen "Reklam engelleyicinizi kapatın" dialog'u gösterir
  function dismissAdblockWarning() {
    // Modal/dialog
    const dialogs = [
      'ytd-enforcement-message-view-model',
      'tp-yt-paper-dialog',
      '.ytd-enforcement-message-view-model',
    ];
    for (const sel of dialogs) {
      const el = select(sel);
      if (el && el.offsetParent !== null) {
        // Yorum bölümü dialog'larına dokunma (comment section uses paper-dialog too)
        if (el.closest('ytd-comments') || el.closest('#comments')) continue;
        // Dismiss/close butonunu bul
        const closeBtn = el.querySelector('button[aria-label], .yt-spec-button-shape-next, button');
        if (closeBtn) tryClick(closeBtn);
        // Direkt gizle
        el.style.setProperty('display', 'none', 'important');
      }
    }

    // "Continue watching" overlay
    const overlay = select('.yt-playability-error-supported-renderers');
    if (overlay) overlay.style.setProperty('display', 'none', 'important');

    // Backdrop/overlay karartma
    const backdrop = select('tp-yt-iron-overlay-backdrop');
    if (backdrop) backdrop.style.setProperty('display', 'none', 'important');
  }

  // ── Ana Tick ─────────────────────────────────────────────────────────
  let scheduled = false;
  function scheduleTick() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; tick(); });
  }

  function tick() {
    removeAdOverlays();
    skipVideoAd();
    handleAdPlayback();
    restoreMasthead();
    dismissAdblockWarning();
  }

  // ── Observer Yönetimi ─────────────────────────────────────────────────
  let mainObserver = null;
  let bodyObserver = null;

  function attachVideoObserver() {
    if (mainObserver) { mainObserver.disconnect(); mainObserver = null; }

    const videoContainer = select('#movie_player') || select('ytd-player') || document.body;
    if (!videoContainer) return;

    mainObserver = new MutationObserver(() => scheduleTick());
    mainObserver.observe(videoContainer, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'src']
    });

    // Video event'leri
    document.addEventListener('timeupdate', (e) => {
      if (e.target.tagName === 'VIDEO' && isAdPlaying()) scheduleTick();
    }, { capture: true, passive: true });

    document.addEventListener('play', (e) => {
      if (e.target.tagName === 'VIDEO') scheduleTick();
    }, { capture: true, passive: true });
  }

  // Body seviyesinde dialog/overlay izle (adblock uyarısı için)
  function attachBodyObserver() {
    if (bodyObserver) return;
    bodyObserver = new MutationObserver((mutations) => {
      const hasDialog = mutations.some(m =>
        Array.from(m.addedNodes).some(n =>
          n.nodeType === 1 && (
            n.tagName === 'TP-YT-PAPER-DIALOG' ||
            n.tagName === 'YTD-ENFORCEMENT-MESSAGE-VIEW-MODEL' ||
            (n.classList && n.classList.contains('ytd-enforcement-message-view-model'))
          )
        )
      );
      if (hasDialog) {
        setTimeout(() => { dismissAdblockWarning(); tick(); }, 100);
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ── SPA Navigasyon Desteği ────────────────────────────────────────────
  // YouTube React-benzeri SPA'dır. Sayfa yenilenmez, URL değişir.
  // Her navigasyonda observer'ları yeniden bağlamamız gerekir.
  function onNavigate() {
    const path = window.location.pathname;
    const isChannel = path.includes('/channel/') || path.includes('/@');
    if (isChannel) return;

    // Kısa gecikme: YouTube DOM'u oluştursun
    setTimeout(() => {
      tick();
      if (path.includes('/watch')) {
        attachVideoObserver();
      }
    }, 300);

    // Bir kez daha kontrol (geç yüklenen elementler için)
    setTimeout(() => tick(), 1500);
  }

  // YouTube'un kendi navigasyon event'i
  window.addEventListener('yt-navigate-finish', onNavigate);
  window.addEventListener('yt-page-data-updated', () => scheduleTick());

  // Fallback: popstate / hashchange
  window.addEventListener('popstate', onNavigate);

  // ── Başlat ────────────────────────────────────────────────────────────
  function start() {
    const path = window.location.pathname;
    const isChannel = path.includes('/channel/') || path.includes('/@');
    if (isChannel) return;

    // İlk tarama
    scheduleTick();

    // Body observer her zaman aktif (dialog tespiti için)
    if (document.body) {
      attachBodyObserver();
    } else {
      document.addEventListener('DOMContentLoaded', attachBodyObserver);
    }

    // Video sayfasında observer bağla
    if (path.includes('/watch')) {
      attachVideoObserver();
    }

    // Sekme görünür olduğunda tekrar tara
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleTick();
    });

    // Periyodik kontrol — SPA geçişlerinde kaçan durumlar için
    // requestAnimationFrame tabanlı, setInterval'dan daha verimli
    let lastCheck = 0;
    function periodicCheck(ts) {
      if (ts - lastCheck > 2000) { // 2 saniyede bir
        lastCheck = ts;
        if (isAdPlaying()) tick();
        dismissAdblockWarning();
      }
      requestAnimationFrame(periodicCheck);
    }
    requestAnimationFrame(periodicCheck);
  }

  try { start(); } catch(e) {}
})();

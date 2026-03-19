/**
 * Cosmetic Filter - Özel kuralları tüm sitelerde uygular
 * Storage'dan kuralları yükler ve CSS ile gizleme yapar
 */
(() => {
  const STORAGE_KEY = 'customRules';
  let appliedStyleEl = null;
  const currentDomain = window.location.hostname;

  // Kuralları yükle ve uygula
  async function applyCustomRules() {
    try {
      // customRules ve whitelist artık sync'te, stats local'de
      const [syncData, localData] = await Promise.all([
        new Promise(resolve => chrome.storage.sync.get(null, resolve)),
        chrome.storage.local.get({ [STORAGE_KEY]: [] })
      ]);

      // syncGet mantığını inline uygula
      function readSync(key, def) {
        const n = syncData[key + '_n'];
        if (n && n > 0) {
          let json = '';
          for (let i = 0; i < n; i++) json += (syncData[key + '_c' + i] || '');
          try { return JSON.parse(json); } catch { return def; }
        }
        return syncData[key] !== undefined ? syncData[key] : def;
      }

      const whitelist = readSync('whitelist', []);
      const rules = readSync('customRules', localData[STORAGE_KEY] || []);

      // Whitelist kontrolü
      const isWhitelisted = whitelist.some(domain => 
        currentDomain === domain || currentDomain.endsWith('.' + domain)
      );

      if (isWhitelisted) {
        removeAppliedRules();
        return;
      }
      
      if (rules.length === 0) return;

      // Bu domain için geçerli kuralları filtrele
      const applicableRules = rules.filter(rule => {
        if (!rule.enabled) return false;
        if (rule.allSites) return true;
        if (!rule.domain) return false;
        return currentDomain === rule.domain || currentDomain.endsWith('.' + rule.domain);
      });

      if (applicableRules.length === 0) return;

      // CSS kuralları oluştur
      const cssRules = applicableRules.map(rule => {
        return rule.selector + ' { display: none !important; visibility: hidden !important; height: 0 !important; pointer-events: none !important; }';
      });

      if (cssRules.length === 0) return;

      // Mevcut stil elementini kaldır (varsa)
      removeAppliedRules();

      // Yeni stil elementi oluştur
      appliedStyleEl = document.createElement('style');
      appliedStyleEl.id = 're-custom-rules';
      appliedStyleEl.textContent = cssRules.join('\n');
      
      // document.head henüz oluşmamış olabilir (document_start), bu yüzden documentElement'e ekle
      const target = document.head || document.documentElement;
      if (target) {
        target.appendChild(appliedStyleEl);
      } else {
        // Çok uç bir durumda henüz hiçbiri yoksa
        const observer = new MutationObserver(() => {
          const t = document.head || document.documentElement;
          if (t) {
            t.appendChild(appliedStyleEl);
            observer.disconnect();
          }
        });
        observer.observe(document, { childList: true, subtree: true });
      }

      // İstatistik güncelle
      updateStats(applicableRules.length);
    } catch(e) {
      console.error('Apply rules error:', e);
    }
  }

  function removeAppliedRules() {
    if (appliedStyleEl && appliedStyleEl.parentNode) {
      appliedStyleEl.parentNode.removeChild(appliedStyleEl);
      appliedStyleEl = null;
    }
    const existing = document.getElementById('re-custom-rules');
    if (existing) existing.remove();
  }

  // ── Cloud Cosmetic (##) Kuralları ────────────────────────────────────────
  let cloudStyleEl = null;

  async function applyCloudCosmeticRules() {
    try {
      const [syncData, localData] = await Promise.all([
        new Promise(resolve => chrome.storage.sync.get(null, resolve)),
        chrome.storage.local.get({ cosmeticRules: [] })
      ]);

      function readSync(key, def) {
        const n = syncData[key + '_n'];
        if (n && n > 0) {
          let json = '';
          for (let i = 0; i < n; i++) json += (syncData[key + '_c' + i] || '');
          try { return JSON.parse(json); } catch { return def; }
        }
        return syncData[key] !== undefined ? syncData[key] : def;
      }

      const whitelist = readSync('whitelist', []);
      const isWhitelisted = whitelist.some(d => currentDomain === d || currentDomain.endsWith('.' + d));
      if (isWhitelisted) return;

      const allRules = localData.cosmeticRules || [];
      if (allRules.length === 0) return;

      // Sadece bu domain'e uyan kuralları filtrele (generic + domain-specific)
      const selectors = new Set();
      for (const rule of allRules) {
        if (!rule.domain) {
          // Generic kural — her yerde geçerli
          selectors.add(rule.selector);
        } else {
          // Domain eşleşmesi
          if (currentDomain === rule.domain || currentDomain.endsWith('.' + rule.domain)) {
            selectors.add(rule.selector);
          }
        }
      }

      if (selectors.size === 0) return;

      // Eski cloud style'ı kaldır
      if (cloudStyleEl && cloudStyleEl.parentNode) cloudStyleEl.parentNode.removeChild(cloudStyleEl);
      const old = document.getElementById('re-cloud-cosmetic');
      if (old) old.remove();

      // Yeni style inject et
      cloudStyleEl = document.createElement('style');
      cloudStyleEl.id = 're-cloud-cosmetic';
      // Batch selectors into one rule for performance
      cloudStyleEl.textContent = [...selectors].join(',\n') + ' { display: none !important; visibility: hidden !important; }';

      const target = document.head || document.documentElement;
      if (target) {
        target.appendChild(cloudStyleEl);
      }
    } catch(e) {}
  }
  // ────────────────────────────────────────────────────────────────────────

  // İstatistik güncelle
  async function updateStats(count) {
    try {
      const data = await chrome.storage.local.get({ stats: {} });
      const stats = data.stats || {};
      const today = new Date().toISOString().split('T')[0];
      
      if (!stats.daily) stats.daily = {};
      if (!stats.daily[today]) stats.daily[today] = 0;
      stats.daily[today] += count;
      
      if (!stats.total) stats.total = 0;
      stats.total += count;
      
      if (!stats.byDomain) stats.byDomain = {};
      if (!stats.byDomain[currentDomain]) stats.byDomain[currentDomain] = 0;
      stats.byDomain[currentDomain] += count;

      await chrome.storage.local.set({ stats });
    } catch(e) {}
  }

  // Storage değişikliklerini dinle (yeni kural eklendiğinde güncelle)
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if ('cosmeticRules' in changes) applyCloudCosmeticRules();
    }
    if (area === 'sync') {
      if ('customRules' in changes || 'customRules_n' in changes || 'whitelist' in changes || 'whitelist_n' in changes) {
        applyCustomRules();
      }
      if ('cosmeticRules' in changes) applyCloudCosmeticRules();
    }
  });

  // Background'dan mesajları dinle
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'REFRESH_RULES') {
      applyCustomRules();
      sendResponse({ success: true });
    }
    return true;
  });

  // 1. ADIM: Kuralları anında uygula (DOMContentLoaded bekleme)
  applyCustomRules();
  applyCloudCosmeticRules();

  // MutationObserver ile yeni eklenen içerikleri de kontrol et
  let refreshTimeout = null;

  // Adblock detection bait elementlerini tanımla — bunlara dokunma
  const BAIT_SELECTORS = [
    '#ads', '#ad', '.ad', '.ads', '.adsbox', '.ad-banner', '.ad-unit',
    '#adBanner', '#adContainer', '#adWrapper', '#adFrame',
    '.advertisement', '#advertisement',
    '[id*="google_ads"]', '[id*="doubleclick"]',
    '.adsbygoogle', '#adsbygoogle',
    // tmailor.com bait containers
    '.athmd3l1', '[data-id="atc7ek8p"]', '[data-id="ato5fw2b"]', '[data-id="atry9gf5"]'
  ];

  function isBaitElement(el) {
    return BAIT_SELECTORS.some(sel => {
      try { return el.matches(sel); } catch(e) { return false; }
    });
  }

  // ── Site-Specific Anti-Adblock Bypass ───────────────────────────────────
  // Bazı siteler reklam container'larının yüklenip yüklenmediğini kontrol ederek
  // adblock tespiti yapar ve bir overlay gösterir. Bu overlay'leri gizliyoruz.
  const ANTI_ADBLOCK_OVERLAYS = {
    'tmailor.com': {
      // Adblock uyarı overlay'i — gizle
      hide: ['#atzel9hv'],
      // Bait container'lar — DOKUNMA (bunları gizlersek tespit tetiklenir)
      ignore: ['.athmd3l1', '[data-id="atc7ek8p"]', '[data-id="ato5fw2b"]', '[data-id="atry9gf5"]']
    }
  };

  function applySiteSpecificBypass() {
    const host = window.location.hostname.replace('www.', '');
    const rules = ANTI_ADBLOCK_OVERLAYS[host];
    if (!rules) return;

    // Overlay'leri gizle
    rules.hide.forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach(el => {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
        });
      } catch(e) {}
    });
  }

  // DOM hazır olduğunda ve yeni node eklendiğinde çalıştır (attribute değil!)
  applySiteSpecificBypass();

  const siteBypassObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        applySiteSpecificBypass();
        break;
      }
    }
  });
  siteBypassObserver.observe(document.documentElement, { childList: true, subtree: true });
  // ────────────────────────────────────────────────────────────────────────

  // ── Agresif Reklam Temizleyici (Yayın Siteleri) ──
  function aggressiveClean() {
    // 1. data-advertisement-link elementlerini kaldır
    document.querySelectorAll('[data-advertisement-link]').forEach(el => {
      if (isBaitElement(el)) return;
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('height', '0', 'important');
      el.style.setProperty('overflow', 'hidden', 'important');
    });

    // 2. data-free-banner elementlerini kaldır
    document.querySelectorAll('[data-free-banner]').forEach(el => {
      if (isBaitElement(el)) return;
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
    });

    // 3. Tam ekran overlay div'leri (class/id'siz, pozisyon fixed, z-index yüksek)
    document.querySelectorAll('body > div[style]').forEach(el => {
      const style = el.getAttribute('style') || '';
      const hasFixed = style.includes('position: fixed') || style.includes('position:fixed');
      const hasZIndex = style.includes('z-index');
      const hasNoClass = !el.className || el.className.trim() === '';
      const hasNoId = !el.id || el.id.trim() === '';
      
      if (hasFixed && hasZIndex && hasNoClass && hasNoId) {
        // İçerisinde link var mı kontrol et
        const links = el.querySelectorAll('a[target="_blank"], a[href*="bit.ly"], a[href*="shortbal"], a[href*="rebrand"], a[href*="cutt.ly"]');
        if (links.length > 0) {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
        }
      }
    });

    // 4. Bahis/casino affiliate linkleri
    const adLinkPatterns = [
      'shortbal.online', 'rebrand.ly', 'bit.ly', 'cutt.ly', 'strmrdrfrm', 'slcksprtsbot',
      'bahis', 'casino', 'bet365', 'bets10', 'tipobet', 'betboo', '1xbet',
      'kralbet', 'matbet', 'mobilbahis', 'superbetin', 'eurocasinoaffiliate',
      'partner.', 'wonodds', 'betexper', 'mariobet'
    ];
    
    document.querySelectorAll('a[href][target="_blank"]').forEach(link => {
      const href = (link.getAttribute('href') || '').toLowerCase();
      if (adLinkPatterns.some(p => href.includes(p))) {
        link.style.setProperty('display', 'none', 'important');
        link.style.setProperty('pointer-events', 'none', 'important');
        // Parent div'i de gizle
        const parent = link.parentElement;
        if (parent && parent !== document.body) {
          parent.style.setProperty('display', 'none', 'important');
        }
      }
    });

    // 5. Bilinen reklam ID/class'ları ve Haber Siteleri Özel Kombinasyonları
    [
      '#ssbet', '#footersabit', '.arkaplan', '.reklam', 'tolbet', 
      '.clappr-watermark[data-watermark]', 'div[data-poster]:has(a)',
      '.new3slide:has(.rekkklam[data-adv-id])',  // Haber siteleri içi advertorial şablonları
      '.new3slide:has(a[class*="rekkklam"])'     // Alternatif class eşleşmesi
    ].forEach(sel => {
      try {
        document.querySelectorAll(sel).forEach(el => {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
        });
      } catch(e) {}
    });

    // 6. Click hijacking koruması - sayfada gizli tıklama katmanlarını kaldır
    document.querySelectorAll('div[style*="pointer-events: auto"][style*="position: fixed"]').forEach(el => {
      if (!el.className && !el.id) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
      }
    });
  }

  const observer = new MutationObserver((mutations) => {
    if (refreshTimeout) clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(() => {
      aggressiveClean();
    }, 100); // Gecikmeyi 300ms'den 100ms'ye indirdik
  });

  function startObserver() {
    const target = document.documentElement; // body oluşmamış olabilir, documentElement daha güvenli
    observer.observe(target, {
      childList: true,
      subtree: true
    });
    // İlk taramayı anında yap
    aggressiveClean();
  }

  // 2. ADIM: Observer'ı anında başlat (DOMContentLoaded bekleme)
  if (document.documentElement) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
  }
})();


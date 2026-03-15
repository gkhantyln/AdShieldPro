/**
 * Cosmetic Filter - Özel kuralları tüm sitelerde uygular
 * Storage'dan kuralları yükler ve CSS ile gizleme yapar
 */
(() => {
  const STORAGE_KEY = 'customRules';
  const STORAGE_WHITELIST = 'whitelist';
  let appliedStyleEl = null;
  const currentDomain = window.location.hostname;

  // Whitelist kontrolü
  async function isWhitelisted() {
    try {
      const data = await chrome.storage.local.get({ [STORAGE_WHITELIST]: [] });
      const whitelist = data[STORAGE_WHITELIST] || [];
      return whitelist.some(domain => currentDomain === domain || currentDomain.endsWith('.' + domain));
    } catch(e) {
      return false;
    }
  }

  // Kuralları yükle ve uygula
  async function applyCustomRules() {
    // Whitelist kontrolü
    if (await isWhitelisted()) {
      removeAppliedRules();
      return;
    }

    try {
      const data = await chrome.storage.local.get({ [STORAGE_KEY]: [] });
      const rules = data[STORAGE_KEY] || [];
      
      if (rules.length === 0) return;

      // Bu domain için geçerli kuralları filtrele
      const applicableRules = rules.filter(rule => {
        if (rule.allSites) return true;
        if (!rule.domain) return false;
        return currentDomain === rule.domain || currentDomain.endsWith('.' + rule.domain);
      });

      if (applicableRules.length === 0) return;

      // CSS kuralları oluştur
      const cssRules = applicableRules.map(rule => {
        try {
          // Selector'ün geçerli olduğunu test et
          document.querySelector(rule.selector);
          return rule.selector + ' { display: none !important; visibility: hidden !important; }';
        } catch(e) {
          return null;
        }
      }).filter(Boolean);

      if (cssRules.length === 0) return;

      // Mevcut stil elementini kaldır
      removeAppliedRules();

      // Yeni stil elementi oluştur
      appliedStyleEl = document.createElement('style');
      appliedStyleEl.id = 're-custom-rules';
      appliedStyleEl.textContent = cssRules.join('\n');
      (document.head || document.documentElement).appendChild(appliedStyleEl);

      // İstatistik güncelle
      updateStats(applicableRules.length);
    } catch(e) {
      // Sessizce devam et
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
    if (area !== 'local') return;
    if (STORAGE_KEY in changes || STORAGE_WHITELIST in changes) {
      applyCustomRules();
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

  // Başlangıçta kuralları uygula
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCustomRules);
  } else {
    applyCustomRules();
  }

  // MutationObserver ile yeni eklenen içerikleri de kontrol et
  let refreshTimeout = null;

  // ── Agresif Reklam Temizleyici (Yayın Siteleri) ──
  function aggressiveClean() {
    // 1. data-advertisement-link elementlerini kaldır
    document.querySelectorAll('[data-advertisement-link]').forEach(el => {
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('height', '0', 'important');
      el.style.setProperty('overflow', 'hidden', 'important');
    });

    // 2. data-free-banner elementlerini kaldır
    document.querySelectorAll('[data-free-banner]').forEach(el => {
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
      // applyCustomRules() çağrısını kaldırdık çünkü CSS bir kere eklendiğinde kalıcıdır.
      // Sadece JS tabanlı temizlik (aggressiveClean) sürekli çalışmalı.
      aggressiveClean();
    }, 300);
  });

  function startObserver() {
    const target = document.body || document.documentElement;
    observer.observe(target, {
      childList: true,
      subtree: true
    });
    // İlk taramayı yap
    aggressiveClean();
  }

  if (document.body) {
    startObserver();
  } else {
    document.addEventListener('DOMContentLoaded', startObserver);
  }
})();


/**
 * Element Picker - Sayfadaki reklamları mouse ile seçme
 * Background'dan ACTIVATE_PICKER mesajı aldığında aktifleşir
 */
(() => {
  // Çoklu yüklemeyi engelle
  if (window.__rePickerLoaded) return;
  window.__rePickerLoaded = true;

  let isActive = false;
  let highlightEl = null;
  let tooltipEl = null;
  let actionBarEl = null;
  let selectedElement = null;
  let selectedSelector = '';
  let hoveredElement = null;

  // Inline stiller kullan (CSS dosyasına bağımlılığı kaldır)
  function createHighlight() {
    if (highlightEl) return;
    highlightEl = document.createElement('div');
    highlightEl.id = 're-picker-highlight';
    highlightEl.style.cssText = `
      position: fixed !important;
      border: 2px dashed #ef4444 !important;
      background: rgba(239, 68, 68, 0.12) !important;
      pointer-events: none !important;
      z-index: 2147483646 !important;
      transition: all 0.08s ease-out !important;
      box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.25) !important;
      border-radius: 4px !important;
      display: none !important;
    `;
    document.documentElement.appendChild(highlightEl);
  }

  function createTooltip() {
    if (tooltipEl) return;
    tooltipEl = document.createElement('div');
    tooltipEl.id = 're-picker-tooltip';
    tooltipEl.style.cssText = `
      position: fixed !important;
      z-index: 2147483647 !important;
      background: #1e293b !important;
      color: #f1f5f9 !important;
      font-family: 'Segoe UI', sans-serif !important;
      font-size: 12px !important;
      padding: 6px 12px !important;
      border-radius: 8px !important;
      border: 1px solid #334155 !important;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important;
      pointer-events: none !important;
      max-width: 400px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      display: none !important;
    `;
    document.documentElement.appendChild(tooltipEl);
  }

  function createActionBar() {
    if (actionBarEl) return;
    actionBarEl = document.createElement('div');
    actionBarEl.id = 're-picker-actionbar';
    actionBarEl.style.cssText = `
      position: fixed !important;
      bottom: 24px !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      z-index: 2147483647 !important;
      display: none !important;
      gap: 10px !important;
      background: #0f172a !important;
      padding: 12px 20px !important;
      border-radius: 16px !important;
      border: 1px solid #334155 !important;
      box-shadow: 0 12px 40px rgba(0,0,0,0.5) !important;
      font-family: 'Segoe UI', sans-serif !important;
      align-items: center !important;
    `;

    const selectorInfo = document.createElement('span');
    selectorInfo.id = 're-picker-selector-text';
    selectorInfo.style.cssText = `
      color: #94a3b8 !important;
      font-size: 11px !important;
      margin-right: 8px !important;
      max-width: 200px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    `;

    const confirmBtn = document.createElement('button');
    confirmBtn.id = 're-picker-btn-confirm';
    confirmBtn.textContent = '🚫 Engelle';
    confirmBtn.style.cssText = `
      border: none !important;
      padding: 8px 20px !important;
      border-radius: 10px !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      background: linear-gradient(135deg, #ef4444, #dc2626) !important;
      color: white !important;
    `;
    confirmBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      confirmSelection();
    }, true);

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 're-picker-btn-cancel';
    cancelBtn.textContent = '✕ İptal';
    cancelBtn.style.cssText = `
      border: 1px solid #334155 !important;
      padding: 8px 20px !important;
      border-radius: 10px !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      background: #1e293b !important;
      color: #94a3b8 !important;
    `;
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      cancelPicker();
    }, true);

    actionBarEl.appendChild(selectorInfo);
    actionBarEl.appendChild(confirmBtn);
    actionBarEl.appendChild(cancelBtn);
    document.documentElement.appendChild(actionBarEl);
  }

  // Dinamik ID kontrolü
  function isDynamicId(id) {
    if (!id) return true;
    // Çok uzun, sayı ağırlıklı veya rastgele görünen ID'leri filtrele
    if (id.length > 50) return true;
    if (/\d{3,}/.test(id)) return true; // 3+ ardışık rakam
    if (/ad|banner|sponsor|reklam/i.test(id) && /\d/.test(id)) return true; // reklam kelimesi + sayı
    if (/[a-f0-9]{8,}/.test(id)) return true; // hash benzeri
    return false;
  }

  // Dinamik Class kontrolü
  function isDynamicClass(cls) {
    if (!cls) return true;
    if (cls.length < 3) return true; // Çok kısa classlar riskli olabilir (örn: 'a', 'b')
    if (cls.length > 50) return true; // Çok uzun classlar
    // Rastgele görünen hash benzeri classlar (örn: rc386cf, css-1a2b3c)
    if (/[a-z0-9]{6,}/i.test(cls) && /\d/.test(cls) && /[a-z]/i.test(cls)) return true; 
    // Framework generated (css-xyz, sc-xyz)
    if (/^(css|sc|styled)-/.test(cls)) return true;
    return false;
  }

  // Elementin benzersiz CSS selector'ünü oluştur
  function generateSelector(el) {
    if (!el || el === document.body || el === document.documentElement) return '';
    
    // ID varsa ve güvenilirse kullan
    if (el.id && /^[a-zA-Z]/.test(el.id) && !el.id.includes(':') && !el.id.startsWith('re-picker') && !isDynamicId(el.id)) {
      return '#' + CSS.escape(el.id);
    }

    const tag = el.tagName.toLowerCase();
    const classes = Array.from(el.classList || [])
      .filter(c => !c.startsWith('re-picker') && /^[a-zA-Z_-]/.test(c) && !isDynamicClass(c));

    if (classes.length > 0) {
      const classSelector = tag + '.' + classes.map(c => CSS.escape(c)).join('.');
      try {
        const matches = document.querySelectorAll(classSelector);
        if (matches.length <= 5) return classSelector;
      } catch(e) {}
    }

    // nth-child ile parent'tan yürü
    const parent = el.parentElement;
    if (parent && parent !== document.documentElement) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(el) + 1;
      const parentSelector = generateSelector(parent);
      if (parentSelector) {
        return parentSelector + ' > ' + tag + ':nth-child(' + index + ')';
      }
    }

    return tag;
  }

  function buildSmartSelector(el) {
    if (!el) return '';
    
    // ID bazlı (güvenilir ise)
    if (el.id && /^[a-zA-Z]/.test(el.id) && !el.id.startsWith('re-picker') && !isDynamicId(el.id)) {
      return '#' + CSS.escape(el.id);
    }
    
    // class bazlı
    const classes = Array.from(el.classList || [])
      .filter(c => !c.startsWith('re-picker') && /^[a-zA-Z_-]/.test(c) && !isDynamicClass(c));
    
    if (classes.length > 0) {
      const tag = el.tagName.toLowerCase();
      // Tüm class kombinasyonlarını dene
      for (let i = Math.min(classes.length, 3); i >= 1; i--) {
        const combo = classes.slice(0, i);
        const sel = tag + '.' + combo.map(c => CSS.escape(c)).join('.');
        try {
          const matches = document.querySelectorAll(sel);
          if (matches.length <= 10) return sel; // Makul sayıda eşleşme varsa kullan
        } catch(e) {}
      }
    }
    
    // ID veya Class yetmediyse hiyerarşik yapı kullan
    return generateSelector(el);
  }

  // Element'in picker UI parçası olup olmadığını kontrol et
  function isPickerElement(el) {
    if (!el) return true;
    if (el === document.body || el === document.documentElement) return true;
    const id = el.id || '';
    if (id.startsWith('re-picker')) return true;
    try {
      if (el.closest && el.closest('[id^="re-picker"]')) return true;
    } catch(e) {}
    return false;
  }

  function showHighlight(rect) {
    if (!highlightEl) return;
    highlightEl.style.setProperty('display', 'block', 'important');
    highlightEl.style.setProperty('left', rect.left + 'px', 'important');
    highlightEl.style.setProperty('top', rect.top + 'px', 'important');
    highlightEl.style.setProperty('width', rect.width + 'px', 'important');
    highlightEl.style.setProperty('height', rect.height + 'px', 'important');
  }

  function hideHighlight() {
    if (highlightEl) highlightEl.style.setProperty('display', 'none', 'important');
  }

  function showTooltip(x, y, text) {
    if (!tooltipEl) return;
    tooltipEl.textContent = text;
    tooltipEl.style.setProperty('display', 'block', 'important');
    const tooltipWidth = tooltipEl.offsetWidth || 200;
    let posX = x + 14;
    let posY = y - 32;
    if (posX + tooltipWidth > window.innerWidth - 10) posX = x - tooltipWidth - 14;
    if (posY < 10) posY = y + 22;
    tooltipEl.style.setProperty('left', posX + 'px', 'important');
    tooltipEl.style.setProperty('top', posY + 'px', 'important');
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.style.setProperty('display', 'none', 'important');
  }

  // ── Mouse Olayları (capture phase'de, overlay olmadan) ──
  function onMouseMove(e) {
    if (!isActive) return;

    const target = document.elementFromPoint(e.clientX, e.clientY);

    if (!target || isPickerElement(target)) {
      hideHighlight();
      hideTooltip();
      hoveredElement = null;
      return;
    }

    hoveredElement = target;
    const rect = target.getBoundingClientRect();
    showHighlight(rect);

    const selector = buildSmartSelector(target);
    showTooltip(e.clientX, e.clientY, selector || target.tagName.toLowerCase());
  }

  function onMouseDown(e) {
    if (!isActive) return;

    // Action bar butonlarına müdahale etme
    const target = e.target;
    if (target && target.id && target.id.startsWith('re-picker-btn')) return;
    if (target && target.closest && target.closest('[id^="re-picker-actionbar"]')) return;

    // Sayfanın normal tıklama davranışını engelle
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function onMouseClick(e) {
    if (!isActive) return;

    // Action bar butonlarına müdahale etme
    const target = e.target;
    if (target && target.id && target.id.startsWith('re-picker-btn')) return;
    if (target && target.closest && target.closest('[id^="re-picker-actionbar"]')) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // Seçilen element = hover edilen element
    const pointTarget = document.elementFromPoint(e.clientX, e.clientY);
    
    if (!pointTarget || isPickerElement(pointTarget)) return;

    selectedElement = pointTarget;
    selectedSelector = buildSmartSelector(pointTarget);

    // Highlight'ı seçilmiş durumda tut
    const rect = pointTarget.getBoundingClientRect();
    showHighlight(rect);
    hideTooltip();

    // Action bar'ı göster
    const selectorText = document.getElementById('re-picker-selector-text');
    if (selectorText) selectorText.textContent = selectedSelector;
    if (actionBarEl) actionBarEl.style.setProperty('display', 'flex', 'important');
  }

  function onKeyDown(e) {
    if (!isActive) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelPicker();
    }
  }

  function confirmSelection() {
    if (!selectedSelector) return;
    
    const domain = window.location.hostname;
    
    // Background'a kuralı gönder
    try {
      chrome.runtime.sendMessage({
        type: 'ADD_CUSTOM_RULE',
        rule: {
          selector: selectedSelector,
          domain: domain,
          allSites: false,
          createdAt: Date.now(),
          source: 'picker'
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          // Mesaj gönderilemedi
          showNotification('Kural kaydedilemedi ✗');
          return;
        }
        if (response && response.success) {
          // Seçilen elementi hemen gizle
          try {
            const elements = document.querySelectorAll(selectedSelector);
            elements.forEach(el => {
              el.style.setProperty('display', 'none', 'important');
              el.style.setProperty('visibility', 'hidden', 'important');
            });
          } catch(e) {}
          showNotification('Kural eklendi ve uygulandı! ✓');
        }
      });
    } catch(e) {
      showNotification('Hata oluştu ✗');
    }

    cleanupPicker();
  }

  function cancelPicker() {
    cleanupPicker();
  }

  function cleanupPicker() {
    isActive = false;
    
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('click', onMouseClick, true);
    document.removeEventListener('keydown', onKeyDown, true);

    // Cursor'ı normal hale getir
    document.documentElement.style.removeProperty('cursor');

    // Sadece UI elementlerini temizle (seçilmiş elementi SİLME)
    [highlightEl, tooltipEl, actionBarEl].forEach(el => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });

    highlightEl = tooltipEl = actionBarEl = null;
    selectedElement = null;
    selectedSelector = '';
    hoveredElement = null;
  }

  function showNotification(msg) {
    const notif = document.createElement('div');
    const isError = msg.includes('✗');
    notif.style.cssText = `
      position: fixed !important;
      top: 24px !important;
      right: 24px !important;
      z-index: 2147483647 !important;
      background: ${isError ? 'linear-gradient(135deg, #dc2626, #ef4444)' : 'linear-gradient(135deg, #059669, #10b981)'} !important;
      color: white !important;
      padding: 12px 24px !important;
      border-radius: 12px !important;
      font-family: 'Segoe UI', sans-serif !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      box-shadow: 0 8px 32px ${isError ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'} !important;
      pointer-events: none !important;
    `;
    notif.textContent = msg;
    document.documentElement.appendChild(notif);
    setTimeout(() => {
      notif.style.opacity = '0';
      notif.style.transition = 'opacity 0.3s ease';
      setTimeout(() => { if (notif.parentNode) notif.parentNode.removeChild(notif); }, 300);
    }, 2500);
  }

  function activatePicker() {
    if (isActive) {
      cleanupPicker();
      return;
    }
    isActive = true;

    // UI elementlerini oluştur
    createHighlight();
    createTooltip();
    createActionBar();

    // Cursor'ı crosshair yap
    document.documentElement.style.setProperty('cursor', 'crosshair', 'important');

    // Olayları dinle (capture phase ile tüm elementlerin önüne geç)
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('click', onMouseClick, true);
    document.addEventListener('keydown', onKeyDown, true);

    showNotification('Element seçici aktif 🎯 — Engellemek istediğiniz alana tıklayın');
  }

  // Background'dan mesajları dinle
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'ACTIVATE_PICKER') {
      activatePicker();
      sendResponse({ success: true });
      return true;
    }
    if (msg.type === 'DEACTIVATE_PICKER') {
      cleanupPicker();
      sendResponse({ success: true });
      return true;
    }
  });
})();

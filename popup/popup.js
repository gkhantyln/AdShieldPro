/**
 * AdShield Pro v2.0 — Popup Controller
 */
document.addEventListener('DOMContentLoaded', async () => {
  // ── DOM Elements ─────────────────────────
  const mainToggle = document.querySelector('#mainToggle input');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const statusCard = document.getElementById('statusCard');
  const currentSiteEl = document.getElementById('currentSite');
  const statusMessage = document.getElementById('statusMessage');

  // Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // Home tab
  const btnPicker = document.getElementById('btnPicker');
  const btnWhitelistSite = document.getElementById('btnWhitelistSite');
  const whitelistBtnText = document.getElementById('whitelistBtnText');
  const btnPause = document.getElementById('btnPause');
  const pauseBtnText = document.getElementById('pauseBtnText');
  const totalBlockedCount = document.getElementById('totalBlockedCount');
  const ytStatus = document.getElementById('ytStatus');
  const allSitesStatus = document.getElementById('allSitesStatus');
  const ytBox = document.getElementById('ytBox');
  const allSitesBox = document.getElementById('allSitesBox');
  const heuristicBadge = document.getElementById('heuristicBadge');

  // Rules tab
  const inputSelector = document.getElementById('inputSelector');
  const inputDomain = document.getElementById('inputDomain');
  const checkAllSites = document.getElementById('checkAllSites');
  const btnAddRule = document.getElementById('btnAddRule');
  const rulesList = document.getElementById('rulesList');
  const ruleCount = document.getElementById('ruleCount');
  const emptyRules = document.getElementById('emptyRules');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');
  const fileImport = document.getElementById('fileImport');

  // Stats tab
  const statsTotalBlocked = document.getElementById('statsTotalBlocked');
  const statsTodayBlocked = document.getElementById('statsTodayBlocked');
  const domainStatsList = document.getElementById('domainStatsList');
  const btnResetStats = document.getElementById('btnResetStats');

  // Settings tab
  const inputWhitelist = document.getElementById('inputWhitelist');
  const btnAddWhitelist = document.getElementById('btnAddWhitelist');
  const whitelistItems = document.getElementById('whitelistItems');
  const emptyWhitelist = document.getElementById('emptyWhitelist');
  const pauseBtns = document.querySelectorAll('.pause-btn[data-minutes]');
  const btnResumeNow = document.getElementById('btnResumeNow');
  const pauseStatus = document.getElementById('pauseStatus');
  const pauseStatusText = document.getElementById('pauseStatusText');

  // ── State ────────────────────────────────
  let currentState = {};
  let activeTabHostname = '';

  // ── i18n Localization ───────────────────
  async function localizeUI(forceLang = 'auto') {
    let messages = null;
    if (forceLang !== 'auto') {
        try {
            const url = chrome.runtime.getURL(`_locales/${forceLang}/messages.json`);
            const res = await fetch(url);
            messages = await res.json();
        } catch(e) { console.error('Lang fetch error:', e); }
    }

    const getMsg = (key) => {
        if (messages && messages[key]) return messages[key].message;
        return chrome.i18n.getMessage(key);
    };

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const message = getMsg(key);
      if (message) {
        if (el.children.length === 0) {
            el.textContent = message;
        } else {
            for (let node of el.childNodes) {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                    node.textContent = message;
                    break;
                }
            }
        }
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const message = getMsg(key);
      if (message) el.placeholder = message;
    });
  }

  // ── Send message to background ───────────
  function sendMsg(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (response) => {
        resolve(response || { success: false });
      });
    });
  }

  // ── Load State ───────────────────────────
  async function loadState() {
    const res = await sendMsg({ type: 'GET_STATE' });
    if (res.success) currentState = res;

    // Filter lists
    const flRes = await sendMsg({ type: 'GET_FILTER_LISTS' });
    if (flRes.success) {
      currentState.filterLists = flRes.lists;
      currentState.customFilterLists = flRes.custom;
    }

    // Dil senkronizasyonu
    const lang = currentState.preferredLanguage || 'auto';
    await localizeUI(lang); 

    // Aktif sekme bilgisi
    const tabInfo = await sendMsg({ type: 'GET_ACTIVE_TAB_INFO' });
    if (tabInfo.success) {
      activeTabHostname = tabInfo.hostname || '';
    }

    // Bu sayfada engellenen sayısını çek
    await loadPageBlockedCount();

    updateUI();
  }

  // ── Per-Page Blocked Count ───────────────
  async function loadPageBlockedCount() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id || !activeTabHostname) return;

      const data = await chrome.storage.local.get({ stats: {} });
      const byDomain = (data.stats && data.stats.byDomain) || {};
      const count = byDomain[activeTabHostname] || 0;

      const el = document.getElementById('pageBlockedCount');
      if (el) el.textContent = count.toLocaleString();
    } catch(e) {}
  }

  // ── Update UI ────────────────────────────
  function updateUI() {
    const { enabled, paused, customRules = [], whitelist = [], stats = {}, pauseUntil = 0 } = currentState;

    // Toggle
    mainToggle.checked = enabled;

    // Status
    const isActive = enabled && !paused;
    statusDot.classList.toggle('off', !isActive);
    statusText.classList.toggle('off', !isActive);
    statusCard.classList.toggle('disabled', !isActive);
 
    if (!enabled) {
      statusText.textContent = chrome.i18n.getMessage('statusDisabled') || 'Devre Dışı';
    } else if (paused) {
      statusText.textContent = chrome.i18n.getMessage('statusPaused') || 'Duraklatıldı';
    } else {
      statusText.textContent = chrome.i18n.getMessage('statusActive') || 'Aktif & Koruyor';
    }

    // YouTube and All Sites Home Status
    const protectedText = chrome.i18n.getMessage('protected') || 'Korunuyor';
    const unprotectedText = chrome.i18n.getMessage('unprotected') || 'Korunmuyor';
    
    if (ytStatus) {
      ytStatus.textContent = isActive
        ? (chrome.i18n.getMessage('ytUltraProtected') || 'Ultra Güçlü Koruma')
        : unprotectedText;
      ytStatus.classList.toggle('text-green', isActive);
      ytStatus.classList.toggle('text-red', !isActive);
    }
    if (ytBox) {
      ytBox.classList.toggle('glow-green', isActive);
      ytBox.style.opacity = isActive ? '1' : '0.6';
    }
    
    if (allSitesStatus) {
      allSitesStatus.textContent = isActive ? protectedText : unprotectedText;
      allSitesStatus.classList.toggle('text-blue', isActive);
      allSitesStatus.classList.toggle('text-red', !isActive);
    }
    if (allSitesBox) {
      allSitesBox.classList.toggle('glow-blue', isActive);
      allSitesBox.style.opacity = isActive ? '1' : '0.6';
    }

    if (heuristicBadge) {
      heuristicBadge.style.display = isActive ? 'flex' : 'none';
    }

    // Per-page blocked panel
    const pageBlockedPanel = document.getElementById('pageBlockedPanel');
    if (pageBlockedPanel) {
      pageBlockedPanel.style.display = (isActive && activeTabHostname) ? 'flex' : 'none';
    }

    if (btnPicker) {
      btnPicker.disabled = !isActive;
      btnPicker.style.opacity = isActive ? '1' : '0.5';
      btnPicker.style.cursor = isActive ? 'pointer' : 'not-allowed';
    }
 
    // Cloud Version & Language Select
    const selectLanguage = document.getElementById('selectLanguage');
    if (selectLanguage) selectLanguage.value = currentState.preferredLanguage || 'auto';

    const cloudVerText = document.getElementById('cloudUpdateText');
    if (cloudVerText && currentState.cloudVersion) {
        cloudVerText.textContent = 'Son güncelleme: ' + currentState.cloudVersion;
    }

    // Current site
    if (activeTabHostname) {
      currentSiteEl.textContent = activeTabHostname;
      currentSiteEl.style.display = 'block';
 
      if (!inputDomain.value) {
        inputDomain.value = activeTabHostname;
      }
    } else {
      currentSiteEl.style.display = 'none';
    }
 
    // Whitelist button state
    const isWhitelisted = whitelist.includes(activeTabHostname);
    btnWhitelistSite.classList.toggle('active-wl', isWhitelisted);
    whitelistBtnText.textContent = isWhitelisted ? (chrome.i18n.getMessage('removeWhitelist') || 'Muafiyeti Kaldır') : (chrome.i18n.getMessage('whitelistSite') || 'Siteyi Muaf Tut');
 
    // Pause button
    if (paused) {
      const remaining = Math.max(0, Math.ceil((pauseUntil - Date.now()) / 60000));
      pauseBtnText.textContent = remaining + 'dk ' + (chrome.i18n.getMessage('remaining') || 'kaldı');
      btnPause.classList.add('active-wl');
    } else {
      pauseBtnText.textContent = chrome.i18n.getMessage('pause30') || '30dk Duraklat';
      btnPause.classList.remove('active-wl');
    }

    // Gamification & Total Blocked
    const totalCount = stats.total || 0;
    totalBlockedCount.textContent = formatNumber(totalCount);
    
    // Endüstri standartı reklam ağırlıkları
    // 1 reklam/tracker yükü ortalama 0.5 MB
    // 1 reklam/tracker işlem yükü ortalama 0.4 saniye
    const savedDataMB = totalCount * 0.5;
    const savedTimeSec = totalCount * 0.4;

    // Time Format
    let timeStr = '0 sn';
    if (savedTimeSec >= 86400) {
        timeStr = (savedTimeSec / 86400).toFixed(1) + ' gün';
    } else if (savedTimeSec >= 3600) {
        timeStr = (savedTimeSec / 3600).toFixed(1) + ' saat';
    } else if (savedTimeSec >= 60) {
        timeStr = (savedTimeSec / 60).toFixed(1) + ' dk';
    } else {
        timeStr = Math.floor(savedTimeSec) + ' sn';
    }
    
    // Data Format
    let dataStr = '0 MB';
    if (savedDataMB >= 1024) {
        dataStr = (savedDataMB / 1024).toFixed(2) + ' GB';
    } else {
        dataStr = savedDataMB.toFixed(1) + ' MB';
    }
    
    const timeEl = document.getElementById('savedTimeValue');
    const dataEl = document.getElementById('savedDataValue');
    if (timeEl) timeEl.textContent = timeStr;
    if (dataEl) dataEl.textContent = dataStr;

    // Rules
    renderRules(customRules);

    // Stats
    renderStats(stats);

    // Whitelist
    renderWhitelist(whitelist);

    // Pause status (settings)
    if (paused && pauseUntil > Date.now()) {
      const remaining = Math.max(0, Math.ceil((pauseUntil - Date.now()) / 60000));
      pauseStatus.style.display = 'block';
      pauseStatusText.textContent = `⏸ ${remaining} dakika sonra devam edecek`;
      btnResumeNow.style.display = 'block';
    } else {
      pauseStatus.style.display = 'none';
      btnResumeNow.style.display = 'none';
    }

    // AI Settings & Home Badge & Stats
    const { aiEnabled = false, aiKeys = [], aiStats = { tokens: 0, blocked: 0 } } = currentState;
    document.getElementById('aiToggle').checked = aiEnabled;
    renderAiKeys(aiKeys);

    const aiBadge = document.getElementById('aiActiveBadge');
    const aiStatsDisplay = document.getElementById('aiStatsDisplay');
    const aiTokenCount = document.getElementById('aiTokenCount');
    const aiBlockedCount = document.getElementById('aiBlockedCount');

    if (aiEnabled && aiKeys.length > 0 && isActive) {
      if (aiBadge) aiBadge.style.display = 'flex';
      
      if (aiStatsDisplay) {
        aiStatsDisplay.style.display = 'flex';
        aiTokenCount.textContent = (aiStats.tokens || 0).toLocaleString();
        aiBlockedCount.textContent = (aiStats.blocked || 0).toLocaleString();
      }
    } else {
      if (aiBadge) aiBadge.style.display = 'none';
      if (aiStatsDisplay) aiStatsDisplay.style.display = 'none';
    }

    // Football settings
    const inputAdSkipDuration = document.getElementById('inputAdSkipDuration');
    const inputAutoClickMax = document.getElementById('inputAutoClickMax');
    if (inputAdSkipDuration) inputAdSkipDuration.value = currentState.adSkipDuration || 15;
    if (inputAutoClickMax) inputAutoClickMax.value = currentState.autoClickMax || 1;

    // Filter Lists
    renderFilterLists(currentState.filterLists || [], currentState.customFilterLists || []);

    // Footer Status Message
    if (!enabled) {
      statusMessage.textContent = 'Eklenti devre dışı';
    } else if (paused) {
      statusMessage.textContent = 'Geçici olarak duraklatıldı';
    } else if (isWhitelisted) {
      statusMessage.textContent = 'Bu site muaf tutuluyor';
    } else {
      statusMessage.textContent = 'Tüm reklamlar engellenmiş durumda ✓';
    }
  }

  function renderAiKeys(keys) {
    const list = document.getElementById('aiKeysList');
    list.innerHTML = '';
    if (!keys || keys.length === 0) {
      list.innerHTML = '<span style="color:#64748b; font-size:11px;">Henüz key eklenmedi</span>';
      return;
    }
    keys.forEach((item, index) => {
      // Compatibility with old format or new { key, model } format
      const keyVal = item.key || item;
      const modelVal = item.model || 'gemini-2.5-flash';

      const div = document.createElement('div');
      div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background: rgba(15, 23, 42, 0.4); padding: 4px 8px; border-radius: 4px;';
      const hiddenKey = keyVal.substring(0, 4) + '...' + keyVal.substring(keyVal.length - 4);
      const shortModel = modelVal.replace('models/', '');
      div.innerHTML = `<span style="color:#cbd5e1; font-size:11px; font-family:monospace;">${hiddenKey}</span><span style="color:#64748b; font-size:10px;">${shortModel}</span>`;
      const delBtn = document.createElement('button');
      delBtn.textContent = '✕';
      delBtn.style.cssText = 'background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:10px; padding:2px;';
      delBtn.onclick = async () => {
         await sendMsg({ type: 'REMOVE_AI_KEY', index });
         await loadState();
      };
      div.appendChild(delBtn);
      list.appendChild(div);
    });
  }

  // ── Format Numbers ───────────────────────
  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  // ── Render Rules ─────────────────────────
  function renderRules(rules) {
    ruleCount.textContent = rules.length;

    if (rules.length === 0) {
      rulesList.innerHTML = '';
      rulesList.appendChild(emptyRules);
      emptyRules.style.display = 'flex';
      return;
    }

    emptyRules.style.display = 'none';
    const fragment = document.createDocumentFragment();

    rules.forEach(rule => {
      const item = document.createElement('div');
      item.className = 'rule-item' + (rule.enabled === false ? ' disabled' : '');

      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.className = 'rule-toggle';
      toggle.checked = rule.enabled !== false;
      toggle.addEventListener('change', async () => {
        await sendMsg({ type: 'TOGGLE_CUSTOM_RULE', ruleId: rule.id });
        await loadState();
      });

      const selector = document.createElement('span');
      selector.className = 'rule-selector';
      selector.textContent = rule.selector;
      selector.title = rule.selector;

      const domain = document.createElement('span');
      domain.className = 'rule-domain';
      domain.textContent = rule.allSites ? '🌐 Tüm' : (rule.domain || '—');

      const source = document.createElement('span');
      source.className = 'rule-source ' + (rule.source || 'manual');
      source.textContent = rule.source === 'picker' ? '🎯' : (rule.source === 'import' ? '📥' : '✏️');
      source.title = rule.source === 'picker' ? 'Element seçici' : (rule.source === 'import' ? 'İçe aktarıldı' : 'Manuel');

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'rule-delete';
      deleteBtn.textContent = '✕';
      deleteBtn.title = 'Kuralı sil';
      deleteBtn.addEventListener('click', async () => {
        await sendMsg({ type: 'DELETE_CUSTOM_RULE', ruleId: rule.id });
        await loadState();
      });

      item.appendChild(toggle);
      item.appendChild(selector);
      item.appendChild(domain);
      item.appendChild(source);
      item.appendChild(deleteBtn);
      fragment.appendChild(item);
    });

    rulesList.innerHTML = '';
    rulesList.appendChild(fragment);
  }

  // ── Render Stats ─────────────────────────
  function renderStats(stats) {
    statsTotalBlocked.textContent = formatNumber(stats.total || 0);

    const today = new Date().toISOString().split('T')[0];
    const todayCount = (stats.daily && stats.daily[today]) || 0;
    statsTodayBlocked.textContent = formatNumber(todayCount);

    const byDomain = stats.byDomain || {};
    const entries = Object.entries(byDomain)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    if (entries.length === 0) {
      domainStatsList.innerHTML = '<div class="empty-state"><span>Henüz veri yok</span></div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    entries.forEach(([domain, count]) => {
      const item = document.createElement('div');
      item.className = 'domain-stat-item';
      item.innerHTML = `
        <span class="domain-name">${escapeHtml(domain)}</span>
        <span class="domain-count">${formatNumber(count)}</span>
      `;
      fragment.appendChild(item);
    });
    domainStatsList.innerHTML = '';
    domainStatsList.appendChild(fragment);
  }

  // ── Render Whitelist ─────────────────────
  function renderWhitelist(whitelist) {
    if (whitelist.length === 0) {
      whitelistItems.innerHTML = '';
      whitelistItems.appendChild(emptyWhitelist);
      emptyWhitelist.style.display = 'flex';
      return;
    }

    emptyWhitelist.style.display = 'none';
    const fragment = document.createDocumentFragment();

    whitelist.forEach(domain => {
      const item = document.createElement('div');
      item.className = 'whitelist-item';
      item.innerHTML = `
        <span class="whitelist-domain">${escapeHtml(domain)}</span>
      `;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'whitelist-remove';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', async () => {
        await sendMsg({ type: 'REMOVE_WHITELIST', domain });
        await loadState();
      });
      item.appendChild(removeBtn);
      fragment.appendChild(item);
    });

    whitelistItems.innerHTML = '';
    whitelistItems.appendChild(fragment);
  }

  // ── HTML escape ──────────────────────────
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Render Filter Lists ──────────────────
  function renderFilterLists(lists, custom) {
    const container = document.getElementById('filterListsContainer');
    const customContainer = document.getElementById('customListsContainer');
    if (!container) return;

    container.innerHTML = '';
    lists.forEach(list => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; background:rgba(30,41,59,0.5); padding:8px 10px; border-radius:7px; border:1px solid rgba(51,65,85,0.5);';
      row.innerHTML = `
        <span style="font-size:12px; color:#cbd5e1; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(list.url)}">${escapeHtml(list.name)}</span>
        <label class="toggle-switch" style="transform:scale(0.75); margin:0; flex-shrink:0;">
          <input type="checkbox" data-list-id="${list.id}" ${list.enabled ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      `;
      row.querySelector('input').addEventListener('change', async (e) => {
        await sendMsg({ type: 'SET_FILTER_LIST_ENABLED', id: list.id, enabled: e.target.checked });
      });
      container.appendChild(row);
    });

    if (!customContainer) return;
    customContainer.innerHTML = '';
    if (custom.length === 0) return;

    custom.forEach(list => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:6px; background:rgba(30,41,59,0.4); padding:6px 10px; border-radius:7px; border:1px solid rgba(51,65,85,0.4);';
      row.innerHTML = `
        <label class="toggle-switch" style="transform:scale(0.75); margin:0; flex-shrink:0;">
          <input type="checkbox" ${list.enabled !== false ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
        <span style="font-size:11px; color:#94a3b8; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(list.url)}">${escapeHtml(list.name || list.url)}</span>
        <button style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:12px; padding:2px 4px;" data-remove-id="${list.id}">✕</button>
      `;
      row.querySelector('input').addEventListener('change', async () => {
        await sendMsg({ type: 'TOGGLE_CUSTOM_LIST', id: list.id });
        await loadState();
      });
      row.querySelector('[data-remove-id]').addEventListener('click', async () => {
        await sendMsg({ type: 'REMOVE_CUSTOM_LIST', id: list.id });
        await loadState();
      });
      customContainer.appendChild(row);
    });
  }

  // ── Event Listeners ──────────────────────

  // Tab Navigation
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = 'tab-' + btn.dataset.tab;
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Main Toggle
  mainToggle.addEventListener('change', async () => {
    await sendMsg({ type: 'SET_ENABLED', enabled: mainToggle.checked });
    await loadState();
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
        chrome.tabs.reload(tab.id);
      }
    } catch (e) {}
  });

  // Element Picker
  btnPicker.addEventListener('click', async () => {
    await sendMsg({ type: 'ACTIVATE_PICKER' });
    window.close(); // popup'ı kapat
  });

  // Whitelist current site
  btnWhitelistSite.addEventListener('click', async () => {
    if (!activeTabHostname) return;
    const whitelist = currentState.whitelist || [];
    if (whitelist.includes(activeTabHostname)) {
      await sendMsg({ type: 'REMOVE_WHITELIST', domain: activeTabHostname });
    } else {
      await sendMsg({ type: 'ADD_WHITELIST', domain: activeTabHostname });
    }
    await loadState();
  });

  // Quick Pause (30 min)
  btnPause.addEventListener('click', async () => {
    if (currentState.paused) {
      await sendMsg({ type: 'RESUME' });
    } else {
      await sendMsg({ type: 'PAUSE', minutes: 30 });
    }
    await loadState();
  });

  // Add Rule
  btnAddRule.addEventListener('click', async () => {
    const selector = inputSelector.value.trim();
    if (!selector) {
      inputSelector.style.borderColor = 'var(--accent-red)';
      setTimeout(() => inputSelector.style.borderColor = '', 1500);
      return;
    }

    // Selector'ü doğrula
    try {
      document.querySelector(selector);
    } catch(e) {
      inputSelector.style.borderColor = 'var(--accent-red)';
      inputSelector.placeholder = 'Geçersiz CSS seçici!';
      setTimeout(() => {
        inputSelector.style.borderColor = '';
        inputSelector.placeholder = 'CSS Seçici (örn: .ad-banner)';
      }, 2000);
      return;
    }

    const domain = checkAllSites.checked ? '' : inputDomain.value.trim();
    const allSites = checkAllSites.checked;

    await sendMsg({
      type: 'ADD_CUSTOM_RULE',
      rule: {
        selector,
        domain,
        allSites,
        createdAt: Date.now(),
        source: 'manual'
      }
    });

    inputSelector.value = '';
    await loadState();
  });

  // Toggle all sites checkbox
  checkAllSites.addEventListener('change', () => {
    inputDomain.disabled = checkAllSites.checked;
    if (checkAllSites.checked) {
      inputDomain.value = '';
      inputDomain.placeholder = 'Tüm siteler seçili';
    } else {
      inputDomain.placeholder = 'Domain (boş = tüm siteler)';
      if (activeTabHostname) inputDomain.value = activeTabHostname;
    }
  });

  // Export Rules
  btnExport.addEventListener('click', async () => {
    const res = await sendMsg({ type: 'EXPORT_RULES' });
    if (res.success && res.rules) {
      const blob = new Blob([JSON.stringify(res.rules, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'adshield_pro_rules.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  });

  // Import Rules
  btnImport.addEventListener('click', () => {
    fileImport.click();
  });

  fileImport.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const rules = JSON.parse(text);
      if (Array.isArray(rules)) {
        await sendMsg({ type: 'IMPORT_RULES', rules });
        await loadState();
      }
    } catch(err) {
      console.error('Import error:', err);
    }
    fileImport.value = '';
  });

  // Reset Stats
  btnResetStats.addEventListener('click', async () => {
    await sendMsg({ type: 'RESET_STATS' });
    await loadState();
  });

  // Add Whitelist (settings)
  btnAddWhitelist.addEventListener('click', async () => {
    const domain = inputWhitelist.value.trim();
    if (!domain) return;
    await sendMsg({ type: 'ADD_WHITELIST', domain });
    inputWhitelist.value = '';
    await loadState();
  });

  inputWhitelist.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnAddWhitelist.click();
  });

  // Pause buttons (settings)
  pauseBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const minutes = parseInt(btn.dataset.minutes);
      await sendMsg({ type: 'PAUSE', minutes });
      await loadState();
    });
  });

  btnResumeNow.addEventListener('click', async () => {
    await sendMsg({ type: 'RESUME' });
    await loadState();
  });

  // AI Filter Events
  const aiToggle = document.getElementById('aiToggle');
  const btnFetchModels = document.getElementById('btnFetchModels');
  const btnAddAiKey = document.getElementById('btnAddAiKey');
  const inputAiKey = document.getElementById('inputAiKey');
  const aiModelGroup = document.getElementById('aiModelGroup');
  const selectAiModel = document.getElementById('selectAiModel');

  aiToggle?.addEventListener('change', async () => {
    await sendMsg({ type: 'SET_AI_ENABLED', enabled: aiToggle.checked });
    await loadState();
  });

  btnFetchModels?.addEventListener('click', async () => {
    const key = inputAiKey.value.trim();
    if (!key) return;
    
    btnFetchModels.textContent = 'Bekleyin...';
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (!res.ok) throw new Error('API Key hatalı veya yetkisiz.');
      const data = await res.json();
      
      selectAiModel.innerHTML = '';
      if (data.models && data.models.length > 0) {
         // Sadece Gemini modellerini filtrele
         const geminiModels = data.models.filter(m => m.name.includes('gemini'));
         geminiModels.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name;  // e.g. models/gemini-2.5-flash
            opt.textContent = m.displayName || m.name.replace('models/', '');
            selectAiModel.appendChild(opt);
         });
         
         btnFetchModels.style.display = 'none';
         aiModelGroup.style.display = 'flex';
      }
    } catch(err) {
      alert('Modeller alınamadı: ' + err.message);
    } finally {
      btnFetchModels.textContent = 'Modelleri Bul';
    }
  });

  btnAddAiKey?.addEventListener('click', async () => {
    const key = inputAiKey.value.trim();
    const model = selectAiModel.value;
    if (key && model) {
      await sendMsg({ type: 'ADD_AI_KEY', keyInfo: { key, model } });
      inputAiKey.value = '';
      btnFetchModels.style.display = 'block';
      aiModelGroup.style.display = 'none';
      await loadState();
    }
  });

  // Custom filter list add
  const btnAddCustomList = document.getElementById('btnAddCustomList');
  btnAddCustomList?.addEventListener('click', async () => {
    const urlInput = document.getElementById('inputCustomListUrl');
    const nameInput = document.getElementById('inputCustomListName');
    const url = urlInput.value.trim();
    if (!url || !url.startsWith('http')) {
      urlInput.style.borderColor = 'var(--accent-red)';
      setTimeout(() => urlInput.style.borderColor = '', 1500);
      return;
    }
    await sendMsg({ type: 'ADD_CUSTOM_LIST', url, name: nameInput.value.trim() || url });
    urlInput.value = '';
    nameInput.value = '';
    await loadState();
  });

  const btnUpdateCloud = document.getElementById('btnUpdateCloud');
  btnUpdateCloud?.addEventListener('click', async () => {
      btnUpdateCloud.textContent = '...';
      btnUpdateCloud.disabled = true;
      const res = await sendMsg({ type: 'FETCH_CLOUD_RULES' });
      btnUpdateCloud.disabled = false;
      if (res.success) {
          btnUpdateCloud.textContent = `✓ (${res.ruleCount || 0})`;
          setTimeout(() => { btnUpdateCloud.textContent = chrome.i18n.getMessage('updateNow') || 'Güncelle'; }, 2500);
          await loadState();
      } else {
          btnUpdateCloud.textContent = '✕ Hata';
          setTimeout(() => { btnUpdateCloud.textContent = chrome.i18n.getMessage('updateNow') || 'Güncelle'; }, 2000);
      }
  });

  selectLanguage?.addEventListener('change', async () => {
    await sendMsg({ type: 'SET_LANGUAGE', lang: selectLanguage.value });
    await loadState();
  });

  // Save Football Settings
  const btnSaveFootball = document.getElementById('btnSaveFootball');
  btnSaveFootball?.addEventListener('click', async () => {
    const inputAdSkipDuration = document.getElementById('inputAdSkipDuration');
    const inputAutoClickMax = document.getElementById('inputAutoClickMax');
    
    const adDuration = parseInt(inputAdSkipDuration.value);
    const clickMax = parseInt(inputAutoClickMax.value);
    
    btnSaveFootball.textContent = '...';
    await sendMsg({ 
        type: 'SET_FOOTBALL_SETTINGS', 
        adSkipDuration: adDuration, 
        autoClickMax: clickMax 
    });
    
    btnSaveFootball.textContent = '✓ Kaydedildi';
    btnSaveFootball.style.background = '#059669';
    
    setTimeout(() => {
        btnSaveFootball.textContent = 'Ayarları Kaydet';
        btnSaveFootball.style.background = '#166534';
    }, 2000);
    
    await loadState();
  });

  // ── Parental Control ─────────────────────
  const parentalToggle = document.getElementById('parentalToggle');
  const parentalStatusText = document.getElementById('parentalStatusText');

  async function loadParentalStatus() {
    const res = await sendMsg({ type: 'GET_PARENTAL_STATUS' });
    if (!res.success) return;
    if (parentalToggle) parentalToggle.checked = res.enabled;
    if (parentalStatusText) {
      if (res.enabled && res.domainCount > 0) {
        const lastUpdate = res.lastUpdate
          ? new Date(res.lastUpdate).toLocaleDateString('tr-TR')
          : '—';
        parentalStatusText.textContent = `${res.domainCount.toLocaleString()} alan adı yüklü · ${lastUpdate}`;
      } else if (res.enabled && res.domainCount === 0) {
        parentalStatusText.textContent = 'Liste indiriliyor...';
      } else {
        parentalStatusText.textContent = '500.000+ alan adı veritabanı';
      }
    }
  }

  parentalToggle?.addEventListener('change', async () => {
    const enabled = parentalToggle.checked;
    if (parentalStatusText) parentalStatusText.textContent = enabled ? 'Liste indiriliyor...' : '500.000+ alan adı veritabanı';
    parentalToggle.disabled = true;
    await sendMsg({ type: 'SET_PARENTAL_ENABLED', enabled });
    parentalToggle.disabled = false;
    await loadParentalStatus();
  });

  await loadParentalStatus();

  // ── Blocked Sites ────────────────────────
  async function loadBlockedSites() {
    const res = await sendMsg({ type: 'GET_BLOCKED_SITES' });
    if (res.success) renderBlockedSites(res.blockedSites || []);
  }

  function renderBlockedSites(sites) {
    const container = document.getElementById('blockedSitesList');
    const empty = document.getElementById('emptyBlockedSites');
    if (!container) return;
    container.innerHTML = '';
    if (sites.length === 0) {
      container.appendChild(empty || (() => {
        const d = document.createElement('div');
        d.id = 'emptyBlockedSites';
        d.style.cssText = 'font-size:11px; color:#475569; text-align:center; padding:8px;';
        d.textContent = 'Henüz engellenen site yok';
        return d;
      })());
      return;
    }
    sites.forEach(site => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; align-items:center; gap:6px; background:rgba(239,68,68,0.07); padding:6px 10px; border-radius:7px; border:1px solid rgba(239,68,68,0.15);';
      const icon = site.redirect === 'google' ? '🔍' : '🛡️';
      row.innerHTML = `
        <span style="font-size:13px;">${icon}</span>
        <span style="font-size:12px; color:#fca5a5; flex:1; font-family:monospace;">${escapeHtml(site.domain)}</span>
        <select data-domain="${escapeHtml(site.domain)}" class="block-redirect-sel" style="font-size:10px; padding:2px 4px; background:#0f172a; color:#94a3b8; border:1px solid #334155; border-radius:4px;">
          <option value="block" ${site.redirect==='block'?'selected':''}>Engel Sayfası</option>
          <option value="google" ${site.redirect==='google'?'selected':''}>Google</option>
        </select>
        <button data-domain="${escapeHtml(site.domain)}" class="block-remove-btn" style="background:transparent; border:none; color:#ef4444; cursor:pointer; font-size:12px; padding:2px 4px;">✕</button>
      `;
      row.querySelector('.block-redirect-sel').addEventListener('change', async (e) => {
        await sendMsg({ type: 'UPDATE_BLOCKED_SITE', domain: site.domain, redirect: e.target.value });
      });
      row.querySelector('.block-remove-btn').addEventListener('click', async () => {
        await sendMsg({ type: 'REMOVE_BLOCKED_SITE', domain: site.domain });
        await loadBlockedSites();
      });
      container.appendChild(row);
    });
  }

  const btnAddBlockSite = document.getElementById('btnAddBlockSite');
  btnAddBlockSite?.addEventListener('click', async () => {
    const input = document.getElementById('inputBlockSite');
    const redirect = document.getElementById('selectBlockRedirect').value;
    const domain = input.value.trim();
    if (!domain) {
      input.style.borderColor = 'var(--accent-red)';
      setTimeout(() => input.style.borderColor = '', 1500);
      return;
    }
    await sendMsg({ type: 'ADD_BLOCKED_SITE', domain, redirect });
    input.value = '';
    await loadBlockedSites();
  });

  document.getElementById('inputBlockSite')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnAddBlockSite?.click();
  });

  await loadBlockedSites();

  // ── Gerçek Zamanlı Sayfa Sayacı + Sync Değişiklikleri ──────────
  chrome.storage.onChanged.addListener((changes, area) => {
    // Local: sayfa sayacı güncelle
    if (area === 'local' && 'stats' in changes && activeTabHostname) {
      const byDomain = (changes.stats.newValue && changes.stats.newValue.byDomain) || {};
      const count = byDomain[activeTabHostname] || 0;
      const el = document.getElementById('pageBlockedCount');
      if (el) el.textContent = count.toLocaleString();
    }
    // Sync: başka cihazdan gelen değişikliklerde UI'ı yenile
    if (area === 'sync') {
      const syncKeys = ['enabled', 'whitelist', 'whitelist_n', 'customRules', 'customRules_n', 'blockedSites', 'blockedSites_n', 'preferredLanguage'];
      if (syncKeys.some(k => k in changes)) {
        loadState();
      }
    }
  });

  // ── Initial Load ─────────────────────────
  await loadState();
});

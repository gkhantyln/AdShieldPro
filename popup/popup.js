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

    // Aktif sekme bilgisi
    const tabInfo = await sendMsg({ type: 'GET_ACTIVE_TAB_INFO' });
    if (tabInfo.success) {
      activeTabHostname = tabInfo.hostname || '';
    }

    updateUI();
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
      statusText.textContent = 'Devre Dışı';
    } else if (paused) {
      statusText.textContent = 'Duraklatıldı';
    } else {
      statusText.textContent = 'Aktif & Koruyor';
    }

    // Current site
    if (activeTabHostname) {
      currentSiteEl.textContent = activeTabHostname;
      currentSiteEl.style.display = 'block';

      // inputDomain'e aktif sekme domain'ini yaz (otomatik)
      if (!inputDomain.value) {
        inputDomain.value = activeTabHostname;
      }
    } else {
      currentSiteEl.style.display = 'none';
    }

    // Whitelist button state
    const isWhitelisted = whitelist.includes(activeTabHostname);
    btnWhitelistSite.classList.toggle('active-wl', isWhitelisted);
    whitelistBtnText.textContent = isWhitelisted ? 'Muafiyeti Kaldır' : 'Siteyi Muaf Tut';

    // Pause button
    if (paused) {
      const remaining = Math.max(0, Math.ceil((pauseUntil - Date.now()) / 60000));
      pauseBtnText.textContent = remaining + 'dk kaldı';
      btnPause.classList.add('active-wl');
    } else {
      pauseBtnText.textContent = '30dk Duraklat';
      btnPause.classList.remove('active-wl');
    }

    // Total blocked
    totalBlockedCount.textContent = formatNumber(stats.total || 0);

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

  // Enter key for selector input
  inputSelector.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnAddRule.click();
  });

  // ── Init ─────────────────────────────────
  await loadState();
});

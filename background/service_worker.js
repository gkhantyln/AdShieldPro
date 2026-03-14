const STORAGE_KEY_ENABLED = 'enabled';
const STORAGE_KEY_PAUSE_UNTIL = 'pauseUntil';
const STORAGE_KEY_CUSTOM_RULES = 'customRules';
const STORAGE_KEY_WHITELIST = 'whitelist';
const STORAGE_KEY_STATS = 'stats';
const RULESET_IDS = ['yt_rules', 'general_rules'];
const YT_MATCHES = [
  '*://*.youtube.com/*',
  '*://m.youtube.com/*'
];

// ── Enabled / Badge ──────────────────────────────────
async function getEnabled() {
  const { [STORAGE_KEY_ENABLED]: enabled } = await chrome.storage.local.get({ [STORAGE_KEY_ENABLED]: true });
  return Boolean(enabled);
}

async function setBadge(enabled) {
  try {
    await chrome.action.setBadgeText({ text: enabled ? 'ON' : 'OFF' });
    await chrome.action.setBadgeBackgroundColor({ color: enabled ? '#10b981' : '#9ca3af' });
  } catch (e) {}
}

async function applyRulesetState(enabled) {
  const options = enabled
    ? { enableRulesetIds: RULESET_IDS, disableRulesetIds: [] }
    : { enableRulesetIds: [], disableRulesetIds: RULESET_IDS };
  await chrome.declarativeNetRequest.updateEnabledRulesets(options);
}

async function isPaused() {
  const { [STORAGE_KEY_PAUSE_UNTIL]: pauseUntil } = await chrome.storage.local.get({ [STORAGE_KEY_PAUSE_UNTIL]: 0 });
  return Date.now() < Number(pauseUntil || 0);
}

async function updateEffectiveState() {
  const paused = await isPaused();
  const enabled = await getEnabled();
  const effective = enabled && !paused;
  await applyRulesetState(effective);
  await setBadge(effective);
}

// ── İlk Kurulum ──────────────────────────────────────
async function init() {
  await updateEffectiveState();
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await getEnabled();
  if (typeof current !== 'boolean') {
    await chrome.storage.local.set({ [STORAGE_KEY_ENABLED]: true });
  }
  // Varsayılan storage alanlarını oluştur
  const data = await chrome.storage.local.get({
    [STORAGE_KEY_CUSTOM_RULES]: null,
    [STORAGE_KEY_WHITELIST]: null,
    [STORAGE_KEY_STATS]: null
  });
  if (data[STORAGE_KEY_CUSTOM_RULES] === null) {
    await chrome.storage.local.set({ [STORAGE_KEY_CUSTOM_RULES]: [] });
  }
  if (data[STORAGE_KEY_WHITELIST] === null) {
    await chrome.storage.local.set({ [STORAGE_KEY_WHITELIST]: [] });
  }
  if (data[STORAGE_KEY_STATS] === null) {
    await chrome.storage.local.set({ [STORAGE_KEY_STATS]: { total: 0, daily: {}, byDomain: {} } });
  }
  await init();
});

chrome.runtime.onStartup.addListener(() => {
  init();
});

// ── Storage Değişiklikleri ───────────────────────────
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local') return;
  if (STORAGE_KEY_ENABLED in changes || STORAGE_KEY_PAUSE_UNTIL in changes) {
    await updateEffectiveState();
  }
});

// ── Periyodik Kontrol ────────────────────────────────
setInterval(() => {
  updateEffectiveState();
}, 60 * 1000);

// ── Mesaj İşleme ─────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch(e => {
    console.error('Message handler error:', e);
    sendResponse({ success: false, error: e.message });
  });
  return true; // async sendResponse
});

async function handleMessage(msg, sender) {
  switch(msg.type) {
    case 'GET_STATE': {
      const enabled = await getEnabled();
      const paused = await isPaused();
      const data = await chrome.storage.local.get({
        [STORAGE_KEY_CUSTOM_RULES]: [],
        [STORAGE_KEY_WHITELIST]: [],
        [STORAGE_KEY_STATS]: { total: 0, daily: {}, byDomain: {} },
        [STORAGE_KEY_PAUSE_UNTIL]: 0
      });
      return {
        success: true,
        enabled,
        paused,
        pauseUntil: data[STORAGE_KEY_PAUSE_UNTIL],
        customRules: data[STORAGE_KEY_CUSTOM_RULES],
        whitelist: data[STORAGE_KEY_WHITELIST],
        stats: data[STORAGE_KEY_STATS]
      };
    }

    case 'SET_ENABLED': {
      await chrome.storage.local.set({ [STORAGE_KEY_ENABLED]: msg.enabled });
      return { success: true };
    }

    case 'PAUSE': {
      const until = Date.now() + (msg.minutes * 60 * 1000);
      await chrome.storage.local.set({ [STORAGE_KEY_PAUSE_UNTIL]: until });
      return { success: true };
    }

    case 'RESUME': {
      await chrome.storage.local.set({ [STORAGE_KEY_PAUSE_UNTIL]: 0 });
      return { success: true };
    }

    case 'ADD_CUSTOM_RULE': {
      const data = await chrome.storage.local.get({ [STORAGE_KEY_CUSTOM_RULES]: [] });
      const rules = data[STORAGE_KEY_CUSTOM_RULES] || [];
      
      // Duplicate kontrolü
      const exists = rules.some(r =>
        r.selector === msg.rule.selector && r.domain === msg.rule.domain
      );
      if (!exists) {
        rules.push({
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
          selector: msg.rule.selector,
          domain: msg.rule.domain || '',
          allSites: msg.rule.allSites || false,
          createdAt: msg.rule.createdAt || Date.now(),
          source: msg.rule.source || 'manual',
          enabled: true
        });
        await chrome.storage.local.set({ [STORAGE_KEY_CUSTOM_RULES]: rules });
      }
      return { success: true, rules };
    }

    case 'DELETE_CUSTOM_RULE': {
      const data2 = await chrome.storage.local.get({ [STORAGE_KEY_CUSTOM_RULES]: [] });
      const rules2 = (data2[STORAGE_KEY_CUSTOM_RULES] || []).filter(r => r.id !== msg.ruleId);
      await chrome.storage.local.set({ [STORAGE_KEY_CUSTOM_RULES]: rules2 });
      return { success: true, rules: rules2 };
    }

    case 'TOGGLE_CUSTOM_RULE': {
      const data3 = await chrome.storage.local.get({ [STORAGE_KEY_CUSTOM_RULES]: [] });
      const rules3 = data3[STORAGE_KEY_CUSTOM_RULES] || [];
      const rule = rules3.find(r => r.id === msg.ruleId);
      if (rule) {
        rule.enabled = !rule.enabled;
        await chrome.storage.local.set({ [STORAGE_KEY_CUSTOM_RULES]: rules3 });
      }
      return { success: true, rules: rules3 };
    }

    case 'UPDATE_CUSTOM_RULE': {
      const data4 = await chrome.storage.local.get({ [STORAGE_KEY_CUSTOM_RULES]: [] });
      const rules4 = data4[STORAGE_KEY_CUSTOM_RULES] || [];
      const idx = rules4.findIndex(r => r.id === msg.ruleId);
      if (idx !== -1) {
        rules4[idx] = { ...rules4[idx], ...msg.updates };
        await chrome.storage.local.set({ [STORAGE_KEY_CUSTOM_RULES]: rules4 });
      }
      return { success: true, rules: rules4 };
    }

    case 'ADD_WHITELIST': {
      const data5 = await chrome.storage.local.get({ [STORAGE_KEY_WHITELIST]: [] });
      const list = data5[STORAGE_KEY_WHITELIST] || [];
      if (!list.includes(msg.domain)) {
        list.push(msg.domain);
        await chrome.storage.local.set({ [STORAGE_KEY_WHITELIST]: list });
      }
      return { success: true, whitelist: list };
    }

    case 'REMOVE_WHITELIST': {
      const data6 = await chrome.storage.local.get({ [STORAGE_KEY_WHITELIST]: [] });
      const list2 = (data6[STORAGE_KEY_WHITELIST] || []).filter(d => d !== msg.domain);
      await chrome.storage.local.set({ [STORAGE_KEY_WHITELIST]: list2 });
      return { success: true, whitelist: list2 };
    }

    case 'GET_STATS': {
      const data7 = await chrome.storage.local.get({ [STORAGE_KEY_STATS]: { total: 0, daily: {}, byDomain: {} } });
      return { success: true, stats: data7[STORAGE_KEY_STATS] };
    }

    case 'RESET_STATS': {
      await chrome.storage.local.set({ [STORAGE_KEY_STATS]: { total: 0, daily: {}, byDomain: {} } });
      return { success: true };
    }

    case 'ACTIVATE_PICKER': {
      // element-picker.js artık manifest content_scripts'ten yüklü,
      // sadece mesaj gönder
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_PICKER' });
        } catch(e) {
          // Script henüz yüklenmediyse enjekte et ve tekrar dene
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content/element-picker.js']
            });
            // Script'in yüklenmesi için kısa bekle
            await new Promise(r => setTimeout(r, 200));
            await chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_PICKER' });
          } catch(e2) {
            console.warn('Element picker activation failed:', e2);
          }
        }
      }
      return { success: true };
    }

    case 'EXPORT_RULES': {
      const data8 = await chrome.storage.local.get({ [STORAGE_KEY_CUSTOM_RULES]: [] });
      return { success: true, rules: data8[STORAGE_KEY_CUSTOM_RULES] };
    }

    case 'IMPORT_RULES': {
      const data9 = await chrome.storage.local.get({ [STORAGE_KEY_CUSTOM_RULES]: [] });
      const existing = data9[STORAGE_KEY_CUSTOM_RULES] || [];
      const imported = msg.rules || [];
      
      // Merge: varolan kuralları koruyarak import et
      for (const rule of imported) {
        const exists = existing.some(r =>
          r.selector === rule.selector && r.domain === rule.domain
        );
        if (!exists) {
          existing.push({
            ...rule,
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            createdAt: rule.createdAt || Date.now(),
            source: 'import',
            enabled: true
          });
        }
      }
      await chrome.storage.local.set({ [STORAGE_KEY_CUSTOM_RULES]: existing });
      return { success: true, rules: existing };
    }

    case 'GET_ACTIVE_TAB_INFO': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        let hostname = '';
        try {
          hostname = new URL(tab.url).hostname;
        } catch(e) {}
        return { success: true, url: tab.url, hostname, title: tab.title };
      }
      return { success: false };
    }

    default:
      return { success: false, error: 'Unknown message type' };
  }
}

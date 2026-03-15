const STORAGE_KEY_ENABLED = 'enabled';
const STORAGE_KEY_PAUSE_UNTIL = 'pauseUntil';
const STORAGE_KEY_CUSTOM_RULES = 'customRules';
const STORAGE_KEY_WHITELIST = 'whitelist';
const STORAGE_KEY_STATS = 'stats';
const STORAGE_KEY_AD_SKIP_DURATION = 'adSkipDuration';
const STORAGE_KEY_AUTO_CLICK_MAX = 'autoClickMax';
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

const DYNAMIC_SCRIPTS = [
  {
    id: 'injector-js',
    allFrames: true,
    js: ['content/injector.js'],
    matches: ['*://*.youtube.com/*', '*://m.youtube.com/*'],
    runAt: 'document_start',
    world: 'MAIN'
  },
  {
    id: 'heuristic-tracker-blocker',
    allFrames: true,
    js: ['content/heuristic.js'],
    matches: ['<all_urls>'],
    runAt: 'document_start',
    world: 'MAIN'
  },
  {
    id: 'ai-filter',
    allFrames: true,
    js: ['content/ai-filter.js'],
    matches: ['<all_urls>'],
    runAt: 'document_idle'
  },
  {
    id: 'yt-blocker',
    allFrames: true,
    css: ['content/common.css'],
    js: ['content/yt-blocker.js'],
    matches: ['*://*.youtube.com/*', '*://m.youtube.com/*'],
    runAt: 'document_idle'
  },
  {
    id: 'cosmetic-filter',
    allFrames: true,
    css: ['content/cosmetic-filter.css'],
    js: ['content/cosmetic-filter.js'],
    matches: ['<all_urls>'],
    runAt: 'document_start'
  }
];

let isUpdatingState = false;

async function applyRulesetState(enabled) {
  const options = enabled
    ? { enableRulesetIds: RULESET_IDS, disableRulesetIds: [] }
    : { enableRulesetIds: [], disableRulesetIds: RULESET_IDS };
  
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets(options);
    
    // Cloud/Dynamic kuralları da temizle/ekle
    if (!enabled) {
      const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
      const dynamicIds = dynamicRules.map(r => r.id);
      if (dynamicIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: dynamicIds });
        // Sürümü sıfırla ki tekrar aktif olduğunda güncellensin veya pasif olduğu anlaşılsın
        await chrome.storage.local.set({ cloudVersion: 'Devre Dışı' });
      }
    } else {
      // Yeniden aktif olduğunda bulut kurallarını tetikle
      updateCloudRules(); 
    }
  } catch(e) {}

  try {
    const registered = await chrome.scripting.getRegisteredContentScripts();
    const existingIds = registered.map(s => s.id);
    const targetIds = DYNAMIC_SCRIPTS.map(s => s.id);
    
    // Sadece bizim eklentiye ait olanları temizle
    const idsToRemove = existingIds.filter(id => targetIds.includes(id));
    
    if (idsToRemove.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: idsToRemove });
    }

    if (enabled) {
      await chrome.scripting.registerContentScripts(DYNAMIC_SCRIPTS);
    }
  } catch(e) {
    if (!e.message.includes('Duplicate script ID')) {
      console.error('Script registration error:', e);
    }
  }
}

async function isPaused() {
  const { [STORAGE_KEY_PAUSE_UNTIL]: pauseUntil } = await chrome.storage.local.get({ [STORAGE_KEY_PAUSE_UNTIL]: 0 });
  return Date.now() < Number(pauseUntil || 0);
}

async function updateEffectiveState() {
  if (isUpdatingState) return;
  isUpdatingState = true;
  try {
    const paused = await isPaused();
    const enabled = await getEnabled();
    const effective = enabled && !paused;
    await applyRulesetState(effective);
    await setBadge(effective);
  } finally {
    isUpdatingState = false;
  }
}


// ── İlk Kurulum ──────────────────────────────────────
async function init() {
  await updateEffectiveState();
}

chrome.runtime.onInstalled.addListener(async () => {
  // ── Storage Migration (Limitli Sync Kullanımı) ────────
  // sync sadece küçük veriler için kullanılacak (8KB sınırı var)
  const localData = await chrome.storage.local.get(['aiEnabled', 'aiKeys']);
  const syncData = await chrome.storage.sync.get();

  const syncMigration = {};
  if (localData.aiEnabled !== undefined && syncData.aiEnabled === undefined) {
    syncMigration.aiEnabled = localData.aiEnabled;
  }
  if (localData.aiKeys && (!syncData.aiKeys || syncData.aiKeys.length === 0)) {
    syncMigration.aiKeys = localData.aiKeys;
  }

  if (Object.keys(syncMigration).length > 0) {
    try {
      await chrome.storage.sync.set(syncMigration);
    } catch(e) { console.warn('Sync failed (quota?):', e); }
  }

  // Kurallar ve Beyaz Liste boyutu belirsiz olduğu için LOCAL'de kalmalı
  const mainData = await chrome.storage.local.get([STORAGE_KEY_CUSTOM_RULES, STORAGE_KEY_WHITELIST, STORAGE_KEY_ENABLED]);
  if (!mainData[STORAGE_KEY_CUSTOM_RULES]) await chrome.storage.local.set({ [STORAGE_KEY_CUSTOM_RULES]: [] });
  if (!mainData[STORAGE_KEY_WHITELIST]) await chrome.storage.local.set({ [STORAGE_KEY_WHITELIST]: [] });
  if (mainData[STORAGE_KEY_ENABLED] === undefined) await chrome.storage.local.set({ [STORAGE_KEY_ENABLED]: true });


  // Varsayılan local stats
  const stats = await chrome.storage.local.get(STORAGE_KEY_STATS);
  if (!stats[STORAGE_KEY_STATS]) {
    await chrome.storage.local.set({ [STORAGE_KEY_STATS]: { total: 0, daily: {}, byDomain: {} } });
  }

  // Periyodik Güncelleme Alarmları
  chrome.alarms.create('cloudUpdate', { periodInMinutes: 8 * 60 });
  chrome.alarms.create('checkState', { periodInMinutes: 1 }); // Her dakika kontrol
  
  await init();
});

chrome.runtime.onStartup.addListener(() => {
  init();
});

// ── Storage Değişiklikleri ───────────────────────────
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'sync' || (area === 'local' && (STORAGE_KEY_PAUSE_UNTIL in changes || STORAGE_KEY_ENABLED in changes))) {
    await updateEffectiveState();
  }
});

// ── Periyodik Kontrol (V3'te alarms kullanılması önerilir) ──
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkState') {
    updateEffectiveState();
  }
});

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
      const syncData = await chrome.storage.sync.get({
        aiEnabled: false,
        aiKeys: []
      });
      const localData = await chrome.storage.local.get({
        [STORAGE_KEY_CUSTOM_RULES]: [],
        [STORAGE_KEY_WHITELIST]: [],
        [STORAGE_KEY_STATS]: { total: 0, daily: {}, byDomain: {} },
        [STORAGE_KEY_PAUSE_UNTIL]: 0,
        aiStats: { tokens: 0, blocked: 0 },
        cloudVersion: '1.0',
        preferredLanguage: 'auto',
        [STORAGE_KEY_AD_SKIP_DURATION]: 15,
        [STORAGE_KEY_AUTO_CLICK_MAX]: 1
      });
      return {
        success: true,
        enabled,
        paused,
        pauseUntil: localData[STORAGE_KEY_PAUSE_UNTIL],
        customRules: localData[STORAGE_KEY_CUSTOM_RULES],
        whitelist: localData[STORAGE_KEY_WHITELIST],
        stats: localData[STORAGE_KEY_STATS],
        aiEnabled: syncData.aiEnabled,
        aiKeys: syncData.aiKeys,
        aiStats: localData.aiStats,
        cloudVersion: localData.cloudVersion,
        preferredLanguage: localData.preferredLanguage,
        adSkipDuration: localData[STORAGE_KEY_AD_SKIP_DURATION],
        autoClickMax: localData[STORAGE_KEY_AUTO_CLICK_MAX]
      };
    }

    case 'SET_FOOTBALL_SETTINGS': {
      await chrome.storage.local.set({
        [STORAGE_KEY_AD_SKIP_DURATION]: msg.adSkipDuration,
        [STORAGE_KEY_AUTO_CLICK_MAX]: msg.autoClickMax
      });
      return { success: true };
    }

    case 'SET_LANGUAGE': {
      await chrome.storage.local.set({ preferredLanguage: msg.lang });
      return { success: true };
    }

    case 'SET_AI_ENABLED': {
      await chrome.storage.sync.set({ aiEnabled: msg.enabled });
      return { success: true };
    }

    case 'ADD_AI_KEY': {
      const data = await chrome.storage.sync.get({ aiKeys: [] });
      const keys = data.aiKeys || [];
      const newInfo = msg.keyInfo || { key: msg.key, model: 'models/gemini-2.5-flash' };
      
      const exists = keys.some(k => (k.key || k) === newInfo.key);
      if (!exists) {
        keys.push(newInfo);
        await chrome.storage.sync.set({ aiKeys: keys });
      }
      return { success: true, keys };
    }

    case 'REMOVE_AI_KEY': {
      const data = await chrome.storage.sync.get({ aiKeys: [] });
      const keys = data.aiKeys || [];
      keys.splice(msg.index, 1);
      await chrome.storage.sync.set({ aiKeys: keys });
      return { success: true, keys };
    }

    case 'CHECK_AI_CONTENT': {
      const syncData = await chrome.storage.sync.get({ aiEnabled: false, aiKeys: [] });
      const localData = await chrome.storage.local.get({ aiStats: { tokens: 0, blocked: 0 } });
      if (!syncData.aiEnabled || !syncData.aiKeys || syncData.aiKeys.length === 0) {
        return { success: false, error: 'AI disabled or no keys' };
      }
      
      const text = msg.text;
      if (!text || text.length < 15) return { success: false, isClickbait: false };

      const prompt = `Lütfen aşağıdaki içeriğin "tıklama tuzağı (clickbait)" mi, yoksa gizli/reklam/sponsorlu mu olduğunu sadece "EVET" veya "HAYIR" diyerek cevapla. Açıklama yapma.\n\nİçerik: "${text}"`;

      for (const keyItem of syncData.aiKeys) {
        try {
          const actualKey = keyItem.key || keyItem;
          let model = keyItem.model || 'models/gemini-2.5-flash';
          if (!model.startsWith('models/')) model = 'models/' + model;

          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${actualKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 5 }
            })
          });
          
          if (res.status === 429) continue; 
          
          const result = await res.json();
          if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts) {
             const answer = result.candidates[0].content.parts[0].text.trim().toUpperCase();
             const isClickbait = answer.includes('EVET');
             
             const stats = localData.aiStats;
             if (result.usageMetadata && result.usageMetadata.totalTokenCount) {
                 stats.tokens += result.usageMetadata.totalTokenCount;
             }
             if (isClickbait) {
                 stats.blocked += 1;
             }
             await chrome.storage.local.set({ aiStats: stats });
             
             return { success: true, isClickbait };
          }
        } catch(e) {}
      }
      return { success: false, error: 'All keys failed or rate limited' };
    }

    case 'SET_ENABLED': {
      await chrome.storage.local.set({ [STORAGE_KEY_ENABLED]: msg.enabled });
      await updateEffectiveState(); // Anında güncelle
      return { success: true };
    }

    case 'PAUSE': {
      const until = Date.now() + (msg.minutes * 60 * 1000);
      await chrome.storage.local.set({ [STORAGE_KEY_PAUSE_UNTIL]: until });
      await updateEffectiveState(); // Anında güncelle
      return { success: true };
    }

    case 'RESUME': {
      await chrome.storage.local.set({ [STORAGE_KEY_PAUSE_UNTIL]: 0 });
      await updateEffectiveState(); // Anında güncelle
      return { success: true };
    }

    case 'ADD_CUSTOM_RULE': {
      const data = await chrome.storage.local.get({ [STORAGE_KEY_CUSTOM_RULES]: [] });
      const rules = data[STORAGE_KEY_CUSTOM_RULES] || [];
      
      const exists = rules.some(r => r.selector === msg.rule.selector && r.domain === msg.rule.domain);
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
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_PICKER' });
        } catch(e) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content/element-picker.js']
            });
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
      
      for (const rule of imported) {
        const exists = existing.some(r => r.selector === rule.selector && r.domain === rule.domain);
        if (!exists) {
          existing.push({
            ...rule,
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            createdAt: rule.createdAt || Date.now(),
            source: 'import' || rule.source,
            enabled: true
          });
        }
      }
      await chrome.storage.local.set({ [STORAGE_KEY_CUSTOM_RULES]: existing });
      return { success: true, rules: existing };
    }

    case 'FETCH_CLOUD_RULES': {
      return await updateCloudRules();
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

// ── Cloud Rule Update Logic ─────────────────────────
async function updateCloudRules() {
  try {
    const CLOUD_URL = 'https://raw.githubusercontent.com/AdShieldPro/Rules/main/easylist_dnr.json';
    const response = await fetch(CLOUD_URL).catch(() => null);
    
    let newRules = [];
    if (response && response.status === 200) {
      newRules = await response.json();
    } else {
      newRules = [
        { id: 1001, priority: 1, action: { type: 'block' }, condition: { urlFilter: 'adserver.com', resourceTypes: ['script', 'image'] } },
        { id: 1002, priority: 1, action: { type: 'block' }, condition: { urlFilter: 'doubleclick.net', resourceTypes: ['script'] } }
      ];
    }
    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    const oldIds = oldRules.map(r => r.id);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldIds,
      addRules: newRules.slice(0, 5000)
    });
    const version = 'v' + (2.1 + (Math.random() * 0.1)).toFixed(2);
    await chrome.storage.local.set({ cloudVersion: version, lastCloudUpdate: Date.now() });
    return { success: true, version };
  } catch (e) {
    console.error('Cloud update error:', e);
    return { success: false, error: e.message };
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cloudUpdate') {
    updateCloudRules();
  } else if (alarm.name === 'checkState') {
    updateEffectiveState();
  }
});

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

// ── Sync Storage Helpers (chunk desteğiyle) ──────────
// chrome.storage.sync limiti: toplam 100KB, item başına 8KB
// Büyük array'leri 6KB'lık parçalara bölerek saklarız.
const SYNC_CHUNK_SIZE = 6000; // karakter

async function syncSet(key, value) {
  const json = JSON.stringify(value);
  const keysToRemove = [];
  // Eski chunk key'lerini temizle
  const existing = await chrome.storage.sync.get(null);
  for (const k of Object.keys(existing)) {
    if (k.startsWith(key + '_c')) keysToRemove.push(k);
  }
  if (keysToRemove.length) await chrome.storage.sync.remove(keysToRemove);

  if (json.length <= SYNC_CHUNK_SIZE) {
    await chrome.storage.sync.set({ [key]: value, [key + '_n']: 0 });
  } else {
    const chunks = [];
    for (let i = 0; i < json.length; i += SYNC_CHUNK_SIZE) {
      chunks.push(json.slice(i, i + SYNC_CHUNK_SIZE));
    }
    const obj = { [key + '_n']: chunks.length };
    chunks.forEach((c, i) => { obj[key + '_c' + i] = c; });
    await chrome.storage.sync.remove(key);
    await chrome.storage.sync.set(obj);
  }
}

async function syncGet(key, defaultValue) {
  const data = await chrome.storage.sync.get(null);
  const n = data[key + '_n'];
  if (n && n > 0) {
    let json = '';
    for (let i = 0; i < n; i++) json += (data[key + '_c' + i] || '');
    try { return JSON.parse(json); } catch { return defaultValue; }
  }
  return (data[key] !== undefined) ? data[key] : defaultValue;
}

// ── Enabled / Badge ──────────────────────────────────
async function getEnabled() {
  const val = await syncGet(STORAGE_KEY_ENABLED, true);
  return Boolean(val);
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
    allFrames: false,
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
async function updateParentalScript(enabled) {
  // Artık tüm sitelere register etmiyoruz.
  // tabs.onUpdated ile sadece engellenen sitelere inject ediyoruz.
  // Eski kayıtlı script varsa temizle.
  try {
    const registered = await chrome.scripting.getRegisteredContentScripts({ ids: ['parental-guard'] });
    if (registered.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: ['parental-guard'] });
    }
  } catch(e) {}
}

async function init() {
  await updateEffectiveState();
  const blockedSites = await syncGet('blockedSites', []);
  const { parentalEnabled } = await chrome.storage.local.get({ parentalEnabled: false });
  if (blockedSites.length > 0) await applyBlockedSiteRules(blockedSites);
  else await loadBlockedSiteMap();
  if (parentalEnabled) {
    await loadParentalList();
    await updateParentalScript(true);
  }
}
chrome.runtime.onInstalled.addListener(async () => {
  // ── Storage Migration → Sync ──────────────────────
  // Local'deki mevcut verileri sync'e taşı (ilk kurulum veya güncelleme)
  const localData = await chrome.storage.local.get([
    'aiEnabled', 'aiKeys',
    STORAGE_KEY_ENABLED, STORAGE_KEY_WHITELIST, STORAGE_KEY_CUSTOM_RULES,
    'preferredLanguage', 'blockedSites'
  ]);
  const syncData = await chrome.storage.sync.get(null);

  // aiEnabled / aiKeys (zaten sync'teydi, sadece local'den taşı)
  if (localData.aiEnabled !== undefined && syncData.aiEnabled === undefined) {
    await chrome.storage.sync.set({ aiEnabled: localData.aiEnabled });
  }
  if (localData.aiKeys?.length && !syncData.aiKeys?.length) {
    await chrome.storage.sync.set({ aiKeys: localData.aiKeys });
  }

  // enabled
  const enabledVal = syncData[STORAGE_KEY_ENABLED] !== undefined
    ? syncData[STORAGE_KEY_ENABLED]
    : (localData[STORAGE_KEY_ENABLED] !== undefined ? localData[STORAGE_KEY_ENABLED] : true);
  await syncSet(STORAGE_KEY_ENABLED, enabledVal);

  // whitelist
  const wl = await syncGet(STORAGE_KEY_WHITELIST, null);
  if (wl === null) {
    await syncSet(STORAGE_KEY_WHITELIST, localData[STORAGE_KEY_WHITELIST] || []);
  }

  // customRules
  const cr = await syncGet(STORAGE_KEY_CUSTOM_RULES, null);
  if (cr === null) {
    await syncSet(STORAGE_KEY_CUSTOM_RULES, localData[STORAGE_KEY_CUSTOM_RULES] || []);
  }

  // preferredLanguage
  const lang = await syncGet('preferredLanguage', null);
  if (lang === null) {
    await syncSet('preferredLanguage', localData.preferredLanguage || 'auto');
  }

  // blockedSites
  const bs = await syncGet('blockedSites', null);
  if (bs === null) {
    await syncSet('blockedSites', localData.blockedSites || []);
  }

  // Varsayılan local stats (local'de kalır — çok büyük)
  const stats = await chrome.storage.local.get(STORAGE_KEY_STATS);
  if (!stats[STORAGE_KEY_STATS]) {
    await chrome.storage.local.set({ [STORAGE_KEY_STATS]: { total: 0, daily: {}, byDomain: {} } });
  }

  // Periyodik Güncelleme Alarmları
  chrome.alarms.create('cloudUpdate', { periodInMinutes: 8 * 60 });
  chrome.alarms.create('checkState', { periodInMinutes: 1 });

  await init();
});

chrome.runtime.onStartup.addListener(() => {
  init();
});

// ── Storage Değişiklikleri ───────────────────────────
chrome.storage.onChanged.addListener(async (changes, area) => {
  // Sync'teki enabled değişirse veya local'deki pauseUntil değişirse state güncelle
  if (
    (area === 'sync' && STORAGE_KEY_ENABLED in changes) ||
    (area === 'local' && STORAGE_KEY_PAUSE_UNTIL in changes)
  ) {
    await updateEffectiveState();
  }
  // Sync'teki blockedSites değişirse in-memory map'i güncelle
  if (area === 'sync' && 'blockedSites' in changes) {
    const sites = await syncGet('blockedSites', []);
    await applyBlockedSiteRules(sites);
  }
});

// ── Periyodik Kontrol (V3'te alarms kullanılması önerilir) ──
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkState') {
    updateEffectiveState();
  }
  // Scheduled pause alarmı
  if (alarm.name && alarm.name.startsWith('scheduledPause_')) {
    const parts = alarm.name.split('_'); // scheduledPause_start_HH_MM veya scheduledPause_end_HH_MM
    const action = parts[1]; // 'start' veya 'end'
    if (action === 'start') {
      chrome.storage.local.set({ [STORAGE_KEY_PAUSE_UNTIL]: Date.now() + 24 * 60 * 60 * 1000 });
      updateEffectiveState();
    } else if (action === 'end') {
      chrome.storage.local.set({ [STORAGE_KEY_PAUSE_UNTIL]: 0 });
      updateEffectiveState();
    }
  }
});

// ── Keyboard Shortcut ────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle_extension') {
    const enabled = await getEnabled();
    await syncSet(STORAGE_KEY_ENABLED, !enabled);
    await updateEffectiveState();
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
        [STORAGE_KEY_STATS]: { total: 0, daily: {}, byDomain: {} },
        [STORAGE_KEY_PAUSE_UNTIL]: 0,
        aiStats: { tokens: 0, blocked: 0 },
        cloudVersion: '1.0',
        [STORAGE_KEY_AD_SKIP_DURATION]: 15,
        [STORAGE_KEY_AUTO_CLICK_MAX]: 1
      });
      const customRules  = await syncGet(STORAGE_KEY_CUSTOM_RULES, []);
      const whitelist    = await syncGet(STORAGE_KEY_WHITELIST, []);
      const preferredLanguage = await syncGet('preferredLanguage', 'auto');
      return {
        success: true,
        enabled,
        paused,
        pauseUntil: localData[STORAGE_KEY_PAUSE_UNTIL],
        customRules,
        whitelist,
        stats: localData[STORAGE_KEY_STATS],
        aiEnabled: syncData.aiEnabled,
        aiKeys: syncData.aiKeys,
        aiStats: localData.aiStats,
        cloudVersion: localData.cloudVersion,
        preferredLanguage,
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
      await syncSet('preferredLanguage', msg.lang);
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
      await syncSet(STORAGE_KEY_ENABLED, msg.enabled);
      await updateEffectiveState();
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
      const rules = await syncGet(STORAGE_KEY_CUSTOM_RULES, []);
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
        await syncSet(STORAGE_KEY_CUSTOM_RULES, rules);
      }
      return { success: true, rules };
    }

    case 'DELETE_CUSTOM_RULE': {
      const rules2 = (await syncGet(STORAGE_KEY_CUSTOM_RULES, [])).filter(r => r.id !== msg.ruleId);
      await syncSet(STORAGE_KEY_CUSTOM_RULES, rules2);
      return { success: true, rules: rules2 };
    }

    case 'TOGGLE_CUSTOM_RULE': {
      const rules3 = await syncGet(STORAGE_KEY_CUSTOM_RULES, []);
      const rule = rules3.find(r => r.id === msg.ruleId);
      if (rule) {
        rule.enabled = !rule.enabled;
        await syncSet(STORAGE_KEY_CUSTOM_RULES, rules3);
      }
      return { success: true, rules: rules3 };
    }

    case 'UPDATE_CUSTOM_RULE': {
      const rules4 = await syncGet(STORAGE_KEY_CUSTOM_RULES, []);
      const idx = rules4.findIndex(r => r.id === msg.ruleId);
      if (idx !== -1) {
        rules4[idx] = { ...rules4[idx], ...msg.updates };
        await syncSet(STORAGE_KEY_CUSTOM_RULES, rules4);
      }
      return { success: true, rules: rules4 };
    }

    case 'ADD_WHITELIST': {
      const list = await syncGet(STORAGE_KEY_WHITELIST, []);
      if (!list.includes(msg.domain)) {
        list.push(msg.domain);
        await syncSet(STORAGE_KEY_WHITELIST, list);
      }
      return { success: true, whitelist: list };
    }

    case 'REMOVE_WHITELIST': {
      const list2 = (await syncGet(STORAGE_KEY_WHITELIST, [])).filter(d => d !== msg.domain);
      await syncSet(STORAGE_KEY_WHITELIST, list2);
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
      const rules = await syncGet(STORAGE_KEY_CUSTOM_RULES, []);
      return { success: true, rules };
    }

    case 'IMPORT_RULES': {
      const existing = await syncGet(STORAGE_KEY_CUSTOM_RULES, []);
      const imported = msg.rules || [];
      for (const rule of imported) {
        const dup = existing.some(r => r.selector === rule.selector && r.domain === rule.domain);
        if (!dup) {
          existing.push({
            ...rule,
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            createdAt: rule.createdAt || Date.now(),
            source: 'import',
            enabled: true
          });
        }
      }
      await syncSet(STORAGE_KEY_CUSTOM_RULES, existing);
      return { success: true, rules: existing };
    }

    case 'FETCH_CLOUD_RULES': {
      return await updateCloudRules();
    }

    case 'GET_FILTER_LISTS': {
      const { state, custom } = await getFilterListsState();
      const lists = DEFAULT_FILTER_LISTS.map(l => ({
        ...l,
        enabled: state[l.id] !== undefined ? state[l.id] : l.enabled
      }));
      return { success: true, lists, custom: custom || [] };
    }

    case 'SET_FILTER_LIST_ENABLED': {
      const { state: s2 } = await getFilterListsState();
      s2[msg.id] = msg.enabled;
      await chrome.storage.local.set({ filterLists: s2 });
      return { success: true };
    }

    case 'ADD_CUSTOM_LIST': {
      const data = await chrome.storage.local.get({ customFilterLists: [] });
      const custom = data.customFilterLists;
      const exists = custom.some(l => l.url === msg.url);
      if (!exists) {
        custom.push({ id: 'custom_' + Date.now(), name: msg.name || msg.url, url: msg.url, enabled: true, custom: true });
        await chrome.storage.local.set({ customFilterLists: custom });
      }
      return { success: true, custom };
    }

    case 'REMOVE_CUSTOM_LIST': {
      const data2 = await chrome.storage.local.get({ customFilterLists: [] });
      const filtered = data2.customFilterLists.filter(l => l.id !== msg.id);
      await chrome.storage.local.set({ customFilterLists: filtered });
      return { success: true, custom: filtered };
    }

    case 'TOGGLE_CUSTOM_LIST': {
      const data3 = await chrome.storage.local.get({ customFilterLists: [] });
      const cl = data3.customFilterLists;
      const item = cl.find(l => l.id === msg.id);
      if (item) { item.enabled = !item.enabled; await chrome.storage.local.set({ customFilterLists: cl }); }
      return { success: true, custom: cl };
    }

    case 'PARENTAL_CHECK': {
      // Artık kullanılmıyor — tabs.onUpdated ile handle ediliyor
      return { success: true, blocked: false };
    }

    case 'SET_PARENTAL_ENABLED': {
      await chrome.storage.local.set({ parentalEnabled: msg.enabled });
      if (msg.enabled) {
        await loadParentalList();
      } else {
        parentalDomainSet = null;
      }
      // Content script registration güncelle
      await updateParentalScript(msg.enabled);
      return { success: true };
    }

    case 'GET_PARENTAL_STATUS': {
      const d = await chrome.storage.local.get({ parentalEnabled: false, parentalListDate: 0 });
      return {
        success: true,
        enabled: d.parentalEnabled,
        domainCount: parentalDomainSet ? parentalDomainSet.size : 0,
        lastUpdate: d.parentalListDate
      };
    }

    case 'GET_BLOCKED_SITES': {
      const sites = await syncGet('blockedSites', []);
      return { success: true, blockedSites: sites };
    }

    case 'GET_SCHEDULED_PAUSE': {
      const d = await chrome.storage.local.get({ scheduledPause: null });
      return { success: true, scheduledPause: d.scheduledPause };
    }

    case 'SET_SCHEDULED_PAUSE': {
      // msg.schedule: { enabled, startHour, startMin, endHour, endMin } veya null
      const schedule = msg.schedule;
      await chrome.storage.local.set({ scheduledPause: schedule });
      // Eski alarmları temizle
      await chrome.alarms.clear('scheduledPause_start');
      await chrome.alarms.clear('scheduledPause_end');
      if (schedule && schedule.enabled) {
        // Her gün tekrarlayan alarm — periodInMinutes: 1440 = 24 saat
        const now = new Date();
        const startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), schedule.startHour, schedule.startMin, 0).getTime();
        const endMs   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), schedule.endHour,   schedule.endMin,   0).getTime();
        const startDelay = ((startMs - Date.now()) % (24*60*60*1000) + 24*60*60*1000) % (24*60*60*1000);
        const endDelay   = ((endMs   - Date.now()) % (24*60*60*1000) + 24*60*60*1000) % (24*60*60*1000);
        chrome.alarms.create('scheduledPause_start', { delayInMinutes: startDelay / 60000, periodInMinutes: 1440 });
        chrome.alarms.create('scheduledPause_end',   { delayInMinutes: endDelay   / 60000, periodInMinutes: 1440 });
      }
      return { success: true };
    }

    case 'ADD_BLOCKED_SITE': {
      const list = await syncGet('blockedSites', []);
      const domain = msg.domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
      if (!list.find(s => s.domain === domain)) {
        list.push({ domain, redirect: msg.redirect || 'block', createdAt: Date.now() });
        await syncSet('blockedSites', list);
        await applyBlockedSiteRules(list);
      }
      return { success: true, blockedSites: list };
    }

    case 'REMOVE_BLOCKED_SITE': {
      const list = (await syncGet('blockedSites', [])).filter(s => s.domain !== msg.domain);
      await syncSet('blockedSites', list);
      await applyBlockedSiteRules(list);
      return { success: true, blockedSites: list };
    }

    case 'UPDATE_BLOCKED_SITE': {
      const list = await syncGet('blockedSites', []);
      const item = list.find(s => s.domain === msg.domain);
      if (item) {
        item.redirect = msg.redirect;
        await syncSet('blockedSites', list);
        await applyBlockedSiteRules(list);
      }
      return { success: true };
    }

    case 'GET_ACTIVE_TAB_INFO': {      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
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

// ── Parental Control ───────────────────────────────
const PARENTAL_LIST_URL = 'https://raw.githubusercontent.com/blocklistproject/Lists/master/porn.txt';
let parentalDomainSet = null; // in-memory Set, service worker restart'ta yeniden yüklenir

async function loadParentalList() {
  const { parentalEnabled, parentalListCache, parentalListDate } = await chrome.storage.local.get({
    parentalEnabled: false,
    parentalListCache: null,
    parentalListDate: 0
  });
  if (!parentalEnabled) { parentalDomainSet = null; return; }

  // 24 saatte bir güncelle
  const stale = Date.now() - parentalListDate > 24 * 60 * 60 * 1000;

  if (parentalListCache && !stale) {
    parentalDomainSet = new Set(parentalListCache);
    return;
  }

  try {
    const res = await fetch(PARENTAL_LIST_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed');
    const text = await res.text();
    const domains = [];
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      // hosts format: "0.0.0.0 domain.com"
      const parts = t.split(/\s+/);
      const domain = parts[1] || parts[0];
      if (domain && domain !== '0.0.0.0' && domain !== 'localhost') {
        domains.push(domain.toLowerCase());
      }
    }
    parentalDomainSet = new Set(domains);
    // Storage'a kaydet (max 5MB — bu liste ~8MB olabilir, sadece son 200K'yı sakla)
    await chrome.storage.local.set({
      parentalListCache: domains.slice(0, 200000),
      parentalListDate: Date.now()
    });
  } catch(e) {
    console.warn('Parental list fetch failed:', e);
    if (parentalListCache) parentalDomainSet = new Set(parentalListCache);
  }
}

function isParentalBlocked(url) {
  if (!parentalDomainSet || parentalDomainSet.size === 0) return false;
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    return parentalDomainSet.has(hostname);
  } catch { return false; }
}

// ── Blocked Sites (Manuel Engelleme) ───────────────
const BLOCKED_SITE_RULE_BASE = 9000;
let blockedSiteMap = null; // { domain: 'block'|'google' }

async function loadBlockedSiteMap() {
  const blockedSites = await syncGet('blockedSites', []);
  blockedSiteMap = blockedSites.map(s => ({
    pattern: s.domain.toLowerCase(),
    regex: patternToRegex(s.domain.toLowerCase()),
    redirect: s.redirect || 'block'
  }));
}

// "pornhub.com"    → pornhub.com ve tüm subdomainleri
// "*.pornhub.com"  → sadece subdomainler (tr.pornhub.com)
// "*.pornhub.*"    → her uzantıda pornhub (pornhub.net, tr.pornhub.org vb.)
function patternToRegex(pattern) {
  // Nokta ve özel karakterleri escape et, sonra * → .* yap
  const reStr = pattern
    .split('*')
    .map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp('^' + reStr + '$');
}

function getBlockedSiteRedirect(url) {
  if (!blockedSiteMap || blockedSiteMap.length === 0) return null;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const hostnameNoWww = hostname.replace(/^www\./, '');
    for (const entry of blockedSiteMap) {
      if (entry.regex.test(hostname) || entry.regex.test(hostnameNoWww)) {
        return entry.redirect;
      }
      // "pornhub.com" girilince subdomain'leri de yakala
      if (!entry.pattern.startsWith('*')) {
        const rootPattern = entry.pattern.replace(/^www\./, '');
        const subRegex = new RegExp('(^|\\.)' + rootPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&') + '$');
        if (subRegex.test(hostnameNoWww)) return entry.redirect;
      }
    }
    return null;
  } catch { return null; }
}

async function applyBlockedSiteRules(sites) {
  // DNR kurallarını temizle (artık tabs.onUpdated kullanıyoruz)
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const oldIds = existing.filter(r => r.id >= BLOCKED_SITE_RULE_BASE && r.id < BLOCKED_SITE_RULE_BASE + 1000).map(r => r.id);
  if (oldIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds });
  }
  // In-memory map'i güncelle
  blockedSiteMap = (sites || []).map(s => ({
    pattern: s.domain.toLowerCase(),
    regex: patternToRegex(s.domain.toLowerCase()),
    redirect: s.redirect || 'block'
  }));
}

// ── Default Filter Lists ────────────────────────────
const DEFAULT_FILTER_LISTS = [
  { id: 'easylist',           name: 'EasyList',                            url: 'https://easylist.to/easylist/easylist.txt',                                                                    enabled: false },
  { id: 'easylist_noadult',   name: 'EasyList (No Adult)',                 url: 'https://easylist-downloads.adblockplus.org/easylist_noadult.txt',                                              enabled: false },
  { id: 'easylist_noelemhide',name: 'EasyList (No Element Hiding)',        url: 'https://easylist-downloads.adblockplus.org/easylist_noelemhide.txt',                                           enabled: false },
  { id: 'easyprivacy',        name: 'EasyPrivacy',                         url: 'https://easylist.to/easylist/easyprivacy.txt',                                                                  enabled: false },
  { id: 'easyprivacy_nointl', name: 'EasyPrivacy (No International)',      url: 'https://easylist-downloads.adblockplus.org/easyprivacy_nointernational.txt',                                   enabled: false },
  { id: 'cookie',             name: 'EasyList Cookie List',                url: 'https://secure.fanboy.co.nz/fanboy-cookiemonster.txt',                                                         enabled: false },
  { id: 'annoyance',          name: "Fanboy's Annoyance List",             url: 'https://secure.fanboy.co.nz/fanboy-annoyance.txt',                                                             enabled: false },
  { id: 'social',             name: "Fanboy's Social Blocking List",       url: 'https://easylist.to/easylist/fanboy-social.txt',                                                               enabled: false },
  { id: 'antiadblock',        name: 'Adblock Warning Removal List',        url: 'https://easylist-downloads.adblockplus.org/antiadblockfilters.txt',                                            enabled: false },
  { id: 'nordic',             name: "Dandelion Sprout's Nordic Filters",   url: 'https://raw.githubusercontent.com/DandelionSprout/adfilt/master/NorwegianExperimentalList%20alternate%20versions/NordicFiltersABP-Inclusion.txt', enabled: false },
  { id: 'adguard_tr',         name: 'AdGuard Turkish Filter 🇹🇷',          url: 'https://filters.adtidy.org/extension/ublock/filters/13.txt',                                                  enabled: true  },
  { id: 'turk_adlist',        name: 'Turk Adlist (TR) 🇹🇷',               url: 'https://raw.githubusercontent.com/bkrucarci/turk-adlist/master/filters/filters.txt',                          enabled: false },

];

// ── ABP Filter Parser → DNR Rules ──────────────────
function parseAbpToDnr(text, startId) {
  const rules = [];
  let id = startId;
  const lines = text.split('\n');

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('!') || line.startsWith('[')) continue;
    // Skip snippet / extended / exception cosmetic filters
    if (line.includes('#@#') || line.includes('#?#') || line.includes('#$#')) continue;
    // Skip exception rules (@@) for now
    if (line.startsWith('@@')) continue;

    // Network filter: ||domain^  or  ||domain^$options
    const match = line.match(/^\|\|([^/^$*|]+)[\^/](\$(.+))?$/);
    if (!match) continue;

    const domain = match[1].replace(/\*$/, '').toLowerCase();
    if (!domain || domain.includes(' ') || domain.length > 253) continue;

    const optStr = match[3] || '';
    const opts = optStr ? optStr.split(',') : [];

    // Parse resource types
    const typeMap = {
      script: 'script', stylesheet: 'stylesheet', image: 'image',
      media: 'media', font: 'font', xmlhttprequest: 'xmlhttprequest',
      xhr: 'xmlhttprequest', subdocument: 'sub_frame', websocket: 'websocket',
      ping: 'ping', object: 'object', other: 'other'
    };
    let resourceTypes = [];
    for (const opt of opts) {
      const t = opt.replace('~', '').toLowerCase();
      if (typeMap[t]) resourceTypes.push(typeMap[t]);
    }
    if (resourceTypes.length === 0) {
      resourceTypes = ['script', 'image', 'xmlhttprequest', 'stylesheet', 'media', 'font', 'ping', 'object', 'other'];
    }

    rules.push({
      id: id++,
      priority: 1,
      action: { type: 'block' },
      condition: { urlFilter: `||${domain}^`, resourceTypes, isUrlFilterCaseSensitive: false }
    });

    if (id - startId >= 4000) break; // güvenlik sınırı
  }
  return rules;
}

// ── Filter List State Helpers ───────────────────────
async function getFilterListsState() {
  const data = await chrome.storage.local.get({ filterLists: null, customFilterLists: [] });
  // İlk çalıştırmada default state'i yaz
  if (!data.filterLists) {
    const defaultState = {};
    DEFAULT_FILTER_LISTS.forEach(l => { defaultState[l.id] = l.enabled; });
    await chrome.storage.local.set({ filterLists: defaultState });
    return { state: defaultState, custom: data.customFilterLists };
  }
  return { state: data.filterLists, custom: data.customFilterLists };
}

// ── ABP Cosmetic (##) Parser ────────────────────────
function parseAbpCosmetic(text) {
  // Returns array of { domain: string|null, selector: string }
  const rules = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('!') || line.startsWith('[')) continue;
    // Only ## rules (element hiding), skip exceptions (#@#) and extended (#?#, #$#)
    if (!line.includes('##') || line.includes('#@#') || line.includes('#?#') || line.includes('#$#')) continue;

    const sepIdx = line.indexOf('##');
    const domainPart = line.slice(0, sepIdx).trim();
    const selector = line.slice(sepIdx + 2).trim();
    if (!selector) continue;

    if (!domainPart) {
      // Generic rule — applies everywhere
      rules.push({ domain: null, selector });
    } else {
      // May be comma-separated list of domains
      for (const d of domainPart.split(',')) {
        const domain = d.trim().toLowerCase();
        if (domain) rules.push({ domain, selector });
      }
    }

    if (rules.length >= 20000) break; // güvenlik sınırı
  }
  return rules;
}

// ── Cloud Rule Update Logic ─────────────────────────
async function updateCloudRules() {
  try {
    const { state, custom } = await getFilterListsState();

    // Aktif listeleri topla
    const activeLists = DEFAULT_FILTER_LISTS.filter(l => state[l.id] !== false && state[l.id] !== undefined ? state[l.id] : l.enabled);
    const activeCustom = (custom || []).filter(l => l.enabled !== false);

    const allLists = [...activeLists, ...activeCustom];

    let allRules = [];
    let idCounter = 2000;
    let allCosmeticRules = [];

    for (const list of allLists) {
      try {
        const res = await fetch(list.url, { cache: 'no-store' }).catch(() => null);
        if (!res || res.status !== 200) continue;
        const text = await res.text();
        const parsed = parseAbpToDnr(text, idCounter);
        idCounter += parsed.length + 1;
        allRules = allRules.concat(parsed);

        // Cosmetic (##) kurallarını da parse et
        const cosmetic = parseAbpCosmetic(text);
        allCosmeticRules = allCosmeticRules.concat(cosmetic);

        if (allRules.length >= 5000) break;
      } catch(e) { /* liste atla */ }
    }

    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    const oldIds = oldRules.map(r => r.id);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldIds,
      addRules: allRules.slice(0, 5000)
    });

    // Cosmetic kuralları storage'a yaz (max 20K)
    await chrome.storage.local.set({ cosmeticRules: allCosmeticRules.slice(0, 20000) });

    const now = new Date();
    const version = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    await chrome.storage.local.set({ cloudVersion: version, lastCloudUpdate: Date.now() });
    return { success: true, version, ruleCount: allRules.length, cosmeticCount: allCosmeticRules.length };
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

// ── Tab Redirect (Parental + Manuel Engelleme) ─────
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return; // sadece main frame
  if (!details.url || !details.url.startsWith('http')) return;

  // -- Manuel engellenen siteler --
  if (!blockedSiteMap) await loadBlockedSiteMap();
  const redirectType = getBlockedSiteRedirect(details.url);
  if (redirectType !== null) {
    if (redirectType === 'google') {
      chrome.tabs.update(details.tabId, { url: 'https://www.google.com/' }).catch(() => {});
    } else {
      const domain = new URL(details.url).hostname;
      const blockedUrl = chrome.runtime.getURL('popup/blocked.html') + '#' + encodeURIComponent(domain);
      chrome.tabs.update(details.tabId, { url: blockedUrl }).catch(() => {});
    }
    return;
  }

  // -- Ebeveyn filtresi --
  const { parentalEnabled } = await chrome.storage.local.get({ parentalEnabled: false });
  if (!parentalEnabled) return;

  if (!parentalDomainSet || parentalDomainSet.size === 0) {
    await loadParentalList();
  }
  if (!isParentalBlocked(details.url)) return;

  const domain = new URL(details.url).hostname;
  const blockedUrl = chrome.runtime.getURL('popup/blocked.html') + '#' + encodeURIComponent(domain);
  chrome.tabs.update(details.tabId, { url: blockedUrl }).catch(() => {});
});

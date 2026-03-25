// AdShield Pro — Firefox Background Script
// Chrome sürümünden farklar:
//   1. scripting.registerContentScripts kaldırıldı (world:'MAIN' Firefox'ta yok)
//      Content script'ler manifest.json'da statik olarak tanımlı.
//   2. declarativeNetRequestFeedback permission yok — sadece DNR ruleset'leri açılıp kapatılıyor.

const STORAGE_KEY_ENABLED       = 'enabled';
const STORAGE_KEY_PAUSE_UNTIL   = 'pauseUntil';
const STORAGE_KEY_CUSTOM_RULES  = 'customRules';
const STORAGE_KEY_WHITELIST     = 'whitelist';
const STORAGE_KEY_STATS         = 'stats';
const STORAGE_KEY_AD_SKIP_DURATION = 'adSkipDuration';
const STORAGE_KEY_AUTO_CLICK_MAX   = 'autoClickMax';
const RULESET_IDS = ['yt_rules', 'general_rules', 'general_rules_2'];

// ── Sync Storage Helpers (chunk desteğiyle) ──────────
const SYNC_CHUNK_SIZE = 6000;

async function syncSet(key, value) {
  const json = JSON.stringify(value);
  const keysToRemove = [];
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

let isUpdatingState = false;

// Firefox'ta scripting.registerContentScripts + world:'MAIN' desteklenmez.
// Content script'ler manifest.json'da statik tanımlı olduğundan burada
// sadece DNR ruleset'lerini açıp kapatmak yeterli.
async function applyRulesetState(enabled) {
  const options = enabled
    ? { enableRulesetIds: RULESET_IDS, disableRulesetIds: [] }
    : { enableRulesetIds: [], disableRulesetIds: RULESET_IDS };

  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets(options);
    if (!enabled) {
      const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
      const dynamicIds = dynamicRules.map(r => r.id);
      if (dynamicIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: dynamicIds });
        await chrome.storage.local.set({ cloudVersion: 'Devre Dışı' });
      }
    } else {
      updateCloudRules();
    }
  } catch(e) {}
}

async function isPaused() {
  const { [STORAGE_KEY_PAUSE_UNTIL]: pauseUntil } = await chrome.storage.local.get({ [STORAGE_KEY_PAUSE_UNTIL]: 0 });
  return Date.now() < Number(pauseUntil || 0);
}

async function updateEffectiveState() {
  if (isUpdatingState) return;
  isUpdatingState = true;
  try {
    const paused  = await isPaused();
    const enabled = await getEnabled();
    const effective = enabled && !paused;
    await applyRulesetState(effective);
    await setBadge(effective);
  } finally {
    isUpdatingState = false;
  }
}

// ── Parental Script (Firefox'ta sadece temizleme) ────
async function updateParentalScript(_enabled) {
  // Firefox'ta scripting.registerContentScripts kullanmıyoruz.
  // Parental guard inject'i tabs.onUpdated / webNavigation ile yapılıyor.
}

async function init() {
  await updateEffectiveState();
  const blockedSites = await syncGet('blockedSites', []);
  const { parentalEnabled } = await chrome.storage.local.get({ parentalEnabled: false });
  if (blockedSites.length > 0) await applyBlockedSiteRules(blockedSites);
  else await loadBlockedSiteMap();
  if (parentalEnabled) {
    await loadParentalList();
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const localData = await chrome.storage.local.get([
    'aiEnabled', 'aiKeys',
    STORAGE_KEY_ENABLED, STORAGE_KEY_WHITELIST, STORAGE_KEY_CUSTOM_RULES,
    'preferredLanguage', 'blockedSites'
  ]);
  const syncData = await chrome.storage.sync.get(null);

  if (localData.aiEnabled !== undefined && syncData.aiEnabled === undefined) {
    await chrome.storage.sync.set({ aiEnabled: localData.aiEnabled });
  }
  if (localData.aiKeys?.length && !syncData.aiKeys?.length) {
    await chrome.storage.sync.set({ aiKeys: localData.aiKeys });
  }

  const enabledVal = syncData[STORAGE_KEY_ENABLED] !== undefined
    ? syncData[STORAGE_KEY_ENABLED]
    : (localData[STORAGE_KEY_ENABLED] !== undefined ? localData[STORAGE_KEY_ENABLED] : true);
  await syncSet(STORAGE_KEY_ENABLED, enabledVal);

  const wl = await syncGet(STORAGE_KEY_WHITELIST, null);
  if (wl === null) await syncSet(STORAGE_KEY_WHITELIST, localData[STORAGE_KEY_WHITELIST] || []);

  const cr = await syncGet(STORAGE_KEY_CUSTOM_RULES, null);
  if (cr === null) await syncSet(STORAGE_KEY_CUSTOM_RULES, localData[STORAGE_KEY_CUSTOM_RULES] || []);

  const lang = await syncGet('preferredLanguage', null);
  if (lang === null) await syncSet('preferredLanguage', localData.preferredLanguage || 'auto');

  const bs = await syncGet('blockedSites', null);
  if (bs === null) await syncSet('blockedSites', localData.blockedSites || []);

  const stats = await chrome.storage.local.get(STORAGE_KEY_STATS);
  if (!stats[STORAGE_KEY_STATS]) {
    await chrome.storage.local.set({ [STORAGE_KEY_STATS]: { total: 0, daily: {}, byDomain: {} } });
  }

  chrome.alarms.create('cloudUpdate', { periodInMinutes: 8 * 60 });
  chrome.alarms.create('checkState',   { periodInMinutes: 1 });

  await init();
});

chrome.runtime.onStartup.addListener(() => { init(); });

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (
    (area === 'sync' && STORAGE_KEY_ENABLED in changes) ||
    (area === 'local' && STORAGE_KEY_PAUSE_UNTIL in changes)
  ) {
    await updateEffectiveState();
  }
  if (area === 'sync' && ('blockedSites' in changes || 'blockedSites_n' in changes)) {
    if (!_applyingBlockedSites) {
      const sites = await syncGet('blockedSites', []);
      await applyBlockedSiteRules(sites);
    }
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cloudUpdate') {
    updateCloudRules();
  } else if (alarm.name === 'checkState') {
    updateEffectiveState();
  }
  if (alarm.name && alarm.name.startsWith('scheduledPause_')) {
    const action = alarm.name.split('_')[1];
    if (action === 'start') {
      chrome.storage.local.set({ [STORAGE_KEY_PAUSE_UNTIL]: Date.now() + 24 * 60 * 60 * 1000 });
      updateEffectiveState();
    } else if (action === 'end') {
      chrome.storage.local.set({ [STORAGE_KEY_PAUSE_UNTIL]: 0 });
      updateEffectiveState();
    }
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle_extension') {
    const enabled = await getEnabled();
    await syncSet(STORAGE_KEY_ENABLED, !enabled);
    await updateEffectiveState();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch(e => {
    console.error('Message handler error:', e);
    sendResponse({ success: false, error: e.message });
  });
  return true;
});

async function handleMessage(msg, sender) {
  switch(msg.type) {
    case 'GET_STATE': {
      const enabled = await getEnabled();
      const paused  = await isPaused();
      const syncData  = await chrome.storage.sync.get({ aiEnabled: false, aiKeys: [] });
      const localData = await chrome.storage.local.get({
        [STORAGE_KEY_STATS]: { total: 0, daily: {}, byDomain: {} },
        [STORAGE_KEY_PAUSE_UNTIL]: 0,
        aiStats: { tokens: 0, blocked: 0 },
        cloudVersion: '1.0',
        [STORAGE_KEY_AD_SKIP_DURATION]: 15,
        [STORAGE_KEY_AUTO_CLICK_MAX]: 1
      });
      const customRules       = await syncGet(STORAGE_KEY_CUSTOM_RULES, []);
      const whitelist         = await syncGet(STORAGE_KEY_WHITELIST, []);
      const preferredLanguage = await syncGet('preferredLanguage', 'auto');
      return {
        success: true, enabled, paused,
        pauseUntil: localData[STORAGE_KEY_PAUSE_UNTIL],
        customRules, whitelist,
        stats: localData[STORAGE_KEY_STATS],
        aiEnabled: syncData.aiEnabled, aiKeys: syncData.aiKeys,
        aiStats: localData.aiStats, cloudVersion: localData.cloudVersion,
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
      if (!keys.some(k => (k.key || k) === newInfo.key)) {
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
      const syncData  = await chrome.storage.sync.get({ aiEnabled: false, aiKeys: [] });
      const localData = await chrome.storage.local.get({ aiStats: { tokens: 0, blocked: 0 } });
      if (!syncData.aiEnabled || !syncData.aiKeys?.length) return { success: false, error: 'AI disabled or no keys' };
      const text = msg.text;
      if (!text || text.length < 15) return { success: false, isClickbait: false };
      const prompt = `Lütfen aşağıdaki içeriğin "tıklama tuzağı (clickbait)" mi, yoksa gizli/reklam/sponsorlu mu olduğunu sadece "EVET" veya "HAYIR" diyerek cevapla. Açıklama yapma.\n\nİçerik: "${text}"`;
      for (const keyItem of syncData.aiKeys) {
        try {
          const actualKey = keyItem.key || keyItem;
          let model = keyItem.model || 'models/gemini-2.5-flash';
          if (!model.startsWith('models/')) model = 'models/' + model;
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent?key=${actualKey}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 5 } })
          });
          if (res.status === 429) continue;
          const result = await res.json();
          if (result.candidates?.[0]?.content?.parts) {
            const answer = result.candidates[0].content.parts[0].text.trim().toUpperCase();
            const isClickbait = answer.includes('EVET');
            const stats = localData.aiStats;
            if (result.usageMetadata?.totalTokenCount) stats.tokens += result.usageMetadata.totalTokenCount;
            if (isClickbait) stats.blocked += 1;
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
      await chrome.storage.local.set({ [STORAGE_KEY_PAUSE_UNTIL]: Date.now() + (msg.minutes * 60 * 1000) });
      await updateEffectiveState();
      return { success: true };
    }
    case 'RESUME': {
      await chrome.storage.local.set({ [STORAGE_KEY_PAUSE_UNTIL]: 0 });
      await updateEffectiveState();
      return { success: true };
    }
    case 'ADD_CUSTOM_RULE': {
      const rules = await syncGet(STORAGE_KEY_CUSTOM_RULES, []);
      if (!rules.some(r => r.selector === msg.rule.selector && r.domain === msg.rule.domain)) {
        rules.push({
          id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
          selector: msg.rule.selector, domain: msg.rule.domain || '',
          allSites: msg.rule.allSites || false, createdAt: msg.rule.createdAt || Date.now(),
          source: msg.rule.source || 'manual', enabled: true
        });
        await syncSet(STORAGE_KEY_CUSTOM_RULES, rules);
      }
      return { success: true, rules };
    }
    case 'DELETE_CUSTOM_RULE': {
      const rules = (await syncGet(STORAGE_KEY_CUSTOM_RULES, [])).filter(r => r.id !== msg.ruleId);
      await syncSet(STORAGE_KEY_CUSTOM_RULES, rules);
      return { success: true, rules };
    }
    case 'TOGGLE_CUSTOM_RULE': {
      const rules = await syncGet(STORAGE_KEY_CUSTOM_RULES, []);
      const rule = rules.find(r => r.id === msg.ruleId);
      if (rule) { rule.enabled = !rule.enabled; await syncSet(STORAGE_KEY_CUSTOM_RULES, rules); }
      return { success: true, rules };
    }
    case 'UPDATE_CUSTOM_RULE': {
      const rules = await syncGet(STORAGE_KEY_CUSTOM_RULES, []);
      const idx = rules.findIndex(r => r.id === msg.ruleId);
      if (idx !== -1) { rules[idx] = { ...rules[idx], ...msg.updates }; await syncSet(STORAGE_KEY_CUSTOM_RULES, rules); }
      return { success: true, rules };
    }
    case 'ADD_WHITELIST': {
      const list = await syncGet(STORAGE_KEY_WHITELIST, []);
      if (!list.includes(msg.domain)) { list.push(msg.domain); await syncSet(STORAGE_KEY_WHITELIST, list); }
      return { success: true, whitelist: list };
    }
    case 'REMOVE_WHITELIST': {
      const list = (await syncGet(STORAGE_KEY_WHITELIST, [])).filter(d => d !== msg.domain);
      await syncSet(STORAGE_KEY_WHITELIST, list);
      return { success: true, whitelist: list };
    }
    case 'GET_STATS': {
      const data = await chrome.storage.local.get({ [STORAGE_KEY_STATS]: { total: 0, daily: {}, byDomain: {} } });
      return { success: true, stats: data[STORAGE_KEY_STATS] };
    }
    case 'RESET_STATS': {
      await chrome.storage.local.set({ [STORAGE_KEY_STATS]: { total: 0, daily: {}, byDomain: {} } });
      return { success: true };
    }
    case 'ACTIVATE_PICKER': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_PICKER' });
        } catch(e) {
          try {
            await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/element-picker.js'] });
            await new Promise(r => setTimeout(r, 200));
            await chrome.tabs.sendMessage(tab.id, { type: 'ACTIVATE_PICKER' });
          } catch(e2) {}
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
      for (const rule of (msg.rules || [])) {
        if (!existing.some(r => r.selector === rule.selector && r.domain === rule.domain)) {
          existing.push({ ...rule, id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5), createdAt: rule.createdAt || Date.now(), source: 'import', enabled: true });
        }
      }
      await syncSet(STORAGE_KEY_CUSTOM_RULES, existing);
      return { success: true, rules: existing };
    }
    case 'FETCH_CLOUD_RULES':       return await updateCloudRules();
    case 'GET_FILTER_LISTS': {
      const { state, custom } = await getFilterListsState();
      const lists = DEFAULT_FILTER_LISTS.map(l => ({ ...l, enabled: state[l.id] !== undefined ? state[l.id] : l.enabled }));
      return { success: true, lists, custom: custom || [] };
    }
    case 'SET_FILTER_LIST_ENABLED': {
      const { state } = await getFilterListsState();
      state[msg.id] = msg.enabled;
      await chrome.storage.local.set({ filterLists: state });
      return { success: true };
    }
    case 'ADD_CUSTOM_LIST': {
      const data = await chrome.storage.local.get({ customFilterLists: [] });
      const custom = data.customFilterLists;
      if (!custom.some(l => l.url === msg.url)) {
        custom.push({ id: 'custom_' + Date.now(), name: msg.name || msg.url, url: msg.url, enabled: true, custom: true });
        await chrome.storage.local.set({ customFilterLists: custom });
      }
      return { success: true, custom };
    }
    case 'REMOVE_CUSTOM_LIST': {
      const data = await chrome.storage.local.get({ customFilterLists: [] });
      const filtered = data.customFilterLists.filter(l => l.id !== msg.id);
      await chrome.storage.local.set({ customFilterLists: filtered });
      return { success: true, custom: filtered };
    }
    case 'TOGGLE_CUSTOM_LIST': {
      const data = await chrome.storage.local.get({ customFilterLists: [] });
      const cl = data.customFilterLists;
      const item = cl.find(l => l.id === msg.id);
      if (item) { item.enabled = !item.enabled; await chrome.storage.local.set({ customFilterLists: cl }); }
      return { success: true, custom: cl };
    }
    case 'PARENTAL_CHECK':          return { success: true, blocked: false };
    case 'SET_PARENTAL_ENABLED': {
      await chrome.storage.local.set({ parentalEnabled: msg.enabled });
      if (msg.enabled) await loadParentalList(); else parentalDomainSet = null;
      return { success: true };
    }
    case 'GET_PARENTAL_STATUS': {
      const d = await chrome.storage.local.get({ parentalEnabled: false, parentalListDate: 0 });
      return { success: true, enabled: d.parentalEnabled, domainCount: parentalDomainSet?.size || 0, lastUpdate: d.parentalListDate };
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
      const schedule = msg.schedule;
      await chrome.storage.local.set({ scheduledPause: schedule });
      await chrome.alarms.clear('scheduledPause_start');
      await chrome.alarms.clear('scheduledPause_end');
      if (schedule?.enabled) {
        const now = new Date();
        const startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), schedule.startHour, schedule.startMin, 0).getTime();
        const endMs   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), schedule.endHour,   schedule.endMin,   0).getTime();
        const startDelay = ((startMs - Date.now()) % 86400000 + 86400000) % 86400000;
        const endDelay   = ((endMs   - Date.now()) % 86400000 + 86400000) % 86400000;
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
      if (item) { item.redirect = msg.redirect; await syncSet('blockedSites', list); await applyBlockedSiteRules(list); }
      return { success: true };
    }
    case 'GET_ACTIVE_TAB_INFO': {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        let hostname = '';
        try { hostname = new URL(tab.url).hostname; } catch(e) {}
        return { success: true, url: tab.url, hostname, title: tab.title };
      }
      return { success: false };
    }
    default:
      return { success: false, error: 'Unknown message type' };
  }
}

// ── Parental Control ─────────────────────────────────
const PARENTAL_LIST_URL = 'https://raw.githubusercontent.com/blocklistproject/Lists/master/porn.txt';
let parentalDomainSet = null;

async function loadParentalList() {
  const { parentalEnabled, parentalListCache, parentalListDate } = await chrome.storage.local.get({
    parentalEnabled: false, parentalListCache: null, parentalListDate: 0
  });
  if (!parentalEnabled) { parentalDomainSet = null; return; }
  const stale = Date.now() - parentalListDate > 24 * 60 * 60 * 1000;
  if (parentalListCache && !stale) { parentalDomainSet = new Set(parentalListCache); return; }
  try {
    const res = await fetch(PARENTAL_LIST_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed');
    const text = await res.text();
    const domains = [];
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const parts = t.split(/\s+/);
      const domain = parts[1] || parts[0];
      if (domain && domain !== '0.0.0.0' && domain !== 'localhost') domains.push(domain.toLowerCase());
    }
    parentalDomainSet = new Set(domains);
    await chrome.storage.local.set({ parentalListCache: domains.slice(0, 200000), parentalListDate: Date.now() });
  } catch(e) {
    console.warn('Parental list fetch failed:', e);
    if (parentalListCache) parentalDomainSet = new Set(parentalListCache);
  }
}

function isParentalBlocked(url) {
  if (!parentalDomainSet?.size) return false;
  try { return parentalDomainSet.has(new URL(url).hostname.toLowerCase().replace(/^www\./, '')); } catch { return false; }
}

// ── Blocked Sites ─────────────────────────────────────
const BLOCKED_SITE_RULE_BASE = 9000;
let blockedSiteMap = null;
let _applyingBlockedSites = false;

async function loadBlockedSiteMap() {
  const blockedSites = await syncGet('blockedSites', []);
  blockedSiteMap = blockedSites.map(s => ({
    pattern: s.domain.toLowerCase(),
    regex: patternToRegex(s.domain.toLowerCase()),
    redirect: s.redirect || 'block'
  }));
}

function patternToRegex(pattern) {
  const reStr = pattern.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + reStr + '$');
}

function getBlockedSiteRedirect(url) {
  if (!blockedSiteMap?.length) return null;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const hostnameNoWww = hostname.replace(/^www\./, '');
    for (const entry of blockedSiteMap) {
      if (entry.regex.test(hostname) || entry.regex.test(hostnameNoWww)) return entry.redirect;
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
  _applyingBlockedSites = true;
  try {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const oldIds = existing.filter(r => r.id >= BLOCKED_SITE_RULE_BASE && r.id < BLOCKED_SITE_RULE_BASE + 1000).map(r => r.id);
    if (oldIds.length > 0) await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldIds });
    blockedSiteMap = (sites || []).map(s => ({
      pattern: s.domain.toLowerCase(),
      regex: patternToRegex(s.domain.toLowerCase()),
      redirect: s.redirect || 'block'
    }));
  } finally {
    setTimeout(() => { _applyingBlockedSites = false; }, 500);
  }
}

// ── Default Filter Lists ──────────────────────────────
const DEFAULT_FILTER_LISTS = [
  { id: 'easylist',            name: 'EasyList',                          url: 'https://easylist.to/easylist/easylist.txt',                                                                                                                    enabled: false },
  { id: 'easylist_noadult',    name: 'EasyList (No Adult)',               url: 'https://easylist-downloads.adblockplus.org/easylist_noadult.txt',                                                                                             enabled: false },
  { id: 'easylist_noelemhide', name: 'EasyList (No Element Hiding)',      url: 'https://easylist-downloads.adblockplus.org/easylist_noelemhide.txt',                                                                                          enabled: false },
  { id: 'easyprivacy',         name: 'EasyPrivacy',                       url: 'https://easylist.to/easylist/easyprivacy.txt',                                                                                                                 enabled: false },
  { id: 'easyprivacy_nointl',  name: 'EasyPrivacy (No International)',    url: 'https://easylist-downloads.adblockplus.org/easyprivacy_nointernational.txt',                                                                                  enabled: false },
  { id: 'cookie',              name: 'EasyList Cookie List',              url: 'https://secure.fanboy.co.nz/fanboy-cookiemonster.txt',                                                                                                        enabled: false },
  { id: 'annoyance',           name: "Fanboy's Annoyance List",           url: 'https://secure.fanboy.co.nz/fanboy-annoyance.txt',                                                                                                            enabled: false },
  { id: 'social',              name: "Fanboy's Social Blocking List",     url: 'https://easylist.to/easylist/fanboy-social.txt',                                                                                                              enabled: false },
  { id: 'antiadblock',         name: 'Adblock Warning Removal List',      url: 'https://easylist-downloads.adblockplus.org/antiadblockfilters.txt',                                                                                           enabled: false },
  { id: 'nordic',              name: "Dandelion Sprout's Nordic Filters", url: 'https://raw.githubusercontent.com/DandelionSprout/adfilt/master/NorwegianExperimentalList%20alternate%20versions/NordicFiltersABP-Inclusion.txt',            enabled: false },
  { id: 'adguard_tr',          name: 'AdGuard Turkish Filter 🇹🇷',        url: 'https://filters.adtidy.org/extension/ublock/filters/13.txt',                                                                                                  enabled: true  },
  { id: 'turk_adlist',         name: 'Turk Adlist (TR) 🇹🇷',             url: 'https://raw.githubusercontent.com/bkrucarci/turk-adlist/master/filters/filters.txt',                                                                         enabled: false },
];

function parseAbpToDnr(text, startId) {
  const rules = [];
  let id = startId;
  const typeMap = { script:'script', stylesheet:'stylesheet', image:'image', media:'media', font:'font', xmlhttprequest:'xmlhttprequest', xhr:'xmlhttprequest', subdocument:'sub_frame', websocket:'websocket', ping:'ping', object:'object', other:'other' };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('!') || line.startsWith('[')) continue;
    if (line.includes('#@#') || line.includes('#?#') || line.includes('#$#')) continue;
    if (line.startsWith('@@')) continue;
    const match = line.match(/^\|\|([^/^$*|]+)[\^/](\$(.+))?$/);
    if (!match) continue;
    const domain = match[1].replace(/\*$/, '').toLowerCase();
    if (!domain || domain.includes(' ') || domain.length > 253) continue;
    const opts = (match[3] || '').split(',');
    let resourceTypes = opts.map(o => typeMap[o.replace('~','').toLowerCase()]).filter(Boolean);
    if (!resourceTypes.length) resourceTypes = ['script','image','xmlhttprequest','stylesheet','media','font','ping','object','other'];
    rules.push({ id: id++, priority: 1, action: { type: 'block' }, condition: { urlFilter: `||${domain}^`, resourceTypes, isUrlFilterCaseSensitive: false } });
    if (id - startId >= 4000) break;
  }
  return rules;
}

function parseAbpCosmetic(text) {
  const rules = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('!') || line.startsWith('[')) continue;
    if (!line.includes('##') || line.includes('#@#') || line.includes('#?#') || line.includes('#$#')) continue;
    const sepIdx = line.indexOf('##');
    const domainPart = line.slice(0, sepIdx).trim();
    const selector   = line.slice(sepIdx + 2).trim();
    if (!selector) continue;
    if (!domainPart) {
      rules.push({ domain: null, selector });
    } else {
      for (const d of domainPart.split(',')) {
        const domain = d.trim().toLowerCase();
        if (domain) rules.push({ domain, selector });
      }
    }
    if (rules.length >= 20000) break;
  }
  return rules;
}

async function getFilterListsState() {
  const data = await chrome.storage.local.get({ filterLists: null, customFilterLists: [] });
  if (!data.filterLists) {
    const defaultState = {};
    DEFAULT_FILTER_LISTS.forEach(l => { defaultState[l.id] = l.enabled; });
    await chrome.storage.local.set({ filterLists: defaultState });
    return { state: defaultState, custom: data.customFilterLists };
  }
  return { state: data.filterLists, custom: data.customFilterLists };
}

async function updateCloudRules() {
  try {
    const { state, custom } = await getFilterListsState();
    const activeLists  = DEFAULT_FILTER_LISTS.filter(l => state[l.id] !== undefined ? state[l.id] : l.enabled);
    const activeCustom = (custom || []).filter(l => l.enabled !== false);
    const allLists = [...activeLists, ...activeCustom];
    let allRules = [], idCounter = 2000, allCosmeticRules = [];
    for (const list of allLists) {
      try {
        const res = await fetch(list.url, { cache: 'no-store' }).catch(() => null);
        if (!res || res.status !== 200) continue;
        const text = await res.text();
        const parsed = parseAbpToDnr(text, idCounter);
        idCounter += parsed.length + 1;
        allRules = allRules.concat(parsed);
        allCosmeticRules = allCosmeticRules.concat(parseAbpCosmetic(text));
        if (allRules.length >= 5000) break;
      } catch(e) {}
    }
    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: oldRules.map(r => r.id), addRules: allRules.slice(0, 5000) });
    await chrome.storage.local.set({ cosmeticRules: allCosmeticRules.slice(0, 20000) });
    const now = new Date();
    const version = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    await chrome.storage.local.set({ cloudVersion: version, lastCloudUpdate: Date.now() });
    return { success: true, version, ruleCount: allRules.length, cosmeticCount: allCosmeticRules.length };
  } catch(e) {
    console.error('Cloud update error:', e);
    return { success: false, error: e.message };
  }
}

// ── Tab Redirect (Parental + Manuel Engelleme) ────────
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (!details.url?.startsWith('http')) return;

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

  const { parentalEnabled } = await chrome.storage.local.get({ parentalEnabled: false });
  if (!parentalEnabled) return;
  if (!parentalDomainSet?.size) await loadParentalList();
  if (!isParentalBlocked(details.url)) return;

  const domain = new URL(details.url).hostname;
  const blockedUrl = chrome.runtime.getURL('popup/blocked.html') + '#' + encodeURIComponent(domain);
  chrome.tabs.update(details.tabId, { url: blockedUrl }).catch(() => {});
});

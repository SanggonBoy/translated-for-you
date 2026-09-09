// Translated For You - background service worker
// Handles translation requests from content scripts and popup.

// Translation via Google Translate free endpoint (translate.googleapis.com, no API key).
async function translateText(text, sourceLang, targetLang) {
  // Quick sanity check before hitting network
  if (!text || !text.trim()) return { ok: true, text: '' };

  // Better to send long text via POST (GET URL would overflow)
  const url = 'https://translate.googleapis.com/translate_a/single';
  const body = new URLSearchParams({
    client: 'gtx',
    dt: 't',
    sl: sourceLang || 'auto',
    tl: targetLang || 'id',
    q: text,
  });

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const json = await resp.json();
    const translated = json[0]
      .map((seg) => seg[0])
      .join('')
      .trim();
    const detected = json[2] || sourceLang || null;

    return { ok: true, text: translated, detected };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Keyboard shortcut (customizable at chrome://extensions/shortcuts)
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'translate-selection') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'EXECUTE_TRANSLATE' });
  } catch {
    // content script not in this tab yet (tab opened before install/reload)
    // → inject on demand and retry, instead of failing silently
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await chrome.tabs.sendMessage(tab.id, { type: 'EXECUTE_TRANSLATE' });
    } catch {
      // chrome:// pages, Chrome Web Store, etc. — no page to translate in
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'TRANSLATE') {
    (async () => {
      let r = await translateText(msg.text, msg.sourceLang, msg.targetLang);
      // Auto-flip: text already in target language → translate the other way
      if (r.ok && msg.autoFlip && r.detected && r.detected === msg.targetLang) {
        r = await translateText(msg.text, msg.targetLang, 'id');
      }
      sendResponse(r);
    })();
    return true; // async response
  }
  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (s) => sendResponse(s));
    return true;
  }
});

// Defaults — kept here so popup and background stay in sync
const DEFAULT_SETTINGS = {
  targetLang: 'en',
  sourceLang: 'auto',
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(null, (settings) => {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    chrome.storage.sync.set(merged);
  });
});

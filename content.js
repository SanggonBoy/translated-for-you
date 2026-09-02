// Translated For You - content script
// Receives EXECUTE_TRANSLATE from background (chrome.commands), translates
// the selection or active input, and replaces it in-place.

// --- Text extraction ---------------------------------------------------
// Priority: 1) explicit selection  2) active input/textarea/contenteditable
function getActiveText() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const t = sel.toString();
    if (t.trim()) return { text: t, mode: 'selection' };
  }

  const el = document.activeElement;
  if (!el || el === document.body) return { text: '', mode: null };

  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') {
    const { selectionStart: s, selectionEnd: e, value } = el;
    return { text: s !== e ? value.substring(s, e) : value, mode: 'input' };
  }
  if (el.isContentEditable) {
    return { text: el.innerText || el.textContent || '', mode: 'editable' };
  }
  return { text: '', mode: null };
}

// --- Text replacement --------------------------------------------------
// execCommand('insertText') is the only method that fires proper input
// events for React/WhatsApp Web — direct .value/textContent writes get
// ignored by their state sync.
function replaceText(newText, mode) {
  const el = document.activeElement;

  if (mode === 'input' && (el.tagName.toLowerCase() === 'input' || el.tagName.toLowerCase() === 'textarea')) {
    el.focus();
    if (el.selectionStart !== el.selectionEnd) {
      // selection already covers the translated span — replace it
    } else {
      el.setSelectionRange(0, el.value.length); // replace whole value
    }
    return document.execCommand('insertText', false, newText);
  }

  if (mode === 'editable' && el.isContentEditable) {
    el.focus();
    const sel = window.getSelection();
    if (sel.rangeCount > 0 && !sel.isCollapsed) {
      return document.execCommand('insertText', false, newText);
    }
    // no selection → select all inside the editable, then replace
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    return document.execCommand('insertText', false, newText);
  }

  if (mode === 'selection') {
    return document.execCommand('insertText', false, newText);
  }

  return false;
}

// --- Toast ---------------------------------------------------------------
function showToast(msg, isError) {
  let toast = document.getElementById('_qt_toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = '_qt_toast';
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
      background: #1e3a5f; color: #fff; padding: 12px 20px; border-radius: 8px;
      font-family: 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.4;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); max-width: 360px;
      opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.background = isError ? '#8b1a1a' : '#1e3a5f';
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
}

// --- Main handler ----------------------------------------------------------
async function handleTranslate() {
  const { text, mode } = getActiveText();
  if (!text || !text.trim()) {
    showToast('Tidak ada teks untuk diterjemahkan', true);
    return;
  }

  const settings = await chrome.storage.sync.get({
    targetLang: 'en',
    sourceLang: 'auto',
    autoFlip: true, // if text is already in target lang → translate to ID instead
  });

  chrome.runtime.sendMessage(
    { type: 'TRANSLATE', text, sourceLang: settings.sourceLang, targetLang: settings.targetLang, autoFlip: settings.autoFlip },
    (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        showToast('Translate gagal: ' + (response?.error || chrome.runtime.lastError?.message || 'unknown'), true);
        return;
      }
      if (!replaceText(response.text, mode)) {
        // last resort: clipboard
        navigator.clipboard.writeText(response.text).then(
          () => showToast('✓ Disalin ke clipboard — Ctrl+V untuk menempel'),
          () => showToast('Translate gagal: tidak bisa mengganti teks', true)
        );
      }
    }
  );
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EXECUTE_TRANSLATE') {
    handleTranslate();
    sendResponse({ ok: true });
  }
});

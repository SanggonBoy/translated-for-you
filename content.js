// Translated For You - content script
// Receives EXECUTE_TRANSLATE from background (chrome.commands), translates
// the selection or active input, and replaces it in-place.
//
// Replacement is editor-adaptive so it works on ANY site with no per-site
// code:
//   1. <input>/<textarea> -> set the value via the prototype's native
//      setter + dispatch a bubbling 'input' event, so React/Vue/Angular
//      state stays in sync (no dead keyboard or desync afterwards).
//   2. contenteditable inside modern rich editors (Slate -> Discord,
//      Lexical -> WhatsApp Web, ProseMirror, Quill 2) -> synthetic
//      'beforeinput' InputEvent. The editor performs the edit through its
//      own model, so DOM and internal state never diverge (no overlap).
//   3. anything else -> document.execCommand('insertText') fallback.

// --- Text extraction -----------------------------------------------------
// Priority: 1) explicit selection  2) active input/textarea/contenteditable
function getActiveText() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const t = sel.toString();
    if (t.trim()) {
      const node = sel.getRangeAt(0).startContainer;
      const host = node.nodeType === 1 ? node : node.parentElement;
      const inEditable = !!(host && host.closest &&
        host.closest('[contenteditable="true"],[contenteditable="plaintext-only"]'));
      return { text: t, mode: inEditable ? 'editable-selection' : 'selection' }; 
    }
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

function editableHostOfSelection() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const node = sel.getRangeAt(0).startContainer;
  const el = node.nodeType === 1 ? node : node.parentElement;
  return (el && el.closest)
    ? el.closest('[contenteditable="true"],[contenteditable="plaintext-only"]')
    : null;
}

// --- 1. plain inputs / textareas ------------------------------------------
// React patches the instance-level 'value' property with a change tracker;
// writing through the prototype's native setter bypasses it, and the
// bubbling 'input' event is what every framework listens to.
function replaceInputValue(el, newText) {
  el.focus();
  const s = el.selectionStart ?? 0;
  const e = el.selectionEnd ?? 0;
  const hadSelection = s !== e;
  const cur = el.value;
  const next = hadSelection ? cur.slice(0, s) + newText + cur.slice(e) : newText;

  const own = Object.getOwnPropertyDescriptor(el, 'value');
  const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
  if (proto && proto.set && (!own || own.set !== proto.set)) proto.set.call(el, next);
  else if (own && own.set) own.set.call(el, next);
  else el.value = next;

  // belt & braces: force React's value tracker to register a change
  if (el._valueTracker && next !== '') el._valueTracker.setValue('');

  el.dispatchEvent(new Event('input', { bubbles: true }));

  const caret = hadSelection ? s + newText.length : next.length;
  try { el.setSelectionRange(caret, caret); } catch (_) {}
  return true;
}

// --- 2. rich contenteditable (Slate/Lexical/ProseMirror/Quill 2) ----------
function editableText(el) {
  return el.innerText || el.textContent || '';
}

function dispatchInsertText(el, data) {
  // Synthetic beforeinput: Slate (Discord), Lexical (WhatsApp Web),
  // ProseMirror and Quill 2 intercept it and perform the insertion through
  // their own model, keeping DOM and internal state in sync.
  return el.dispatchEvent(new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType: 'insertText',
    data: data,
  }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function replaceEditable(el, newText) {
  el.focus();
  const sel = window.getSelection();
  const hasSelection = sel && sel.rangeCount > 0 && !sel.isCollapsed;

  if (!hasSelection) {
    // no explicit selection -> replace the whole editor content
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
    // let the editor's own selectionchange handler sync its model first
    await sleep(60);
  }

  // Tier 2: hand the edit to the editor itself (model-safe)
  let handled = false;
  try {
    // preventDefault() == the editor took over the edit
    handled = !dispatchInsertText(el, newText);
  } catch (_) {
    handled = false; // InputEvent/beforeinput unsupported
  }
  if (handled) {
    await sleep(50); // let the editor's re-render land
    return true;
  }

  // Tier 3: legacy fallback for simple contenteditable sites
  return document.execCommand('insertText', false, newText);
}

// --- dispatcher -------------------------------------------------------------
async function replaceText(newText, mode) {
  const el = document.activeElement;

  if (mode === 'input' && el &&
      (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
    return replaceInputValue(el, newText);
  }

  if (mode === 'editable' || mode === 'editable-selection') {
    const host = (el && el.isContentEditable)
      ? el
      : editableHostOfSelection();
    if (host) return replaceEditable(host, newText);
    return false;
  }

  if (mode === 'selection') {
    // plain (non-editable) text selection: no framework state to protect
    return document.execCommand('insertText', false, newText);
  }

  return false;
}

// --- Toast ------------------------------------------------------------------
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

// --- Main handler ------------------------------------------------------------
async function handleTranslate() {
  const { text, mode } = getActiveText();
  if (!text || !text.trim()) {
    showToast('Tidak ada teks untuk diterjemahkan', true);
    return;
  }

  const settings = await chrome.storage.sync.get({
    targetLang: 'en',
    sourceLang: 'auto',
    autoFlip: true, // if text is already in target lang -> translate to ID instead
  });

  chrome.runtime.sendMessage(
    { type: 'TRANSLATE', text, sourceLang: settings.sourceLang, targetLang: settings.targetLang, autoFlip: settings.autoFlip },
    async (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        showToast('Translate gagal: ' + (response?.error || chrome.runtime.lastError?.message || 'unknown'), true);
        return;
      }
      const ok = await replaceText(response.text, mode);
      if (!ok) {
        // last resort: clipboard
        navigator.clipboard.writeText(response.text).then(
          () => showToast('✓ Disalin ke clipboard — Ctrl+V untuk menempel'),
          () => showToast('Translate gagal: tidak bisa mengganti teks', true)
        );
      }
    }
  );
}

// --- Wiring (extension context only — the pure functions above stay
// --- reusable in a plain page for automated testing) -------------------------
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'EXECUTE_TRANSLATE') {
      handleTranslate();
      sendResponse({ ok: true });
    }
  });
}

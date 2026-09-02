// Translated For You - popup settings (non-blocking, SW-warm startup)

const defaults = { targetLang: 'en', sourceLang: 'auto', autoFlip: true };

let ready = false;
const $src = document.getElementById('srcLang');
const $tgt = document.getElementById('tgtLang');
const $flip = document.getElementById('autoFlip');
const $btn = document.getElementById('save');
const $status = document.getElementById('status');
const $loading = document.getElementById('loading');

// Load settings async (never blocks render)
(async () => {
  const s = await chrome.storage.sync.get(defaults).catch(() => defaults);
  $src.value = s.sourceLang || 'auto';
  $tgt.value = s.targetLang || 'en';
  $flip.checked = s.autoFlip !== false;
  ready = true;
  if ($loading) $loading.style.display = 'none';
  $btn.disabled = false;
})();

$btn.addEventListener('click', async () => {
  $btn.disabled = true;
  await chrome.storage.sync.set({
    sourceLang: $src.value,
    targetLang: $tgt.value,
    autoFlip: $flip.checked,
  }).catch(() => {});
  $status.style.display = 'block';
  setTimeout(() => { $status.style.display = 'none'; $btn.disabled = false; }, 1500);
});

// Live region: show status immediately
if ($loading) {
  $loading.style.display = 'block';
  $loading.textContent = 'Loading settings…';
}

// Quick Translate - popup settings

const defaults = {
  targetLang: 'en',
  sourceLang: 'auto',
  autoFlip: true,
};

const $src = document.getElementById('srcLang');
const $tgt = document.getElementById('tgtLang');
const $flip = document.getElementById('autoFlip');
const $btn = document.getElementById('save');
const $status = document.getElementById('status');

// Load current settings
chrome.storage.sync.get(defaults, (s) => {
  $src.value = s.sourceLang;
  $tgt.value = s.targetLang;
  $flip.checked = s.autoFlip;
});

$btn.addEventListener('click', () => {
  chrome.storage.sync.set({
    sourceLang: $src.value,
    targetLang: $tgt.value,
    autoFlip: $flip.checked,
  }, () => {
    $status.style.display = 'block';
    setTimeout(() => { $status.style.display = 'none'; }, 1500);
  });
});

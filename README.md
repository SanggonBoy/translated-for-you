# Translated For You

Chrome extension (MV3) untuk translate text langsung di tempat — WhatsApp Web, Telegram Web, Discord, atau field manapun. Shortcut → teks langsung diganti terjemahannya. No copy-paste, no tab switching.

## Install

1. `chrome://extensions` → aktifkan **Developer mode**
2. **Load unpacked** → pilih folder ini
3. Tekan `Ctrl+Shift+Y` di input field / seleksi text untuk translate

## Customize Shortcut

`chrome://extensions/shortcuts` → Translated For You → set sesuka hati.

## Fitur

- **Universal** — jalan di semua halaman web, input field & seleksi text
- **Editor-adaptive** — bekerja tanpa konfigurasi per-site:
  - `<input>` / `<textarea>` → sync via native setter + input event (kompatibel React/Vue/Angular)
  - Rich contenteditable (Slate, Lexical, ProseMirror, Quill 2) → synthetic `beforeinput` InputEvent
  - Plain contenteditable → execCommand fallback
- **Auto-detect** bahasa sumber (Google Translate free endpoint, no API key)
- **Auto-flip** — teks sudah dalam bahasa target? Otomatis dibalik arahnya
- **Toast feedback** — konfirmasi visual hasil translate
- **On-demand injection** — content script di-inject otomatis ke tab yang sudah terbuka sebelum extension di-install/reload
- **Settings popup**: source/target language, auto-flip toggle

## Cara Kerja

```
Ctrl+Shift+Y (chrome.commands)
  → background.js: route ke content script di tab aktif
    → content.js: ambil seleksi/input aktif
      → background.js: POST ke translate.googleapis.com/translate_a/single
        → content.js: replace in-place via editor-adaptive engine + toast
```

## License

MIT

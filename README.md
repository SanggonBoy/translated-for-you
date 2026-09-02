# Quick Translate

Browser extension (Chrome MV3) untuk translate text langsung di tempat — WhatsApp Web, Telegram Web, Discord, atau field manapun. Tekan shortcut, teks langsung diganti terjemahannya. No copy-paste, no tab switching.

## Install

1. `chrome://extensions` → aktifkan **Developer mode**
2. **Load unpacked** → pilih folder ini
3. Tekan `Ctrl+Shift+T` di input field / seleksi text untuk translate

## Customize Shortcut

`chrome://extensions/shortcuts` → Quick Translate → set sesuka hati.

## Fitur

- **Universal** — jalan di semua halaman web, input field & seleksi text
- **Auto-detect** bahasa sumber (Google Translate free endpoint, no API key)
- **Auto-flip** — teks sudah dalam bahasa target? Otomatis dibalik arahnya
- **Direct replace** via `execCommand('insertText')` — kompatibel React/WhatsApp Web
- **Clipboard fallback** kalau direct replace gagal
- **Settings popup**: source/target language, auto-flip toggle

## Cara Kerja

```
Ctrl+Shift+T (chrome.commands)
  → background.js: route ke content script di tab aktif
    → content.js: ambil seleksi/input aktif
      → background.js: POST ke translate.googleapis.com/translate_a/single
        → content.js: replace in-place + toast feedback
```

## License

MIT

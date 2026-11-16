# AutoType Rojak 🎤

Cakap bahasa rojak (Melayu campur English). AI tukar jadi teks, betulkan typo, dan kemaskan ayat.
Lepas tu tekan **WhatsApp**, **Copy** atau **Share** untuk hantar ke WhatsApp, Telegram, TikTok dan lain-lain.

## Cara guna
1. Tekan 🎤 dan cakap macam biasa. Boleh juga taip atau paste teks dari FUTO / Gboard.
2. Pilih gaya ayat: **Santai (rojak)**, **Sopan / formal**, **BM penuh** atau **English**.
3. Tekan **✨ Kemaskan**. Kalau "Auto kemaskan" hidup, langkah ni berlaku sendiri.
4. Semak hasil, lepas tu tekan **WhatsApp**, **Copy** atau **Share**.

Kalau nak AI lagi faham konteks, paste mesej kawan kau dalam "Mesej yang kau nak reply".

## Apa yang kau perlukan
- **Claude API key** (wajib), dari https://console.anthropic.com untuk kemaskan ayat. Kos untuk satu mesej pendek sangat sikit.
- **OpenAI API key** (optional), kalau nak guna Whisper. Whisper lagi faham bahasa rojak berbanding mic Chrome yang free.
- Disarankan set had belanja (spending limit) dekat console masing-masing.

Key disimpan dalam browser phone kau sahaja.

## Pasang dekat phone (GitHub Pages, free)
1. Dalam repo GitHub ni: **Settings → Pages**.
2. Bawah **Source**, pilih **Deploy from a branch**. Kemudian pilih branch app ni (atau `main` lepas merge) dan folder **/(root)**. Tekan Save.
3. Tunggu 1–2 minit. Link akan keluar, contohnya `https://<username>.github.io/projekautotype/`.
4. Buka link tu dalam **Chrome** dekat Android. Tekan menu ⋮ dan pilih **Add to Home screen / Install app**.

## Fail
- `index.html`, `style.css`, `app.js`: app utama
- `vendor/anthropic-sdk.js`: Anthropic SDK (`@anthropic-ai/sdk@1.8.0`) yang di-bundle untuk browser
- `sw.js`, `manifest.webmanifest`, `icon.svg`: supaya boleh install macam app

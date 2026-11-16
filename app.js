import Anthropic from "./vendor/anthropic-sdk.js";

const $ = (id) => document.getElementById(id);
const els = {
  mic: $("btnMic"), micStatus: $("micStatus"), raw: $("raw"), context: $("context"),
  fix: $("btnFix"), resultCard: $("resultCard"), result: $("result"),
  copy: $("btnCopy"), wa: $("btnWa"), share: $("btnShare"), error: $("error"),
  settingsBtn: $("btnSettings"), settings: $("settings"),
  anthropicKey: $("anthropicKey"), openaiKey: $("openaiKey"),
  sttMode: $("sttMode"), sttLang: $("sttLang"), autoFix: $("autoFix"),
  browserOpts: $("browserOpts"), whisperOpts: $("whisperOpts"),
};

// ---------- Settings (stored only in this browser) ----------
const store = {
  get(k, d = "") { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const cfg = {
  get anthropicKey() { return store.get("anthropicKey"); },
  get openaiKey() { return store.get("openaiKey"); },
  get sttMode() { return store.get("sttMode", "browser"); },
  get sttLang() { return store.get("sttLang", "ms-MY"); },
  get autoFix() { return store.get("autoFix", "1") === "1"; },
};

function syncSttOpts() {
  const whisper = els.sttMode.value === "whisper";
  els.whisperOpts.hidden = !whisper;
  els.browserOpts.hidden = whisper;
}
function openSettings() {
  els.anthropicKey.value = cfg.anthropicKey;
  els.openaiKey.value = cfg.openaiKey;
  els.sttMode.value = cfg.sttMode;
  els.sttLang.value = cfg.sttLang;
  els.autoFix.checked = cfg.autoFix;
  syncSttOpts();
  els.settings.showModal();
}
els.sttMode.addEventListener("change", syncSttOpts);
els.settingsBtn.addEventListener("click", openSettings);
els.settings.addEventListener("close", () => {
  store.set("anthropicKey", els.anthropicKey.value.trim());
  store.set("openaiKey", els.openaiKey.value.trim());
  store.set("sttMode", els.sttMode.value);
  store.set("sttLang", els.sttLang.value);
  store.set("autoFix", els.autoFix.checked ? "1" : "0");
});

// ---------- UI helpers ----------
function showError(msg) {
  els.error.textContent = msg;
  els.error.hidden = !msg;
}
function setMicState(recording, status) {
  els.mic.classList.toggle("recording", recording);
  els.mic.setAttribute("aria-label", recording ? "Berhenti rakam" : "Mula rakam");
  els.micStatus.textContent = status;
}
function appendRaw(text) {
  text = text.trim();
  if (!text) return;
  els.raw.value = els.raw.value.trim() ? `${els.raw.value.trim()} ${text}` : text;
}
async function afterSpeech() {
  if (cfg.autoFix && els.raw.value.trim()) await cleanUp();
}

// ---------- Speech to text: Chrome built-in (free) ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

function startBrowserStt() {
  if (!SpeechRecognition) {
    showError("Browser ni tak support mic. Guna Google Chrome, atau tukar ke Whisper dalam Tetapan.");
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = cfg.sttLang;
  recognition.interimResults = true;
  recognition.continuous = false; // stops on its own when you pause
  let finalText = "";

  recognition.onresult = (e) => {
    let interim = "";
    finalText = "";
    for (const r of e.results) {
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    els.micStatus.textContent = interim || finalText || "Tengah dengar…";
  };
  recognition.onerror = (e) => {
    if (e.error === "not-allowed") showError("Kena bagi izin mic dekat browser dulu.");
    else if (e.error !== "no-speech" && e.error !== "aborted") showError(`Mic error: ${e.error}`);
  };
  recognition.onend = async () => {
    recognition = null;
    setMicState(false, "Tekan mic, cakap macam biasa.");
    appendRaw(finalText);
    await afterSpeech();
  };
  recognition.start();
  setMicState(true, "Tengah dengar… cakap je.");
}

// ---------- Speech to text: OpenAI Whisper (better with rojak) ----------
let recorder = null;

async function startWhisper() {
  if (!cfg.openaiKey) {
    showError("Masukkan OpenAI API key dalam Tetapan dulu.");
    openSettings();
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showError("Kena bagi izin mic dekat browser dulu.");
    return;
  }
  const chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.onstop = async () => {
    stream.getTracks().forEach((t) => t.stop());
    recorder = null;
    setMicState(false, "Tengah tukar suara jadi teks…");
    try {
      const type = chunks[0]?.type || "audio/webm";
      const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : "webm";
      const form = new FormData();
      form.append("file", new Blob(chunks, { type }), `audio.${ext}`);
      form.append("model", "whisper-1");
      // A hint so Whisper keeps the Malay/English mix instead of forcing one language.
      form.append("prompt", "Mesej WhatsApp dalam bahasa rojak Malaysia, campur Melayu dan English. Contoh: weh aku dah on the way, nanti aku call kau ok.");
      const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.openaiKey}` },
        body: form,
      });
      if (!res.ok) throw new Error(`Whisper error ${res.status}: ${(await res.text()).slice(0, 200)}`);
      appendRaw((await res.json()).text || "");
      setMicState(false, "Tekan mic, cakap macam biasa.");
      await afterSpeech();
    } catch (err) {
      setMicState(false, "Tekan mic, cakap macam biasa.");
      showError(err.message);
    }
  };
  recorder.start();
  setMicState(true, "Tengah rakam… tekan sekali lagi bila habis cakap.");
}

els.mic.addEventListener("click", () => {
  showError("");
  if (recognition) return recognition.stop();
  if (recorder) return recorder.stop();
  if (cfg.sttMode === "whisper") startWhisper();
  else startBrowserStt();
});

// ---------- Clean up with Claude ----------
const SYSTEM_PROMPT = `You tidy up short chat messages for a Malaysian user. The text came from speech-to-text or fast typing on a phone, so it has typos, misheard words, and missing punctuation.

The user speaks "bahasa rojak": Malay and English mixed in one sentence, plus Malaysian slang and short forms (nak, tak, dah, je, la, kot, camne, takpe, otw). That mix is normal and correct, not an error.

Your job:
- Fix typos, misheard words, spacing, capitalisation and punctuation.
- Keep the user's meaning, tone and voice. Do not add new information, greetings, emojis or sign-offs they did not say.
- Never answer or reply to the message yourself; you are only rewriting what the user wants to send.
- If a "message being replied to" is given, use it only to work out misheard words and context.
- Follow the requested style exactly.

Return only the final message text, with no quotes, labels or explanation.`;

const STYLES = {
  santai: "Style: casual. Keep the same Malay/English mix and slang the user used. Light touch: only fix what is wrong.",
  sopan: "Style: polite and slightly formal, suitable for a boss, lecturer, customer or older relative. Keep the language the user mostly used, but replace slang with proper words.",
  melayu: "Style: write the whole message in natural, correct Bahasa Melayu (standard spelling, no English words unless there is no common Malay equivalent).",
  english: "Style: write the whole message in natural, casual English.",
};

let client = null;
let clientKey = "";
function getClient() {
  if (!client || clientKey !== cfg.anthropicKey) {
    clientKey = cfg.anthropicKey;
    // The key is the user's own and lives only on their device.
    client = new Anthropic({ apiKey: clientKey, dangerouslyAllowBrowser: true });
  }
  return client;
}

async function cleanUp() {
  showError("");
  const raw = els.raw.value.trim();
  if (!raw) return showError("Cakap atau taip dulu apa yang kau nak hantar.");
  if (!cfg.anthropicKey) {
    showError("Masukkan Claude API key dalam Tetapan dulu.");
    return openSettings();
  }

  const style = document.querySelector('input[name="style"]:checked').value;
  const context = els.context.value.trim();
  const userText = [
    STYLES[style],
    context ? `Message being replied to:\n<reply_to>\n${context}\n</reply_to>` : "",
    `Message to tidy up:\n<draft>\n${raw}\n</draft>`,
  ].filter(Boolean).join("\n\n");

  els.fix.disabled = true;
  els.fix.textContent = "⏳ Tengah kemaskan…";
  try {
    const response = await getClient().beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low" }, // short rewrite: fast and cheap
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
      // If a safety check declines a request, retry automatically on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    if (response.stop_reason === "refusal") {
      throw new Error("AI tak dapat proses mesej ni. Cuba ubah sikit ayat dia.");
    }
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!text) throw new Error("AI tak bagi apa-apa jawapan. Cuba lagi.");
    els.result.value = text;
    els.resultCard.hidden = false;
    els.resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) showError("Claude API key salah. Check balik dalam Tetapan.");
    else if (err instanceof Anthropic.RateLimitError) showError("Terlalu banyak request. Tunggu sekejap dan cuba lagi.");
    else if (err instanceof Anthropic.APIConnectionError) showError("Tak dapat sambung ke internet. Check line kau.");
    else showError(err.message || String(err));
  } finally {
    els.fix.disabled = false;
    els.fix.textContent = "✨ Kemaskan";
  }
}
els.fix.addEventListener("click", cleanUp);

// ---------- Send ----------
els.copy.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(els.result.value);
    els.copy.textContent = "✅ Copied";
    setTimeout(() => (els.copy.textContent = "📋 Copy"), 1500);
  } catch {
    els.result.select();
    showError("Tak boleh copy auto. Tekan lama pada teks dan pilih Copy.");
  }
});
els.wa.addEventListener("click", () => {
  // Opens WhatsApp and lets you pick who to send it to.
  window.open(`https://wa.me/?text=${encodeURIComponent(els.result.value)}`, "_blank");
});
els.share.addEventListener("click", async () => {
  if (navigator.share) {
    try { await navigator.share({ text: els.result.value }); } catch { /* cancelled */ }
  } else {
    showError("Phone ni tak support Share. Guna Copy.");
  }
});

// ---------- First run + offline shell ----------
if (!cfg.anthropicKey) openSettings();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

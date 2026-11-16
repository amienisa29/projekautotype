// Tracker Posting: 3 accounts, N posts a day each, tick when done, reminders.
// All data stays in this browser (localStorage).

const $ = (id) => document.getElementById(id);
const KEY = "postingTracker.v1";

const DEFAULT = {
  settings: {
    accounts: ["Amin Isol", "Darwish", "Amni"],
    perDay: 10,
    start: "08:00",
    end: "22:00",
  },
  days: {},        // "YYYY-MM-DD" -> [ [slot,...] per account ]  slot = { time, doneAt }
  notified: {},    // "YYYY-MM-DD HH:MM" -> true
  activeTab: 0,
};

// ---------- Storage ----------
function load() {
  try {
    const data = JSON.parse(localStorage.getItem(KEY));
    if (data && data.settings) return { ...structuredClone(DEFAULT), ...data };
  } catch { /* first run or blocked storage */ }
  return structuredClone(DEFAULT);
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

// ---------- Time helpers ----------
const pad = (n) => String(n).padStart(2, "0");
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const toHHMM = (min) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const fmt12 = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "pagi" : h < 19 ? "ptg" : "mlm";
  return `${((h + 11) % 12) + 1}:${pad(m)} ${ampm}`;
};

function scheduleTimes({ perDay, start, end }) {
  const s = toMin(start);
  let e = toMin(end);
  if (e <= s) e = s + 60;
  if (perDay <= 1) return [toHHMM(s)];
  const step = (e - s) / (perDay - 1);
  return Array.from({ length: perDay }, (_, i) => toHHMM(Math.round((s + i * step) / 5) * 5));
}

// Build today's plan, keeping any ticks already made.
function ensureToday(regenerate = false) {
  const key = dateKey();
  const times = scheduleTimes(state.settings);
  const old = state.days[key];
  if (old && !regenerate) return old;
  state.days[key] = state.settings.accounts.map((_, a) =>
    times.map((time, i) => ({ time, doneAt: old?.[a]?.[i]?.doneAt ?? null }))
  );
  save();
  return state.days[key];
}

// ---------- Render ----------
const els = {
  today: $("today"), doneTotal: $("doneTotal"), goalTotal: $("goalTotal"), barFill: $("barFill"),
  remainingText: $("remainingText"), nextText: $("nextText"), tabs: $("tabs"), slots: $("slots"),
  history: $("history"), btnNotify: $("btnNotify"), settings: $("settings"),
};
const accColor = (a) => `var(--a${a})`;

function render() {
  const day = ensureToday();
  const { accounts } = state.settings;
  const now = nowMin();

  els.today.textContent = new Date().toLocaleDateString("ms-MY", { weekday: "long", day: "numeric", month: "long" });

  // Summary
  const done = day.flat().filter((s) => s.doneAt).length;
  const goal = day.flat().length;
  const remaining = goal - done;
  const late = day.flat().filter((s) => !s.doneAt && toMin(s.time) <= now).length;
  els.doneTotal.textContent = done;
  els.goalTotal.textContent = goal;
  els.barFill.style.width = `${goal ? (done / goal) * 100 : 0}%`;
  els.remainingText.textContent = remaining === 0
    ? "🎉 Semua posting hari ni dah siap!"
    : `${remaining} posting belum siap${late ? ` · ${late} dah lewat` : ""}`;

  const next = nextDue(day, now);
  els.nextText.textContent = next
    ? `Seterusnya: ${fmt12(next.time)}, ${next.names.join(", ")}`
    : remaining ? "Tak ada slot lagi hari ni, kejar yang lewat 💪" : "";

  // Tabs
  els.tabs.innerHTML = "";
  accounts.forEach((name, a) => {
    const d = day[a].filter((s) => s.doneAt).length;
    const tab = document.createElement("button");
    tab.className = "tab";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(state.activeTab === a));
    tab.style.setProperty("--acc", accColor(a));
    tab.innerHTML = `<span class="name"><span class="dot"></span></span><span class="count">${d}/${day[a].length}</span>`;
    tab.querySelector(".name").append(name);
    tab.addEventListener("click", () => { state.activeTab = a; save(); render(); });
    els.tabs.append(tab);
  });

  // Slots for active account
  const a = Math.min(state.activeTab, accounts.length - 1);
  els.slots.innerHTML = "";
  day[a].forEach((slot, i) => {
    const isLate = !slot.doneAt && toMin(slot.time) <= now;
    const row = document.createElement("div");
    row.className = `slot${slot.doneAt ? " done" : ""}${isLate ? " late" : ""}`;
    row.style.setProperty("--acc", accColor(a));

    const check = document.createElement("button");
    check.className = "check";
    check.setAttribute("aria-label", slot.doneAt ? `Batal tick posting ${i + 1}` : `Tick posting ${i + 1}`);
    check.textContent = slot.doneAt ? "✓" : "";
    check.addEventListener("click", () => {
      slot.doneAt = slot.doneAt ? null : new Date().toISOString();
      if (slot.doneAt && navigator.vibrate) navigator.vibrate(30);
      save(); render();
    });

    const info = document.createElement("div");
    info.className = "info";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = `Posting #${i + 1}`;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = slot.doneAt
      ? `Siap pukul ${fmt12(new Date(slot.doneAt).toTimeString().slice(0, 5))}`
      : isLate ? "Lewat, belum post" : `Jadual ${fmt12(slot.time)}`;
    info.append(title, meta);

    const time = document.createElement("input");
    time.type = "time";
    time.value = slot.time;
    time.setAttribute("aria-label", `Ubah masa posting ${i + 1}`);
    time.addEventListener("change", () => { if (time.value) { slot.time = time.value; save(); render(); } });

    row.append(check, info, time);
    els.slots.append(row);
  });

  renderHistory();
  updateBadge(remaining);
}

function nextDue(day, now) {
  let best = null;
  day.forEach((slots, a) => slots.forEach((s) => {
    if (s.doneAt || toMin(s.time) <= now) return;
    const t = toMin(s.time);
    if (!best || t < best.t) best = { t, time: s.time, names: [state.settings.accounts[a]] };
    else if (t === best.t) best.names.push(state.settings.accounts[a]);
  }));
  return best;
}

function renderHistory() {
  const today = dateKey();
  const keys = Object.keys(state.days).filter((k) => k < today).sort().reverse().slice(0, 7);
  els.history.innerHTML = "";
  if (!keys.length) {
    els.history.innerHTML = '<p class="empty">Belum ada rekod. Esok baru keluar rekod semalam.</p>';
    return;
  }
  for (const k of keys) {
    const day = state.days[k];
    const done = day.flat().filter((s) => s.doneAt).length;
    const row = document.createElement("div");
    row.className = "hist-row";
    const left = document.createElement("span");
    left.textContent = `${new Date(k + "T00:00").toLocaleDateString("ms-MY", { weekday: "short", day: "numeric", month: "short" })} · ${done}/${day.flat().length}${done === day.flat().length ? " ✅" : ""}`;
    const right = document.createElement("span");
    right.className = "accs";
    right.textContent = day.map((s, a) => `${(state.settings.accounts[a] || "?").split(" ")[0]} ${s.filter((x) => x.doneAt).length}`).join(" · ");
    row.append(left, right);
    els.history.append(row);
  }
}

function updateBadge(remaining) {
  if (!("setAppBadge" in navigator)) return;
  (remaining ? navigator.setAppBadge(remaining) : navigator.clearAppBadge()).catch(() => {});
}

// ---------- Reminders (while the app is open) ----------
let swReg = null;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then((r) => (swReg = r)).catch(() => {});
}

function syncNotifyButton() {
  const supported = "Notification" in window;
  const granted = supported && Notification.permission === "granted";
  els.btnNotify.hidden = granted;
  if (!supported) els.btnNotify.hidden = true;
}
els.btnNotify.addEventListener("click", async () => {
  const p = await Notification.requestPermission();
  syncNotifyButton();
  if (p === "granted") notify("Peringatan dah hidup 🔔", "Aku akan ingatkan bila sampai masa posting (masa app terbuka).");
});

async function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const reg = swReg || (await navigator.serviceWorker?.ready);
    if (reg) await reg.showNotification(title, { body, icon: "icon.svg", badge: "icon.svg", tag: "posting" });
    else new Notification(title, { body, icon: "icon.svg" });
  } catch { /* some browsers block notifications */ }
}

function checkReminders() {
  const key = dateKey();
  if (!state.days[key]) { render(); return; } // new day rolled over
  const day = state.days[key];
  const now = nowMin();
  const times = new Set(day.flat().map((s) => s.time));
  for (const t of times) {
    const id = `${key} ${t}`;
    const m = toMin(t);
    // Fire once, within 10 minutes after the slot time.
    if (state.notified[id] || now < m || now - m > 10) continue;
    const due = state.settings.accounts.filter((_, a) => day[a].some((s) => s.time === t && !s.doneAt));
    if (!due.length) continue;
    state.notified[id] = true;
    const remaining = day.flat().filter((s) => !s.doneAt).length;
    notify(`⏰ Masa posting! (${fmt12(t)})`, `${due.join(", ")} · ${remaining} posting belum siap hari ni`);
  }
  // Keep only today's notification flags.
  for (const k of Object.keys(state.notified)) if (!k.startsWith(key)) delete state.notified[k];
  save();
  // Don't redraw while the user is editing a time.
  if (document.activeElement?.tagName !== "INPUT") render();
}

// ---------- Settings ----------
const inputs = { acc: [$("acc0"), $("acc1"), $("acc2")], perDay: $("perDay"), start: $("startTime"), end: $("endTime") };
$("btnSettings").addEventListener("click", () => {
  const s = state.settings;
  inputs.acc.forEach((el, i) => (el.value = s.accounts[i]));
  inputs.perDay.value = s.perDay;
  inputs.start.value = s.start;
  inputs.end.value = s.end;
  els.settings.showModal();
});
els.settings.addEventListener("close", () => {
  if (els.settings.returnValue !== "save") return;
  const s = state.settings;
  s.accounts = inputs.acc.map((el, i) => el.value.trim() || s.accounts[i]);
  s.perDay = Math.min(30, Math.max(1, parseInt(inputs.perDay.value, 10) || 10));
  s.start = inputs.start.value || "08:00";
  s.end = inputs.end.value || "22:00";
  ensureToday(true);
  render();
});

// Calendar file: one daily repeating event per slot, with a reminder at the time.
$("btnIcs").addEventListener("click", () => {
  const s = state.settings;
  const day = ensureToday();
  const start = dateKey().replaceAll("-", "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Tracker Posting//MS", "CALSCALE:GREGORIAN"];
  day[0].forEach((slot, i) => {
    const t = slot.time.replace(":", "") + "00";
    const end = toHHMM(toMin(slot.time) + 15).replace(":", "") + "00";
    lines.push(
      "BEGIN:VEVENT",
      `UID:posting-${i + 1}-${start}@tracker-posting`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${start}T${t}`,
      `DTEND:${start}T${end}`,
      "RRULE:FREQ=DAILY",
      `SUMMARY:Posting #${i + 1}: ${s.accounts.join(", ")}`,
      "DESCRIPTION:Post untuk setiap account lepas tu tick dalam Tracker Posting.",
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Masa posting!", "TRIGGER:PT0M", "END:VALARM",
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "jadual-posting.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

// ---------- Start ----------
syncNotifyButton();
render();
checkReminders();
setInterval(checkReminders, 30_000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkReminders(); });

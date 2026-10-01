// Screen logic. Everything is saved on this device only (localStorage).

const STORE_KEY = "howmuchleave.v1";
const $ = (id) => document.getElementById(id);

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || { settings: null, trips: [] };
  } catch {
    return { settings: null, trips: [] };
  }
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}
// Cute pop-up in place of the browser's confirm/alert.
// ask("Question?", { ok: "remove", cancel: "leave it" }) resolves true/false.
// Leave out `cancel` for a plain note with one button.
function ask(message, { ok = "ok", cancel = null, suitcase = false } = {}) {
  const dlg = document.getElementById("ask");
  // (toggleAttribute, because .hidden doesn't work on <svg> elements)
  dlg.querySelector(".ask-fish:not(.trip)").toggleAttribute("hidden", suitcase);
  dlg.querySelector(".ask-fish.trip").toggleAttribute("hidden", !suitcase);
  document.getElementById("ask-msg").textContent = message;
  const okBtn = document.getElementById("ask-ok");
  const cancelBtn = document.getElementById("ask-cancel");
  okBtn.textContent = ok;
  cancelBtn.textContent = cancel || "";
  cancelBtn.hidden = !cancel;
  return new Promise((resolve) => {
    const done = (answer) => {
      okBtn.onclick = cancelBtn.onclick = dlg.onclose = null;
      if (dlg.open) dlg.close();
      resolve(answer);
    };
    okBtn.onclick = () => done(true);
    cancelBtn.onclick = () => done(false);
    dlg.onclose = () => done(false); // Escape key
    dlg.showModal();
    (cancel ? cancelBtn : okBtn).focus();
  });
}

// Visiting the page with ?reset wipes this device's data (for testing)
if (new URLSearchParams(location.search).has("reset")) {
  history.replaceState(null, "", location.pathname);
  ask("Erase the balance and all trips on this device?", { ok: "erase", cancel: "leave it" }).then((yes) => {
    if (yes) { localStorage.removeItem(STORE_KEY); location.reload(); }
  });
}
let state = load();

// ---- fish ----
const SVG_NS = "http://www.w3.org/2000/svg";
function fishIcon(className, withSuitcase = false) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", withSuitcase ? "0 0 120 96" : "0 0 120 64");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", withSuitcase ? "#fish-trip" : "#fish");
  svg.append(use);
  return svg;
}
// A fish swims across the screen; with a suitcase when it's off on a trip
function swimFish(withSuitcase = false) {
  const f = fishIcon("swimmer", withSuitcase);
  f.style.top = `${20 + Math.random() * 50}vh`;
  f.addEventListener("animationend", () => f.remove());
  document.body.append(f);
}

// Bubbles drift up from the bottom, a few at a time
function blowBubble() {
  if (document.hidden) return;
  const b = document.createElement("div");
  b.className = "bubble";
  const size = 5 + Math.random() * 12;
  b.style.width = b.style.height = `${size}px`;
  b.style.left = `${Math.random() * 100}%`;
  b.style.animationDuration = `${7 + Math.random() * 6}s`;
  b.addEventListener("animationend", () => b.remove());
  document.querySelector(".sea").append(b);
}
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setInterval(blowBubble, 900);

// Tap the header fish: a school of fish (different sizes, speeds, heights) swims by.
// A couple of them are off on trips and carry suitcases.
function swimSchool() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const count = 9 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const f = fishIcon("swimmer", Math.random() < 0.18);
      f.style.top = `${8 + Math.random() * 78}vh`;
      f.style.width = `${38 + Math.random() * 70}px`;
      f.style.animationDuration = `${2.4 + Math.random() * 2.6}s`;
      f.addEventListener("animationend", () => f.remove());
      document.body.append(f);
    }, i * (90 + Math.random() * 160));
  }
}
document.getElementById("fish-btn").addEventListener("click", (e) => {
  const btn = e.currentTarget;
  btn.classList.remove("wiggle");
  void btn.offsetWidth; // restart the wiggle
  btn.classList.add("wiggle");
  swimSchool();
});

// ---- formatting ----
const dayWord = (n) => (Math.abs(n) === 1 ? "day" : "days");
const fmtNum = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
function fmtDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function nextMonthEnd(today) {
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

// ---- greeting ----
function greet() {
  const today = Leave.todayStr();
  if (today.slice(5) === "10-02") {
    $("hello").textContent = "Happy birthday, Abbey";
    $("hello-sub").textContent = "No more guessing how much leave you have. Love you.";
  }
}

// ---- setup ----
function showSetup() {
  document.body.classList.add("setup-mode");
  $("setup").hidden = false;
  $("app").hidden = true;
  if (state.settings) {
    $("setup-balance").value = state.settings.balance;
    $("setup-date").value = state.settings.asOf;
  }
  DatePicker.sync();
}
$("setup-save").addEventListener("click", () => {
  const balance = parseFloat($("setup-balance").value);
  const asOf = $("setup-date").value;
  if (Number.isNaN(balance) || !asOf) {
    ask("Fill in both the balance and the date.", { ok: "got it" });
    return;
  }
  if (asOf > Leave.todayStr()) {
    ask("The LES date can't be in the future.", { ok: "got it" });
    return;
  }
  state.settings = { balance, asOf };
  save();
  render();
});
$("redo-setup").addEventListener("click", showSetup);

// ---- main screen ----
function shortDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function render() {
  if (!state.settings) return showSetup();
  document.body.classList.remove("setup-mode");
  $("setup").hidden = true;
  $("app").hidden = false;

  const { settings, trips } = state;
  const today = Leave.todayStr();

  const now = Leave.balanceOn(today, settings, takenTrips());
  $("today-balance").textContent = fmtNum(now);
  $("today-unit").textContent = `${dayWord(now)} of leave`;
  // "By [date]" starts on the next month-end, so she sees her next +2.5
  if (!$("by-date").value) $("by-date").value = nextMonthEnd(today);
  renderBy();

  $("les-note").textContent = `Starting point: ${fmtNum(settings.balance)} days on your LES as of ${fmtDate(settings.asOf)}.`;
  const ageDays = (new Date(today) - new Date(settings.asOf)) / 86400000;
  if (ageDays > 120) $("les-note").textContent += " It's been a few months, worth checking it still matches your LES.";

  PlanCal.trips = trips;
  PlanCal.draw();
  renderTrip();
  renderLongWeekend();
  renderTrips();
  DatePicker.sync();
}

// Potential trips don't change any balance until their days have passed.
// Days already behind her count as taken, so Today stays right after a trip.
function takenTrips() {
  const today = Leave.todayStr();
  return state.trips
    .filter((t) => t.firstOff <= today)
    .map((t) => ({ ...t, lastOff: t.lastOff < today ? t.lastOff : today }));
}

function renderBy() {
  const date = $("by-date").value;
  const bal = date ? Leave.balanceOn(date, state.settings, takenTrips()) : null;
  $("by-balance").textContent = bal === null ? "–" : fmtNum(bal);
  $("by-unit").textContent = bal === null ? "pick a later date" : `${dayWord(bal)} of leave`;
}

function setPlan(uses, after) {
  $("plan-uses").textContent = uses;
  $("plan-after").textContent = after;
}

// The name box and "plan it" button always show; they're dimmed and switched off
// until there are days picked that actually use leave.
// Leave start / Leave end boxes: show the picked dates and which one the next tap fills
function renderLeaveBoxes(first, last) {
  const target = PlanCal.target;
  const endChosen = first && last && !(target === "end" && first === last);
  const put = (id, value) => {
    const el = $(id);
    el.textContent = value || "pick a day";
    el.classList.toggle("empty", !value);
  };
  put("le-start-date", first ? dayDate(first) : "");
  put("le-end-date", endChosen ? dayDate(last) : "");
  $("le-start").classList.toggle("active", target === "start");
  $("le-end").classList.toggle("active", target === "end");
}

function setPlanReady(ready) {
  $("trip-save").classList.toggle("inactive", !ready);
  $("trip-name").disabled = !ready;
  $("trip-save-btn").disabled = !ready;
}

function renderTrip() {
  const first = $("trip-first").value;
  const last = $("trip-last").value;
  const note = $("trip-result");
  DatePicker.sync();
  setPlanReady(false);
  $("plan-after-tile").classList.remove("warn");
  $("plan-after-label").textContent = "After";
  note.dataset.kind = "";
  setPlan("–", "–");
  $("trip-clear").hidden = !first;
  note.textContent = "";
  renderLeaveBoxes(first, last);
  if (!first || !last) return;
  if (first <= state.settings.asOf) { note.textContent = `Pick days after ${shortDate(state.settings.asOf)}, your LES date.`; return; }

  const used = Leave.chargedDays(first, last).length;
  const after = Leave.balanceOn(last, state.settings, takenTrips()) - used;
  setPlan(`${used}`, fmtNum(after));
  if (used === 0) {
    note.dataset.kind = "free";
    note.textContent = "All weekend or holiday, so it's free.";
    return;
  }
  if (after < 0) {
    $("plan-after-tile").classList.add("warn");
    $("plan-after-label").textContent = "Needs advance leave";
    note.dataset.kind = "warn";
    note.textContent = `That's ${fmtNum(-after)} more than you'll have, so it would need advance leave.`;
  }
  setPlanReady(true);
}

// "Fri Oct 9"
function dayDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).replace(",", "");
}

// Next Long Weekend: written out as sentences, tap to plan it
function renderLongWeekend() {
  const box = $("long-weekend");
  box.innerHTML = "";
  // Next 3 long weekends: dates on top, holiday name underneath. Tap to plan it.
  const rows = Leave.nextLongWeekends(Leave.todayStr(), 3).map((w) => ({
    title: `${dayDate(w.firstOff)} to ${dayDate(w.lastOff)}`,
    line: w.holiday,
    plan: w,
  }));
  for (const r of rows) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lw-row";
    btn.setAttribute("aria-label", `${r.title}, ${r.line}. Plan it.`);
    const hook = document.createElement("span");
    hook.className = "pk-hook big";
    hook.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    const t = document.createElement("div");
    t.className = "lw-title";
    t.textContent = r.title;
    const l = document.createElement("div");
    l.className = "lw-line";
    l.textContent = r.line;
    text.append(t, l);
    btn.append(hook, text);
    btn.addEventListener("click", () => { PlanCal.select(r.plan.firstOff, r.plan.lastOff); showTab("plan"); });
    box.append(btn);
  }
}

function renderTrips() {
  const body = $("trips");
  body.innerHTML = "";
  const trips = [...state.trips].sort((a, b) => a.firstOff.localeCompare(b.firstOff));

  for (const t of trips) {
    const used = Leave.chargedDays(t.firstOff, t.lastOff).length;
    const tr = document.createElement("tr");
    const cell = (cls, content) => {
      const td = document.createElement("td");
      td.className = cls;
      if (typeof content === "string") td.textContent = content;
      else td.append(content);
      tr.append(td);
    };
    cell("fish-cell", fishIcon("fish"));
    const info = document.createElement("div");
    const nm = document.createElement("div");
    nm.textContent = t.name || "Trip";
    const dates = document.createElement("div");
    dates.className = "trip-dates";
    dates.textContent = t.firstOff === t.lastOff ? shortDate(t.firstOff) : `${shortDate(t.firstOff)} to ${shortDate(t.lastOff)}`;
    info.append(nm, dates);
    cell("trip-name", info);
    // what it uses, and what she'd have right after it (judged on its own)
    const endBal = Leave.balanceOn(t.lastOff, state.settings, takenTrips());
    const summary = document.createElement("span");
    const u = document.createElement("span");
    u.className = "t-uses";
    u.textContent = `Uses ${used} ${dayWord(used)}`;
    const sep = document.createElement("span");
    sep.className = "t-sep";
    sep.textContent = " | ";
    const l = document.createElement("span");
    l.className = "t-left";
    l.textContent = endBal === null ? "" : `${fmtNum(endBal - used)} ${dayWord(endBal - used)} left`;
    summary.append(u, sep, l);
    cell("trip-days", summary);
    const del = document.createElement("button");
    del.className = "link";
    del.innerHTML = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>';
    del.setAttribute("aria-label", `Remove ${t.name || "this leave"}`);
    del.addEventListener("click", async () => {
      const question = t.name ? `Let "${t.name}" swim away?` : "Let this trip swim away?";
      if (!(await ask(question, { ok: "remove", cancel: "leave it", suitcase: true }))) return;
      state.trips = state.trips.filter((x) => x.id !== t.id);
      save();
      render();
      swimFish(true);
    });
    cell("trip-del", del);
    body.append(tr);
  }
}

$("by-date").addEventListener("input", renderBy);
$("trip-clear").addEventListener("click", () => { PlanCal.clear(); renderTrip(); });
$("le-start").addEventListener("click", () => PlanCal.setTarget("start"));
$("le-end").addEventListener("click", () => PlanCal.setTarget("end"));

// Phones: plan | booked switch (on wide screens both show and the tabs are hidden)
function showTab(name) {
  document.body.dataset.tab = name;
  $("tab-plan").setAttribute("aria-selected", String(name === "plan"));
  $("tab-booked").setAttribute("aria-selected", String(name === "booked"));
}
$("tab-plan").addEventListener("click", () => showTab("plan"));
$("tab-booked").addEventListener("click", () => showTab("booked"));
showTab("plan");
$("open-info").addEventListener("click", () => $("info").showModal());
$("trip-last").addEventListener("input", renderTrip);
$("trip-save-btn").addEventListener("click", () => {
  state.trips.push({
    id: String(Date.now()),
    name: $("trip-name").value.trim(),
    firstOff: $("trip-first").value,
    lastOff: $("trip-last").value,
  });
  save();
  PlanCal.clear();
  $("trip-name").value = "";
  render();
  swimFish(true);
});

// Every 20 to 45 seconds the seahorse peeks out from behind the planner
function seahorsePeek() {
  const h = document.querySelector(".seahorse");
  if (h && !document.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    h.parentElement.style.top = `${20 + Math.random() * 55}%`;
    h.classList.remove("peek");
    void h.offsetWidth; // restart the animation
    h.classList.add("peek");
  }
  setTimeout(seahorsePeek, 20000 + Math.random() * 25000);
}
setTimeout(seahorsePeek, 6000);

greet();
render();

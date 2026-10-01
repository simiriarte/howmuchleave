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
// Visiting the page with ?reset wipes this device's data (for testing)
if (new URLSearchParams(location.search).has("reset")) {
  if (confirm("Erase the balance and all booked leave on this device?")) localStorage.removeItem(STORE_KEY);
  history.replaceState(null, "", location.pathname);
}
let state = load();

// ---- fish ----
const SVG_NS = "http://www.w3.org/2000/svg";
function fishIcon(className) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 120 64");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(SVG_NS, "use");
  use.setAttribute("href", "#fish");
  svg.append(use);
  return svg;
}
function swimFish() {
  const f = fishIcon("swimmer");
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
    alert("Fill in both the balance and the date.");
    return;
  }
  if (asOf > Leave.todayStr()) {
    alert("The LES date can't be in the future.");
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

  const now = Leave.balanceOn(today, settings, trips);
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
  renderTrips();
  DatePicker.sync();
}

function renderBy() {
  const date = $("by-date").value;
  const bal = date ? Leave.balanceOn(date, state.settings, state.trips) : null;
  $("by-balance").textContent = bal === null ? "–" : fmtNum(bal);
  $("by-unit").textContent = bal === null ? "pick a later date" : `${dayWord(bal)} of leave`;
}

function setPlan(uses, before, after) {
  $("plan-uses").textContent = uses;
  $("plan-before").textContent = before;
  $("plan-after").textContent = after;
}

function renderTrip() {
  const first = $("trip-first").value;
  const last = $("trip-last").value;
  const note = $("trip-result");
  DatePicker.sync();
  $("trip-save").hidden = true;
  $("plan-after-tile").classList.remove("warn");
  setPlan("–", "–", "–");
  $("trip-clear").hidden = !first;
  note.textContent = "";
  if (!first || !last) {
    // Nothing picked: suggest the next 4-day weekend that costs 1 day of leave
    const w = Leave.nextFourDayWeekend(Leave.todayStr());
    if (w) {
      note.textContent = `Next 4-day weekend: ${shortDate(w.firstOff)} to ${shortDate(w.lastOff)} (${w.holiday}) for 1 day of leave. `;
      const go = document.createElement("button");
      go.type = "button";
      go.className = "link";
      go.textContent = "plan it";
      go.addEventListener("click", () => PlanCal.select(w.firstOff, w.lastOff));
      note.append(go);
    }
    return;
  }
  if (first <= state.settings.asOf) { note.textContent = "Pick days after your LES date."; return; }

  const used = Leave.chargedDays(first, last).length;
  const before = Leave.balanceOn(Leave.addDays(first, -1), state.settings, state.trips);
  const after = Leave.balanceOn(last, state.settings, state.trips) - used;
  setPlan(`${used}`, fmtNum(before), fmtNum(after));
  if (used === 0) {
    note.textContent = "All weekend or holiday, so it's free.";
    return;
  }
  if (after < 0) {
    $("plan-after-tile").classList.add("warn");
    note.textContent = `That's ${fmtNum(-after)} more than you'll have, so it would need advance leave.`;
  } else if (PlanCal.waitingForEnd) {
    note.textContent = "Now tap your last day off, or book just this day.";
  } else {
    note.textContent = `${shortDate(first)} to ${shortDate(last)}`;
  }
  $("trip-save").hidden = false;
}

function renderTrips() {
  const body = $("trips");
  body.innerHTML = "";
  const trips = [...state.trips].sort((a, b) => a.firstOff.localeCompare(b.firstOff));
  $("trips-empty").hidden = trips.length > 0;
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
    nm.textContent = t.name || "Leave";
    const dates = document.createElement("div");
    dates.className = "trip-dates";
    dates.textContent = t.firstOff === t.lastOff ? shortDate(t.firstOff) : `${shortDate(t.firstOff)} to ${shortDate(t.lastOff)}`;
    info.append(nm, dates);
    cell("trip-name", info);
    cell("trip-days", `${used}d`);
    const del = document.createElement("button");
    del.className = "link";
    del.innerHTML = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="square"/></svg>';
    del.setAttribute("aria-label", `Remove ${t.name || "this leave"}`);
    del.addEventListener("click", () => {
      if (!confirm(`Remove "${t.name || "Leave"}"? Its days go back into your balance.`)) return;
      state.trips = state.trips.filter((x) => x.id !== t.id);
      save();
      render();
    });
    cell("trip-del", del);
    body.append(tr);
  }
}

$("by-date").addEventListener("input", renderBy);
$("trip-clear").addEventListener("click", () => { PlanCal.clear(); renderTrip(); });

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
  swimFish();
});

greet();
render();

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
    $("hello").textContent = "Happy birthday, Abbey 🎂";
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
  $("next-date").textContent = shortDate(nextMonthEnd(today));

  // Leave already booked from today on
  let ahead = 0;
  for (const t of trips) ahead += Leave.chargedDays(t.firstOff, t.lastOff).filter((d) => d >= today).length;
  $("booked-total").innerHTML = `${ahead} <small>${dayWord(ahead)}</small>`;

  $("les-note").textContent = `Starting point: ${fmtNum(settings.balance)} days on your LES as of ${fmtDate(settings.asOf)}.`;
  const ageDays = (new Date(today) - new Date(settings.asOf)) / 86400000;
  if (ageDays > 120) $("les-note").textContent += " It's been a few months, worth checking it still matches your LES.";

  renderTrip();
  renderTrips();
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
  $("trip-save").hidden = true;
  $("plan-after-tile").classList.remove("warn");
  setPlan("–", "–", "–");
  note.textContent = "Pick dates to see what it costs.";
  if (!first || !last) return;
  if (last < first) { note.textContent = "The To date is before the From date."; return; }
  if (first <= state.settings.asOf) { note.textContent = "Pick dates after your LES date."; return; }

  const used = Leave.chargedDays(first, last).length;
  const before = Leave.balanceOn(Leave.addDays(first, -1), state.settings, state.trips);
  const after = Leave.balanceOn(last, state.settings, state.trips) - used;
  setPlan(`${used}`, fmtNum(before), fmtNum(after));
  if (used === 0) {
    note.textContent = "All weekend or holiday, so it's free. 🎉";
    return;
  }
  if (after < 0) {
    $("plan-after-tile").classList.add("warn");
    note.textContent = `That's ${fmtNum(-after)} more than you'll have, so it would need advance leave.`;
  } else {
    note.textContent = `${fmtDate(first)} to ${fmtDate(last)}`;
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
    del.textContent = "✕";
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

$("open-info").addEventListener("click", () => $("info").showModal());
$("trip-first").addEventListener("input", () => {
  // Jump the end date forward so the calendar opens near the start date
  if (!$("trip-last").value || $("trip-last").value < $("trip-first").value) $("trip-last").value = $("trip-first").value;
  renderTrip();
});
$("trip-last").addEventListener("input", renderTrip);
$("trip-save-btn").addEventListener("click", () => {
  state.trips.push({
    id: String(Date.now()),
    name: $("trip-name").value.trim(),
    firstOff: $("trip-first").value,
    lastOff: $("trip-last").value,
  });
  save();
  $("trip-first").value = "";
  $("trip-last").value = "";
  $("trip-name").value = "";
  render();
  swimFish();
});

greet();
render();

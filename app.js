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
function render() {
  if (!state.settings) return showSetup();
  $("setup").hidden = true;
  $("app").hidden = false;

  const { settings, trips } = state;
  const today = Leave.todayStr();

  const now = Leave.balanceOn(today, settings, trips);
  $("today-balance").innerHTML = `${fmtNum(now)} <small>${dayWord(now)}</small>`;
  const monthEnd = nextMonthEnd(today);
  $("today-next").textContent = `+2.5 more on ${fmtDate(monthEnd)}`;

  $("les-note").textContent = `Starting point: ${fmtNum(settings.balance)} days on your LES as of ${fmtDate(settings.asOf)}.`;
  const ageDays = (new Date(today) - new Date(settings.asOf)) / 86400000;
  if (ageDays > 120) $("les-note").textContent += " It's been a few months, worth checking it still matches your LES.";

  renderFuture();
  renderTrip();
  renderTrips();
}

function renderFuture() {
  const date = $("future-date").value;
  const out = $("future-result");
  if (!date) { out.textContent = ""; return; }
  const bal = Leave.balanceOn(date, state.settings, state.trips);
  if (bal === null) { out.textContent = "Pick a date after your LES date."; return; }
  out.innerHTML = `On ${fmtDate(date)} you'll have <strong>${fmtNum(bal)} ${dayWord(bal)}</strong>.`;
  out.classList.toggle("warn", bal < 0);
}

function renderTrip() {
  const first = $("trip-first").value;
  const last = $("trip-last").value;
  const out = $("trip-result");
  $("trip-save").hidden = true;
  out.classList.remove("warn");
  if (!first || !last) { out.textContent = ""; return; }
  if (last < first) { out.textContent = "The last day off is before the first one."; return; }
  if (first <= state.settings.asOf) { out.textContent = "Pick dates after your LES date."; return; }

  const used = Leave.chargedDays(first, last).length;
  if (used === 0) {
    out.textContent = "That's all weekend or holiday, so it costs no leave. 🎉";
    return;
  }
  const before = Leave.balanceOn(Leave.addDays(first, -1), state.settings, state.trips);
  const after = Leave.balanceOn(last, state.settings, state.trips) - used;
  let html = `That trip uses <strong>${used} ${dayWord(used)}</strong> of leave.<br>` +
    `You'll have ${fmtNum(before)} going in and <strong>${fmtNum(after)}</strong> after.`;
  if (after < 0) {
    html += `<br>That's ${fmtNum(-after)} more than you'll have, so it would need advance leave.`;
    out.classList.add("warn");
  }
  out.innerHTML = html;
  $("trip-save").hidden = false;
}

function renderTrips() {
  const list = $("trips");
  list.innerHTML = "";
  const trips = [...state.trips].sort((a, b) => a.firstOff.localeCompare(b.firstOff));
  $("trips-empty").hidden = trips.length > 0;
  for (const t of trips) {
    const used = Leave.chargedDays(t.firstOff, t.lastOff).length;
    const li = document.createElement("li");
    const text = document.createElement("div");
    text.className = "trip-text";
    const name = document.createElement("div");
    name.textContent = `${t.name || "Leave"} · ${used} ${dayWord(used)}`;
    const when = document.createElement("div");
    when.className = "when";
    when.textContent = `${fmtDate(t.firstOff)} to ${fmtDate(t.lastOff)}`;
    text.append(name, when);
    const del = document.createElement("button");
    del.textContent = "✕";
    del.setAttribute("aria-label", `Remove ${t.name || "this leave"}`);
    del.addEventListener("click", () => {
      if (!confirm(`Remove "${t.name || "Leave"}"? Its days go back into your balance.`)) return;
      state.trips = state.trips.filter((x) => x.id !== t.id);
      save();
      render();
    });
    li.append(fishIcon("fish"), text, del);
    list.append(li);
  }
}

$("future-date").addEventListener("input", renderFuture);
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

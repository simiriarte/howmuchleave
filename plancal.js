// The planner's always-on calendar. Tap a first day off, then a last day off;
// the days between fill in as bubbles. Booked leave shows as salmon dots.
// Writes into the hidden #trip-first / #trip-last inputs and fires "input" on
// #trip-last, so app.js's renderTrip() does the math.

(function () {
  const grid = document.getElementById("pc-grid");
  const title = document.getElementById("pc-title");
  const first = document.getElementById("trip-first");
  const last = document.getElementById("trip-last");

  let viewYear, viewMonth; // month on screen (0-11)
  let waitingForEnd = false; // true between the first and second tap

  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  function label(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  function bookedDays() {
    const days = new Set();
    for (const t of (window.PlanCal.trips || [])) {
      for (let d = t.firstOff; d <= t.lastOff; d = Leave.addDays(d, 1)) days.add(d);
    }
    return days;
  }

  function draw() {
    if (viewYear === undefined) {
      const start = first.value || Leave.todayStr();
      viewYear = Number(start.slice(0, 4));
      viewMonth = Number(start.slice(5, 7)) - 1;
    }
    title.textContent = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    grid.innerHTML = "";
    const today = Leave.todayStr();
    const booked = bookedDays();
    const a = first.value;
    const b = last.value || a;
    const charged = a ? new Set(Leave.chargedDays(a, b)) : new Set();
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const count = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let i = 0; i < firstDow; i++) grid.append(document.createElement("span"));
    for (let d = 1; d <= count; d++) {
      const date = ymd(viewYear, viewMonth, d);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pk-day";
      btn.textContent = d;
      let aria = label(date);
      if (Leave.isNonDutyDay(date)) btn.classList.add("off");
      const hol = Leave.holidayName(date);
      if (hol) { btn.classList.add("holiday"); btn.title = hol; aria += `, ${hol}`; }
      if (date.slice(5) === "10-02") {
        const f = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        f.setAttribute("viewBox", "0 0 120 64");
        f.setAttribute("class", "bday");
        f.setAttribute("aria-hidden", "true");
        const u = document.createElementNS("http://www.w3.org/2000/svg", "use");
        u.setAttribute("href", "#fish");
        f.append(u);
        btn.append(f);
        btn.title = "Abbey's birthday";
        aria += ", Abbey's birthday";
      }
      if (date === today) btn.classList.add("today");
      if (booked.has(date)) { btn.classList.add("booked"); aria += ", booked"; }
      if (a && date >= a && date <= b) {
        if (date === a || date === b) btn.classList.add("selected");
        else btn.classList.add(charged.has(date) ? "range" : "range-free");
        aria += ", in your plan";
      }
      btn.setAttribute("aria-label", aria);
      btn.addEventListener("click", () => tap(date));
      grid.append(btn);
    }
  }

  function tap(date) {
    if (!waitingForEnd || !first.value || date < first.value) {
      // start a new plan
      first.value = date;
      last.value = date;
      waitingForEnd = true;
    } else {
      last.value = date;
      waitingForEnd = false;
    }
    last.dispatchEvent(new Event("input"));
    draw();
  }

  function shift(n) {
    viewMonth += n;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    draw();
  }

  document.getElementById("pc-prev").addEventListener("click", () => shift(-1));
  document.getElementById("pc-next").addEventListener("click", () => shift(1));

  window.PlanCal = {
    trips: [],
    draw,
    get waitingForEnd() { return waitingForEnd; },
    clear() { first.value = ""; last.value = ""; waitingForEnd = false; draw(); },
    select(a, b) {
      first.value = a;
      last.value = b;
      waitingForEnd = false;
      viewYear = Number(a.slice(0, 4));
      viewMonth = Number(a.slice(5, 7)) - 1;
      last.dispatchEvent(new Event("input"));
      draw();
    },
  };
})();

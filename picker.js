// Our own date picker, so it can look like the rest of the app.
// Any <button data-date-for="someInputId"> opens it; the picked date goes into that
// (hidden) input and fires an "input" event, so app.js doesn't need to know.
//
// Optional on the button:
//   data-min-from="otherInputId"  earliest pickable day = that input's value
//   data-max="today"              no days after today
//   data-placeholder="pick a date"
//   data-then="otherButtonId"     open that picker right after this one (From → To)

(function () {
  const dlg = document.getElementById("picker");
  const grid = document.getElementById("pk-grid");
  const title = document.getElementById("pk-title");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let current = null; // { button, input, min, max }
  let viewYear, viewMonth; // month on screen (month is 0-11)

  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

  function label(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // Refresh every date button's text from its input
  function sync() {
    for (const btn of document.querySelectorAll("[data-date-for]")) {
      const input = document.getElementById(btn.dataset.dateFor);
      const target = btn.querySelector(".dp-label") || btn;
      target.textContent = input.value ? label(input.value) : btn.dataset.placeholder || "pick a date";
      btn.classList.toggle("empty", !input.value);
    }
  }

  function draw() {
    // leftover fizz from the last pick freezes once the calendar closes, so clear it
    for (const f of dlg.querySelectorAll(".pk-fizz")) f.remove();
    title.textContent = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    grid.innerHTML = "";
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const days = new Date(viewYear, viewMonth + 1, 0).getDate();
    const today = Leave.todayStr();
    for (let i = 0; i < firstDow; i++) grid.append(document.createElement("span"));
    for (let d = 1; d <= days; d++) {
      const date = ymd(viewYear, viewMonth, d);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pk-day";
      b.textContent = d;
      b.setAttribute("aria-label", label(date));
      if (Leave.isNonDutyDay(date)) b.classList.add("off");
      const hol = Leave.dayOffName(date);
      if (hol) { b.classList.add("holiday"); b.title = hol; b.setAttribute("aria-label", `${label(date)}, ${hol}`); }
      if (date.slice(5) === "10-02") {
        // her birthday: a cake instead of the number
        b.textContent = "";
        b.classList.add("birthday");
        const cake = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        cake.setAttribute("viewBox", "0 0 20 20");
        cake.setAttribute("class", "bday-cake");
        cake.setAttribute("aria-hidden", "true");
        const u = document.createElementNS("http://www.w3.org/2000/svg", "use");
        u.setAttribute("href", "#cake");
        cake.append(u);
        b.append(cake);
        b.title = "Abbey's birthday";
        b.setAttribute("aria-label", `${label(date)}, Abbey's birthday`);
      }
      if (date === today) b.classList.add("today");
      if (date === current.input.value) {
        b.classList.add("selected");
        b.setAttribute("aria-pressed", "true");
      }
      if ((current.min && date < current.min) || (current.max && date > current.max)) b.disabled = true;
      b.addEventListener("click", () => pick(date, b));
      grid.append(b);
    }
  }

  function fizz(fromEl) {
    // a handful of tiny bubbles float up out of the picked day
    const box = dlg.getBoundingClientRect();
    const r = fromEl.getBoundingClientRect();
    for (let i = 0; i < 7; i++) {
      const f = document.createElement("span");
      f.className = "pk-fizz";
      const size = 4 + Math.random() * 7;
      f.style.width = f.style.height = `${size}px`;
      f.style.left = `${r.left - box.left + r.width / 2 - size / 2 + (Math.random() - 0.5) * 22}px`;
      f.style.top = `${r.top - box.top + r.height / 2}px`;
      f.style.animationDelay = `${Math.random() * 120}ms`;
      f.style.setProperty("--drift", `${(Math.random() - 0.5) * 30}px`);
      dlg.append(f);
      f.addEventListener("animationend", () => f.remove());
    }
  }

  function pick(date, el) {
    const { input, button } = current;
    input.value = date;
    for (const b of grid.querySelectorAll(".selected")) b.classList.remove("selected");
    el.classList.add("selected", "pop");
    if (!reduceMotion) fizz(el);
    setTimeout(() => {
      dlg.close();
      input.dispatchEvent(new Event("input"));
      sync();
      const next = button.dataset.then && document.getElementById(button.dataset.then);
      if (next) open(next);
      else button.focus();
    }, reduceMotion ? 0 : 520);
  }

  function open(button) {
    const input = document.getElementById(button.dataset.dateFor);
    const minFrom = button.dataset.minFrom && document.getElementById(button.dataset.minFrom).value;
    current = {
      button,
      input,
      min: minFrom || null,
      max: button.dataset.max === "today" ? Leave.todayStr() : null,
    };
    const start = input.value || minFrom || Leave.todayStr();
    viewYear = Number(start.slice(0, 4));
    viewMonth = Number(start.slice(5, 7)) - 1;
    draw();
    dlg.showModal();
    (grid.querySelector(".selected") || grid.querySelector(".today") || grid.querySelector(".pk-day:not(:disabled)"))?.focus();
  }

  function shift(n) {
    viewMonth += n;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    draw();
  }

  document.getElementById("pk-prev").addEventListener("click", () => shift(-1));
  document.getElementById("pk-next").addEventListener("click", () => shift(1));
  document.getElementById("pk-today").addEventListener("click", () => {
    const t = Leave.todayStr();
    viewYear = Number(t.slice(0, 4));
    viewMonth = Number(t.slice(5, 7)) - 1;
    draw();
  });
  // Tapping the dimmed area outside the calendar closes it
  dlg.addEventListener("click", (e) => {
    const r = dlg.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (e.target === dlg && outside) dlg.close();
  });

  for (const btn of document.querySelectorAll("[data-date-for]")) {
    btn.addEventListener("click", () => open(btn));
  }

  window.DatePicker = { sync };
  sync();
})();

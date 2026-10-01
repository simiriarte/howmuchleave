// Leave math for Air Force leave (DAFI 36-3003).
// Dates are plain "YYYY-MM-DD" strings everywhere so time zones can't shift a day.

(function (root) {
  const ACCRUAL_PER_MONTH = 2.5;

  // ---- date helpers (all in UTC so no daylight-saving or time-zone surprises) ----
  function toDate(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  function toStr(dt) {
    return dt.toISOString().slice(0, 10);
  }
  function addDays(s, n) {
    const dt = toDate(s);
    dt.setUTCDate(dt.getUTCDate() + n);
    return toStr(dt);
  }
  function todayStr() {
    // The device's own calendar date (Hawaii time on her phone).
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  // ---- federal holidays (non-duty days) ----
  function nthWeekday(year, month, weekday, n) {
    // n-th given weekday (0=Sun) of a month; month is 1-12
    const first = new Date(Date.UTC(year, month - 1, 1));
    const offset = (weekday - first.getUTCDay() + 7) % 7;
    return toStr(new Date(Date.UTC(year, month - 1, 1 + offset + 7 * (n - 1))));
  }
  function lastWeekday(year, month, weekday) {
    const last = new Date(Date.UTC(year, month, 0));
    const offset = (last.getUTCDay() - weekday + 7) % 7;
    return toStr(new Date(Date.UTC(year, month - 1, last.getUTCDate() - offset)));
  }
  function observed(year, month, day) {
    // Saturday holidays are observed Friday, Sunday holidays Monday
    const dt = new Date(Date.UTC(year, month - 1, day));
    const dow = dt.getUTCDay();
    if (dow === 6) dt.setUTCDate(day - 1);
    if (dow === 0) dt.setUTCDate(day + 1);
    return toStr(dt);
  }
  const holidayCache = {};
  // Federal holidays for a year, as a map of observed date -> name
  function federalHolidays(year) {
    if (!holidayCache[year]) {
      holidayCache[year] = new Map([
        [observed(year, 1, 1), "New Year's Day"],
        [nthWeekday(year, 1, 1, 3), "Martin Luther King Jr. Day"],
        [nthWeekday(year, 2, 1, 3), "Presidents Day"],
        [lastWeekday(year, 5, 1), "Memorial Day"],
        [observed(year, 6, 19), "Juneteenth"],
        [observed(year, 7, 4), "Independence Day"],
        [nthWeekday(year, 9, 1, 1), "Labor Day"],
        [nthWeekday(year, 10, 1, 2), "Columbus Day"],
        [observed(year, 11, 11), "Veterans Day"],
        [nthWeekday(year, 11, 4, 4), "Thanksgiving"],
        [observed(year, 12, 25), "Christmas"],
        [observed(year + 1, 1, 1), "New Year's Day"], // can be observed Dec 31
      ]);
    }
    return holidayCache[year];
  }
  function holidayName(s) {
    return federalHolidays(Number(s.slice(0, 4))).get(s) || null;
  }
  // Abbey's unit gets the Friday after Thanksgiving off (a family day).
  // Kept separate from federal holidays so those stay exactly the official list.
  function familyDayName(s) {
    const thanksgiving = nthWeekday(Number(s.slice(0, 4)), 11, 4, 4);
    return s === addDays(thanksgiving, 1) ? "Day after Thanksgiving" : null;
  }
  // Any day off that isn't a weekend: federal holiday or family day
  function dayOffName(s) {
    return holidayName(s) || familyDayName(s);
  }
  function isNonDutyDay(s) {
    const dow = toDate(s).getUTCDay();
    if (dow === 0 || dow === 6) return true;
    return dayOffName(s) !== null;
  }

  // ---- the leave rules ----

  // Days charged for a trip from first day off to last day off (inclusive).
  // Weekends/holidays at either edge are free; everything in between counts.
  function chargedDays(firstOff, lastOff) {
    if (!firstOff || !lastOff || lastOff < firstOff) return [];
    let start = firstOff;
    let end = lastOff;
    while (start <= end && isNonDutyDay(start)) start = addDays(start, 1);
    while (end >= start && isNonDutyDay(end)) end = addDays(end, -1);
    const days = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    return days;
  }

  // Month-end credits of 2.5 days after `fromDate` up to and including `toDateStr`.
  function monthEndsBetween(fromDate, toDateStr) {
    let count = 0;
    const from = toDate(fromDate);
    let y = from.getUTCFullYear();
    let m = from.getUTCMonth() + 1;
    for (;;) {
      const monthEnd = toStr(new Date(Date.UTC(y, m, 0)));
      if (monthEnd > toDateStr) break;
      if (monthEnd > fromDate) count++;
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return count;
  }

  // Balance on a date: the LES number, plus 2.5 at every month end since,
  // minus any booked leave days after the LES date up to that date.
  function balanceOn(date, settings, trips, skipTripId) {
    if (date < settings.asOf) return null;
    let balance = settings.balance + ACCRUAL_PER_MONTH * monthEndsBetween(settings.asOf, date);
    for (const t of trips) {
      if (t.id === skipTripId) continue;
      for (const d of chargedDays(t.firstOff, t.lastOff)) {
        if (d > settings.asOf && d <= date) balance -= 1;
      }
    }
    return balance;
  }

  // The next `count` long weekends: 3 or more days off in a row that include a
  // federal holiday and use no leave. One still in progress today counts.
  // Returns [{ firstOff, lastOff, holiday }].
  function nextLongWeekends(today, count) {
    const found = [];
    let d = addDays(today, -4);
    const stop = addDays(today, 800);
    while (found.length < count && d <= stop) {
      if (!isNonDutyDay(d)) { d = addDays(d, 1); continue; }
      // a run of days off starts here
      const start = d;
      let holiday = null;
      while (isNonDutyDay(d)) { holiday = holiday || holidayName(d); d = addDays(d, 1); }
      const end = addDays(d, -1);
      const length = chargedDays(start, end).length === 0 ? Math.round((toDate(end) - toDate(start)) / 86400000) + 1 : 0;
      if (holiday && length >= 3 && end >= today) found.push({ firstOff: start, lastOff: end, holiday });
    }
    return found;
  }

  const api = { ACCRUAL_PER_MONTH, addDays, todayStr, isNonDutyDay, holidayName, familyDayName, dayOffName, chargedDays, monthEndsBetween, balanceOn, nextLongWeekends };
  if (typeof module !== "undefined") module.exports = api;
  else root.Leave = api;
})(this);

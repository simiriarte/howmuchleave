// Run with: node leave.test.js
const assert = require("assert");
const L = require("./leave.js");

const n = (a, b) => L.chargedDays(a, b).length;

// The examples from the README
assert.strictEqual(n("2026-10-12", "2026-10-16"), 4, "Columbus Day Mon Oct 12 is on the edge, so free");
assert.strictEqual(n("2026-10-19", "2026-10-23"), 5, "Mon-Fri = 5");
assert.strictEqual(n("2026-10-23", "2026-10-26"), 4, "Fri + Mon = 4, weekend in between counts");
assert.strictEqual(n("2026-10-23", "2026-10-23"), 1, "Fri only = 1");
assert.strictEqual(n("2026-10-24", "2026-10-25"), 0, "weekend only = 0");
assert.strictEqual(n("2026-10-17", "2026-10-25"), 5, "Sat to Sun next week: only Mon-Fri count");
assert.strictEqual(n("2026-10-19", "2026-10-30"), 12, "two work weeks with the weekend inside = 12");

// Holidays
assert.ok(L.isNonDutyDay("2026-11-26"), "Thanksgiving 2026");
assert.ok(L.isNonDutyDay("2026-07-03"), "July 4 2026 is Saturday, observed Friday Jul 3");
assert.ok(L.isNonDutyDay("2026-12-25"), "Christmas");
assert.ok(!L.isNonDutyDay("2026-12-24"), "Christmas Eve is a duty day");
assert.strictEqual(n("2026-12-21", "2027-01-01"), 11, "Dec 21 - Jan 1: New Year's Day edge is free, Christmas inside counts");

// Accrual
assert.strictEqual(L.monthEndsBetween("2026-09-30", "2026-09-30"), 0);
assert.strictEqual(L.monthEndsBetween("2026-09-30", "2026-10-31"), 1);
assert.strictEqual(L.monthEndsBetween("2026-09-30", "2027-09-30"), 12);
assert.strictEqual(L.monthEndsBetween("2026-10-01", "2026-10-30"), 0);

// Balance
const settings = { balance: 10, asOf: "2026-09-30" };
const trips = [{ id: "a", firstOff: "2026-10-19", lastOff: "2026-10-23" }];
assert.strictEqual(L.balanceOn("2026-10-01", settings, trips), 10);
assert.strictEqual(L.balanceOn("2026-10-21", settings, trips), 7, "mid-trip: 3 days used so far");
assert.strictEqual(L.balanceOn("2026-10-31", settings, trips), 7.5, "10 - 5 + 2.5");
assert.strictEqual(L.balanceOn("2026-10-31", settings, trips, "a"), 12.5, "skipping the trip");
assert.strictEqual(L.balanceOn("2026-09-01", settings, trips), null, "before the LES date");

// Holiday names
assert.strictEqual(L.holidayName("2026-11-26"), "Thanksgiving");
assert.strictEqual(L.holidayName("2026-07-03"), "Independence Day", "observed Friday");
assert.strictEqual(L.holidayName("2026-12-24"), null);

// Family day: the Friday after Thanksgiving is off
assert.strictEqual(L.familyDayName("2026-11-27"), "Day after Thanksgiving");
assert.strictEqual(L.familyDayName("2027-11-26"), "Day after Thanksgiving");
assert.ok(L.isNonDutyDay("2026-11-27"));
assert.strictEqual(L.holidayName("2026-11-27"), null, "not a federal holiday");
assert.strictEqual(n("2026-11-23", "2026-11-29"), 3, "Thanksgiving week Mon-Sun: only Mon-Wed use leave");

// Next 3 long weekends
assert.deepStrictEqual(L.nextLongWeekends("2026-10-01", 3), [
  { firstOff: "2026-10-10", lastOff: "2026-10-12", holiday: "Columbus Day" },
  { firstOff: "2026-11-26", lastOff: "2026-11-29", holiday: "Thanksgiving" },
  { firstOff: "2026-12-25", lastOff: "2026-12-27", holiday: "Christmas" },
]);
assert.strictEqual(L.nextLongWeekends("2026-10-11", 1)[0].firstOff, "2026-10-10", "a long weekend in progress still shows");

// Every federal holiday 2026-2028 matches OPM's official list exactly
// (opm.gov/policy-data-oversight/pay-leave/federal-holidays, checked 2026-10-01)
const opm = {
  "2026-01-01": "New Year's Day", "2026-01-19": "Martin Luther King Jr. Day", "2026-02-16": "Presidents Day", "2026-05-25": "Memorial Day", "2026-06-19": "Juneteenth", "2026-07-03": "Independence Day", "2026-09-07": "Labor Day", "2026-10-12": "Columbus Day", "2026-11-11": "Veterans Day", "2026-11-26": "Thanksgiving", "2026-12-25": "Christmas",
  "2027-01-01": "New Year's Day", "2027-01-18": "Martin Luther King Jr. Day", "2027-02-15": "Presidents Day", "2027-05-31": "Memorial Day", "2027-06-18": "Juneteenth", "2027-07-05": "Independence Day", "2027-09-06": "Labor Day", "2027-10-11": "Columbus Day", "2027-11-11": "Veterans Day", "2027-11-25": "Thanksgiving", "2027-12-24": "Christmas", "2027-12-31": "New Year's Day",
  "2028-01-17": "Martin Luther King Jr. Day", "2028-02-21": "Presidents Day", "2028-05-29": "Memorial Day", "2028-06-19": "Juneteenth", "2028-07-04": "Independence Day", "2028-09-04": "Labor Day", "2028-10-09": "Columbus Day", "2028-11-10": "Veterans Day", "2028-11-23": "Thanksgiving", "2028-12-25": "Christmas",
};
for (const [d, n] of Object.entries(opm)) assert.strictEqual(L.holidayName(d), n, `OPM: ${d} should be ${n}`);
for (let d = "2026-01-01"; d <= "2028-12-31"; d = L.addDays(d, 1)) {
  if (L.holidayName(d)) assert.ok(opm[d], `${d} is not on OPM's list`);
}

// 60-day carryover cap on Oct 1 (use or lose)
const high = { balance: 58, asOf: "2026-07-31" };
assert.strictEqual(L.balanceOn("2026-09-30", high, []), 63, "58 + Aug + Sep");
assert.strictEqual(L.balanceOn("2026-10-01", high, []), 60, "over 60 is lost on Oct 1");
assert.strictEqual(L.balanceOn("2026-10-31", high, []), 62.5, "then keeps accruing");
const usedSome = [{ id: "s", firstOff: "2026-09-14", lastOff: "2026-09-18" }];
assert.strictEqual(L.balanceOn("2026-10-01", high, usedSome), 58, "using 5 in Sept keeps it under the cap");
assert.deepStrictEqual(L.useOrLose("2026-08-15", high, []), { days: 3, fyEnd: "2026-09-30" });
assert.strictEqual(L.useOrLose("2026-08-15", high, usedSome), null);
assert.strictEqual(L.useOrLose("2026-10-01", { balance: 12.5, asOf: "2026-09-30" }, []), null, "12.5 + 12 months = 42.5, nothing lost");

console.log("All leave tests passed");

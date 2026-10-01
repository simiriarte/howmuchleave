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

// Next 4-day weekend for 1 day of leave
assert.deepStrictEqual(L.nextFourDayWeekend("2026-10-01"), { firstOff: "2026-10-09", lastOff: "2026-10-12", leaveDay: "2026-10-09", holiday: "Columbus Day" });
assert.deepStrictEqual(L.nextFourDayWeekend("2026-10-12"), { firstOff: "2026-11-26", lastOff: "2026-11-29", leaveDay: "2026-11-27", holiday: "Thanksgiving" });

console.log("All leave tests passed");

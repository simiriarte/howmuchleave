# howmuchleave

A small leave calculator for Abbey: how much leave she has today, how much she'll have on any future date, and how many days a trip would cost.

Built as a birthday gift, October 2026.

## Leave rules it follows (Air Force, DAFI 36-3003)

- Earns 2.5 days per month, regardless of rank.
- Every calendar day from the first day off through the last day off counts, weekends and holidays included.
- Weekends and holidays at the very start or very end of a trip don't count. So Mon–Fri off costs 5 days, but Fri + Mon off costs 4, because Sat and Sun fall in between.
- The Friday after Thanksgiving is treated as a day off (her unit's family day). Other base family days aren't known to the app.
- Federal holiday dates are checked against OPM's official list in `leave.test.js`.
- The official number is always the one on her LES / LeaveWeb. This app gives an estimate.

## Credits

- Heading font: [Bagel Fat One](https://fonts.google.com/specimen/Bagel+Fat+One), SIL Open Font License.
- Colours: from the chicken painting printed for Abbey's 2025 birthday.

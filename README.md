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

## Sync between devices (ocean codes)

Everything is kept in the browser first. If she turns on **sync**, the app makes an ocean code
(like `coral-tuna-kelp-reef-42`); typing it on another device links them. Every save goes to
a tiny private store on AWS and the newest copy wins when the app is opened or refocused.

- AWS account `888990920336`, `us-east-1`, all tagged `Project=howmuchleave`:
  - DynamoDB table `howmuchleave-ponds` (pay per request)
  - Lambda `howmuchleave-sync` (code in `sync/index.mjs`), capped at 5 concurrent runs
  - IAM role `howmuchleave-sync-role` (Get/Put on that one table + its own logs)
  - Function URL with CORS limited to `https://simiriarte.github.io` (and localhost for testing)
- Redeploy the function: `cd sync && zip -q fn.zip index.mjs && aws lambda update-function-code --function-name howmuchleave-sync --zip-file fileb://fn.zip`
- The ocean code is the only key. Anyone who has it can see the trips, so keep it private.

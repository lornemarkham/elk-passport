# The Markham Adventure ❤️ — release steps (operator)

Nothing here has been run against production. Built on the shared adventure
core: kind `date-night-plan`, pages `/markham` (front door) and `/night/<id>`.
Config: `src/domain/date-night/adventures/markham.ts`.

1. Supabase SQL editor (Passport project), in order, each guarded and safe twice:
   - `20261101000000_passport_adventure_together.sql` (memories; **skip if already applied**)
   - `20261102100000_passport_adventure_packing.sql` (packing list)
     Without them the app still works: the page says packing / memories "aren't
     switched on yet".
2. Deploy `main` (push to GitHub main).
3. Lorne signs in on gohaveaday.com, opens `/markham`, taps **Open our adventure**,
   then **Send the invitation** and sends the text to Jess.
4. Jess opens the link, taps **Sign in to join** (email + password, or Google),
   then **I'm in**.

Known limits: King Eddie is not in Atlas (corpus of 2026-10-24); it is a
personal idea with a caution. Photos on cards only appear for Atlas places
(the mystery pick). Jess must create an account (no anonymous join).
The older anonymous `/lorne-and-jess` questionnaire is untouched.

Verify locally: `docs/product/date-night/verification/markham.spec.ts` (two
phones) and `src/lib/date-night/night.stack.test.ts` (real RLS), both against
`stack.mjs start`.

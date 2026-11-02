# Date Night — release steps (operator)

Nothing here has been run against production. In order:

1. **Database** (Supabase SQL editor, Passport project). Paste
   `supabase/migrations/20261102000000_passport_date_nights.sql`. It is
   guarded, so running it twice is harmless. It needs the adventures core,
   which production already has.
2. **Lorne's account must exist.** Sign up or sign in on gohaveaday.com with
   the email you'll read answers with.
3. **Create the night** (SQL editor), with that email:

   ```sql
   select public.passport_date_night_setup(
     'lorne-and-jess', '<your sign-in email>', 'Lorne ❤️ Jess',
     '2026-11-02', 'America/Vancouver', 'Around Vernon');
   ```

   The first account set up owns the slug. A second run returns the same
   adventure id and changes nothing.

4. **Optional, for the forecast:** set `WEATHER_PROVIDER=msc` in Vercel
   (Production). Without it the page links to Environment Canada instead.
5. **Deploy** the branch (push to GitHub `main`; Vercel builds `main`).
6. **Smoke test, on a phone:**
   - `https://gohaveaday.com/lorne-and-jess` returns 200 with the headline.
   - Send a test answer in a private window.
   - `https://gohaveaday.com/lorne-and-jess/answers` signed in shows it.
     Signed out, it shows "These answers are private".
   - Delete the test answer in the SQL editor:
     `delete from passport_date_night_answers where slug='lorne-and-jess';` in
     the SQL editor, before sending Jess the link.

Close the night afterwards:
`update passport_date_nights set open = false where slug = 'lorne-and-jess';`

Rollback: `drop table passport_date_night_answers, passport_date_nights;` and
drop the three `passport_date_night_*` functions. The adventure row stays as a
harmless `date-night` adventure. Delete it from `/adventures` if you like.

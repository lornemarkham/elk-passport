# Hockey Night — owner activation checklist

**The night:** Sunday 25 October 2026, Canucks vs Wild, Rogers Arena, 7:00pm
Pacific (date and time cross-checked against public ticket listings on
2026-10-13). Do steps 1–7 **by Friday 23 October**, so a failure is a Friday
problem and not a Sunday one.

Detail and reasoning for every step: [`PRODUCTION-READINESS.md`](PRODUCTION-READINESS.md).
This lane has applied, deployed, merged and pushed **nothing**.

| #   | Do this                                                                                                                                                                                                                                                                                                                                                                                                  | Done when                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | **Decide the origin** invitations come from. Use the plain Passport origin (`elk-passport.vercel.app`, or a Passport custom domain), not `iamoctober.com`. Write it down: it is `<origin>` below.                                                                                                                                                                                                        | you can say it                                                  |
| 2   | **Supabase → Authentication → URL configuration:** add `https://<origin>/**` to _Redirect URLs_.                                                                                                                                                                                                                                                                                                         | entry saved                                                     |
| 3   | **Supabase → Authentication → Providers → Email:** decide _Confirm email_ on or off. **If on, Supabase → Authentication → SMTP must be a custom SMTP server** (the built-in mailer is rate-limited and may only reach team members; check current Supabase docs). Send yourself a test sign-up.                                                                                                          | a second email address you do not own receives the confirmation |
| 4   | **SQL editor, production project** (never `supabase db push`): run `preflight.sql` → every row `OK`; run all of `migration.sql`; run `verify.sql` → every row `OK`.                                                                                                                                                                                                                                      | `verify.sql`: 9 rows, all `OK`                                  |
| 5   | **Vercel `elk-passport` env, then build:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are the **same project as step 4** (anon key, never service-role); `ATLAS_API_URL=https://elk-atlas.vercel.app` (no `/api`); `ATLAS_SERVICE_TOKEN` unchanged. No new variable.                                                                                                                 | values checked **before** the build (they are inlined at build) |
| 6   | **Get, merge, deploy** (a person, on the Mac): fetch `feature/hockey`, merge it into **the branch production was last deployed from** (not necessarily `main`: production is a CLI deploy, and as of 2026-10-13 the Passport release line is `integration/release`), run the gates, `npx vercel deploy --prod`. Merging into a branch that lacks what production runs would deploy a different Passport. | deployment is live                                              |
| 7   | **Smoke test** (`PRODUCTION-READINESS.md` §6, ≈5 min) then the **two-account script** (§7, ≈10 min, second person on a phone, email opened on a different device).                                                                                                                                                                                                                                       | §7 passes: steps 2, 6–8, 10–11, 13–15                           |
| 8   | **Only now** make links in the guest list and send them. One link per person; each works once.                                                                                                                                                                                                                                                                                                           | each guest is on the roster                                     |
| 9   | **On the night, as host:** after puck drop, use **Call it** to record results (score, first goal, overtime, total goals, beer, refs). Passport has no scores feed.                                                                                                                                                                                                                                       | the Sycle Cup shows standings                                   |

## If something is wrong

| Symptom                                       | Lever (smallest first)                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| Site broken after deploy                      | Vercel → previous deployment → **Instant Rollback**                         |
| Stop anyone starting or joining               | SQL editor: `disable.sql` (deletes nothing; `enable.sql` undoes it)         |
| A link leaked                                 | Host: revoke it in the guest list                                           |
| Someone should not be there                   | Host: **Remove** in the guest list                                          |
| Migration errored part-way                    | Re-run `migration.sql` from the top (idempotent)                            |
| Confirmed guest lands on the homepage, no job | Step 2 is wrong: the redirect is not allow-listed. They can reopen the link |

## Information only you can supply

- **Rogers Arena, for the group (not in the product, not asked of anyone):**
  which entrance or meeting point, ticket seating (sections), the transit or
  parking plan, and the agreed meeting time before puck drop. Passport holds
  none of this; put it in the host's first message in the night.
- **Food near the arena:** production Atlas now holds Rogers Arena and 19
  restaurants and bars within 1.6 km (measured 2026-10-13). "What's near the
  arena?" should list real places. Re-check on Friday:
  `node docs/product/hockey/verification/prod-nearby-check.mjs`. Group
  nominations by name work either way.
- **Doctrine decision:** doctrine §10 and §15 leave group experiences
  open, and §14 lists elaborate social games as not-now. This ships one private
  night. You decide whether that is now canonical; if so update the doctrine in
  the same change.
- **Hardening choice:** `REVOKE TRUNCATE` on the new tables
  (`PRODUCTION-READINESS.md` §2.4.1). Not a blocker.

# People's Pulse — release readiness (M937, 2026-11-18)

## Where it stands

**People's Pulse is already in production.** The brief assumed four pending
migrations and an unreleased branch. In fact the ELK release runner
auto-shipped all of it today under the standing AUTO-SHIP authority
(approved by Lorne 2026-10-15). Source: `~/.local/state/elk-release/ledger.jsonl`.

| Release (runner)                  | Deployed sha (GitHub main) | Vercel deployment                  | Migrations applied before deploy                                                       |
| --------------------------------- | -------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------- |
| `passport-31be60b-20261118081656` | `34d3015`                  | `dpl_BAh99CJJ2yEX5NJZqLXZByNhiizS` | none (last deploy **before** People's Pulse)                                           |
| `passport-f962972-20261118111559` | `d15e2f2`                  | `dpl_8nNFNWmV4b4qYEmb1Z7vBJ9C48hb` | `20261118000000_passport_pulse`, `20261118120000_…_featured`, `20261119000000_…_modes` |
| `passport-689888c-20261118171453` | `7e96166`                  | `dpl_GfTgthr3Y7ozpfhb2j7RMyPnGnYi` | `20261120000000_passport_pulse_check`                                                  |

`7e96166`'s tree is identical to local main `689888c`. Each migration was
applied in one transaction after a verified recovery point:

- `backups/passport-f962972-20261118111559.dump` (before the first three)
- `backups/passport-689888c-20261118171453.dump` (before Pulse Check; 17.4 MB,
  110 tables, sha256 `1809b08cada0…`)

Both are in `~/.local/state/elk-release/`, with a manifest beside each.

The runner's own smoke test checked `/`, `/discovery`, `/christmas`, `/snow`
and other pages, but **no People's Pulse page**. M937 covered that gap (below).

## Commit inventory

People's Pulse commits, all in production:

| Commit    | What                                                               |
| --------- | ------------------------------------------------------------------ |
| `6de58cc` | V1: ask, share, vote, compare, moderation (`/labs/pulse`)          |
| `d730a0b` | V2: map, opinion shifts, results card, Question of the Day, circle |
| `f962972` | Quick Ideas: decide / settle / normal / rank kinds                 |
| `eaaa63c` | Pulse Check (`/check`)                                             |
| `689888c` | Pulse Check route tests, spec tidy                                 |

M937 adds one commit on top: phone fixes (CSS classes only) and this document.
It contains no migration and no new route.

## Database review

All four migrations are **additive**. They `CREATE TABLE IF NOT EXISTS`,
`ADD COLUMN IF NOT EXISTS` (three nullable columns on `passport_pulse_votes`)
and `CREATE OR REPLACE FUNCTION`. None drops or rewrites existing data. None
touches tables outside `passport_pulse_*`.

- **Order:** pulse → featured → modes → check. Modes replaces V1's
  `passport_pulse_list` and adds columns to V1's votes table. Check reuses
  V1's `passport_pulses` and the V1 daily creation limit. Applied in exactly
  that order.
- **Access:** every table has RLS enabled and `REVOKE ALL … FROM PUBLIC, anon,
authenticated`, with no policies. The only way in is SECURITY DEFINER
  functions (`search_path = public`). Each one first calls
  `passport_pulse_check(p_key)`, which compares a SHA-256 of the server's
  secret to the single claimed row in `passport_pulse_keys`. The anon key alone
  can do nothing. Device and network identifiers are stored as keyed one-way
  hashes.
- **Key claim:** the first server to call `passport_pulse_claim` owns the key.
  Production renders its shelves and returns 404, not 503, for unknown IDs, so
  production's server holds the claim.
- **Rollback SQL** lives outside the migrations, so the runner's
  destructive-SQL scan stays clean:
  - `docs/product/pulse/PEOPLES-PULSE.md`
  - `PEOPLES-PULSE-V2.md`
  - `QUICK-IDEAS.md` (then re-run V1's `passport_pulse_list`)
  - `PULSE-CHECK.md`

  The drop lists cover every object each migration creates.

- **Data loss:** applying lost nothing. Rolling the **database** back drops
  every Pulse, vote, check, post and report people have made since. Prefer an
  app rollback.

## Rollback procedure (least destructive first)

1. **Hide Pulse Check only:** in Vercel → elk-passport → Deployments, promote
   `dpl_8nNFNWmV4b4qYEmb1Z7vBJ9C48hb` (`d15e2f2`, Pulse without Check). The
   check tables stay and nothing reads them.
2. **Hide People's Pulse entirely:** promote `dpl_BAh99CJJ2yEX5NJZqLXZByNhiizS`
   (`34d3015`). The Pulse tables stay, unreadable. Both promotions also roll
   back anything else shipped since. As of this writing, that is only People's
   Pulse.
3. **Remove the database objects** (destroys user data): run the Rollback SQL
   from the four docs in reverse order (check → modes → featured → pulse) in
   the Supabase SQL editor, after a fresh backup.
4. **Full restore** (last resort; also reverts any **other** writes since):
   `npx tsx scripts/elk-release.ts db-restore --project passport --point <dump>`
   in `~/forge`, per the manifest beside the dump.

A promoted older deployment is overwritten by the next runner ship. Pause the
runner or revert on main if the rollback must stick.

## Verification (M937, local main 689888c + M937 fixes)

- Unit: 4860 passed, 73 skipped (`npx vitest run`).
- Database stack tests against a real local Postgres + PostgREST + GoTrue with
  all four migrations: `store.stack.test`, `checkStore.stack.test`, 18/18.
- Browser, against `next start` + that stack, desktop and Pixel 7: all **38**
  tests pass in `peoples-pulse`, `peoples-pulse-v2` (including Question of the
  Day), `quick-ideas` and `pulse-check`. They cover:
  - create (all kinds); refusing unsafe questions; share links and circle
    referral
  - voting and the bot-speed guard; results, results card and map
  - submitting a check, including social-link refusal, upload, evidence
    reading and publishing
  - discussion posts; reports pausing a Pulse; admin-only moderation
  - keyboard ballot and tap-target checks
- `labs.spec` + `creative.spec`: 29/30. The failure is `/labs/experience/*`
  needing Atlas, which isn't on this machine (known; unrelated).
- `tsc`, `eslint`, `prettier` clean on the changed files; `next build` passes.
- **Production, read-only, phone user agent:**
  - `/labs/pulse`, `/labs/pulse/new`, `/check` and `/check/new`: 200, with live
    shelves, not "still being set up".
  - Unknown Pulse or check: 404.
  - `/admin/pulse` sends signed-out visitors to sign-in; both admin APIs return 401.
  - `/api/pulse/check/<id>/file` returns 404 when signed out.
  - Share images render as PNG.

### Not verified (needs a person on production)

Nothing was written to production from here. These need a real phone:

## Smoke-test checklist (production, two phones)

1. Phone A: `/labs/pulse` → Ask everyone → create a Yes/No Pulse → Copy link.
2. Phone B (other network): open the link, vote, and see results; Phone A's
   count rises within about 10 s.
3. Phone A: Should I Do It? (private) → it is **not** listed on `/labs/pulse`;
   the link works.
4. Phone A: `/check/new` with a news link → Read → write the claim → publish
   after the Investigate step → share; Phone B opens it, posts in the
   discussion, and reports a post.
5. Paste the check link into Facebook's Sharing Debugger; the card shows the
   claim.
6. Signed out: `/api/pulse/check/<that id>/file` returns 404.
7. Admin account: `/admin/pulse` lists the report; hide and restore work.
8. Clean up: hide the test Pulses and check from `/admin/pulse`.

## Outstanding owner decisions (not blockers to the release itself)

From M906–M928, still open:

- Is `/check` allowed outside `/labs`? (doctrine: Pulse is a Labs experiment)
- Do aggregate visit and share counts count as an exception to doctrine §5
  ("does not authorise telemetry")?
- Doctrine §1: is People's Pulse part of Passport at all?
- Is the "not independently verified" wording acceptable?
- Which search or AI service, if any, and at what cost?
- Should checks get a moderator-reviewed state?
- Should ADRs 021–023 move from PROPOSED to accepted?
- Next.js security advisory: every build stops once with a SecurityFatalError
  upgrade nudge. Upgrading Next is an owner call.

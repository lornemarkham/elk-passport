# Saved + Adventures transformation — release notes

**Branch:** `feature/adventures-extraordinary` (off `integration/release`
`a1ad8b5`). **Status:** built, verified on Metatron's local stack. **Not
pushed, not migrated, not deployed.** Decision: [ADR 012](../../architecture/decisions/012-adventures-start-full.md);
experience: [EXPERIENCE.md](EXPERIENCE.md).

## What ships

| Release (brief §13) | What is in                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — foundation      | Journal palette (`--gh-*`) + shared kit; Saved opens on _Your next adventure_ / _Your adventures_ / _Places you've saved_ (search, kind filter); adventure cards; adventure page rebuilt; 48 px controls; ≥ 320 px. |
| B — intelligent     | `/adventures/new` guided start that sketches every day from Atlas; Keep · Replace · Move · Remove; change-in-words box with preview, Apply, Undo; saved places offered one tap onto a day; swap days.               |
| C — shared          | Existing invites/answers kept; participants _Suggest these_ (ideas for the owner); answers on stops and ideas; printed day still shareable without an account.                                                      |
| D — the day         | _Today's adventure_: what's next, published hours, directions, Done (ticks on the device only).                                                                                                                     |
| E — remember        | `/adventures/[id]/guide`: printable keepsake (Fishing With Emi skeleton) with _Afterwards_ write-in pages; _Do it again_ → a new adventure seeded with the same places and town.                                    |

## Database — one additive migration

`supabase/migrations/20261023100000_passport_adventure_item_origin.sql`

- **Order:** after `20261021000000_passport_adventures.sql` (runbook §3 step 3),
  before Hockey. Needs nothing else.
- **What:** `passport_adventure_items.origin text not null default 'person'`
  (`person | passport`), a check constraint, and one **restrictive** insert
  policy: only the owner may write a `passport` row. No column UPDATE grant,
  so nobody can relabel a row. Nothing to anon. Idempotent (pasted twice on
  the stack).
- **Before:** `select count(*) from information_schema.columns where table_name='passport_adventure_items' and column_name='origin'` → `0`.
- **After:** → `1`; `select permissive from pg_policies where policyname='passport_adventure_items_origin_owner'` → `RESTRICTIVE`.
- **Safe to deploy before it:** the store reads/writes `origin` only when the
  column exists (42703 / PGRST204 → retried without). Verified on a stack
  started with `ADVENTURES_WITHOUT_ORIGIN=1`: everything works; the one
  difference is that a dropped Passport suggestion goes back to the ideas
  instead of being deleted.
- **Rollback:** in the file header (drop the policy, drop the column). Code
  needs no redeploy.

No new environment variables. No model key is used (ADR 012: deterministic
reader; D-12 open).

## Verification (Metatron, local stack)

```bash
STACK=~/passport/scratch/adventures-stack node docs/product/group-adventures/verification/stack.mjs start
node docs/product/group-adventures/verification/atlas-standin.mjs ~/scratch/m379/atlas-feed-now-2026-10-20.json 3123 &
set -a; . $STACK/env; set +a; export ATLAS_API_URL=http://127.0.0.1:3123
npm run build && npx next start -p 3126 &
E2E_PORT=3126 npx playwright test -c docs/product/group-adventures/verification
STACK=$STACK ADVENTURES_STACK_ENV=$STACK/env npx vitest run src/lib/adventures/*.stack.test.ts
# Atlas down: the same build with ATLAS_API_URL=http://127.0.0.1:9 on 3127, then
E2E_ATLAS_DOWN=1 E2E_PORT=3127 npx playwright test -c docs/product/group-adventures/verification extraordinary -g "Atlas is down"
# Screenshots: node docs/product/adventures/verification/shoot.mjs 3126 <dir> after --sketch
```

## Production smoke (after deploy, signed in)

1. `/saved` opens on _Where to next?_ with **Create an adventure**.
2. Create: Kelowna, This weekend, Adventurous → lands on the adventure with
   _Here's a first sketch_; both days have stops marked _Passport's
   suggestion_, every one a real place.
3. Keep one stop; say _"make Saturday more adventurous"_ → preview → Apply →
   reload: changed, kept stop still there; Undo restores.
4. Invite a second account; it sees the plan, answers _I'm in_, cannot Keep;
   its _Suggest these_ lands as ideas.
5. Guide opens and prints. A stranger gets _Not found_ on the adventure and
   the guide.

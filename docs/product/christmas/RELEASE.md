# Go Have a Christmas — release handoff

For the authorised Passport release owner. This lane (christmas) cannot
push, merge, deploy or apply SQL. Everything below was verified on Metatron
on 2026-11-01 against a local stack; **nothing has touched production.**

## What is on the branch

`feature/christmas`, on top of `bf397d3` (main at the time of provisioning).

| Area                           | Files                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Pages                          | `src/app/christmas/` — `/christmas`, `/discover`, `/plan`, `/adventure/[id]`                         |
| Routes                         | `src/app/christmas/api/` — `start`, `[id]/notices`, `[id]/notices/[noticeId]`, `[id]/moments`, photo |
| Server                         | `src/app/christmas/_server/` — Atlas reads (`corpus.ts`), the sharing store (`together.ts`)          |
| Components                     | `src/components/christmas/`                                                                          |
| Domain (pure, tested)          | `src/domain/christmas/` — themes, when, discover, plans, challenges, recap, together                 |
| Docs, SQL, verification, shots | `docs/product/christmas/`                                                                            |

### Outside the lane (minimal, named)

| File                               | Change                                                                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/adventures/kinds.ts`      | + kind `christmas` (ADR 009: "a new kind is a new entry here and nothing else"); optional `home` on a kind; `adventureHref()`             |
| `src/lib/adventures/kinds.test.ts` | the new kind and `adventureHref`                                                                                                          |
| `src/lib/adventures/propose.ts`    | `sketchDays` takes optional `pinned` (seed → day). Absent = exactly the old round-robin, so `/api/adventures` is unchanged                |
| `src/app/adventures/[id]/page.tsx` | an adventure whose kind declares a `home` redirects there — so invite joins, Saved cards and `/adventures` links reach the Christmas page |
| `e2e/christmas.spec.ts`            | new, signed-out Christmas checks in the main Playwright gate                                                                              |

### Proposed, not made (shared contracts)

1. **Migration** — `docs/product/christmas/together-migration.sql`
   (+ `together-preflight.sql`, `together-rollback.sql`). Core tables for
   announcements and shared moments; reasoning in
   `ADR-PROPOSED-adventure-notices-and-moments.md`. It answers D-9 narrowly
   and says so — **an owner decision**, not a formality.
2. **The Experiences menu** — `src/components/shell/PassportNav.tsx`:

   ```ts
   const EXPERIENCES = [
     { href: "/conferences", label: "Conference", testId: "conference" },
     { href: "/hockey", label: "Hockey Night", testId: "hockey" },
     { href: "/october", label: "October", testId: "october" },
     { href: "/christmas", label: "Christmas", testId: "christmas" },
   ] as const;
   ```

   plus the matching row in `PassportNav.test.tsx` and doctrine §10. Until
   then `/christmas` is reachable by URL only.

## Owner steps, in order

1. Merge `feature/christmas` (it touches no shared contract).
2. Decide the D-9 proposal. **If yes:** run `together-preflight.sql` in the
   Passport project's SQL editor (every row `ok`), then
   `together-migration.sql` (after `20261021000000_passport_adventures.sql`,
   which production already has). Never `supabase db push`. **If no:**
   Christmas ships with sharing off — it says so on the page.
3. Decide the Experiences menu change above.
4. Deploy through the normal release process.

### Smoke on production (after deploy)

- `/christmas` shows a countdown and Christmas finds, and **no** "Atlas can't
  be reached" panel.
- `/christmas/discover?theme=lights&at=north-vancouver` → Canyon Lights with
  _Dates from Atlas_ and a distance.
- Signed in: `/christmas/plan?shape=evening` → pick a town and a date →
  _Make our Christmas plan_ → an adventure page with a sketched day.
- If the migration was applied: _Announce a change_ is on that page, and a
  second account joining by link sees the announcement and _Got it!_.
- If it was not: the page says sharing isn't switched on; invites still work.

### Rollback

- Code: revert the merge. Christmas adventures already created remain
  ordinary adventures (kind `christmas`) and open on `/adventures/[id]`'s
  generic page once the kind is gone (`kindLabel` falls back to "Adventure").
- SQL: `together-rollback.sql` — **drops everything shared**; export first.

## Verification (how it was tested here)

```sh
# a real GoTrue + PostgREST + Postgres, with the proposed migration (×2)
node docs/product/christmas/verification/stack.mjs start      # 557xx, ~/passport/scratch/christmas-stack
# Atlas's real corpus of 2026-10-24 (Christmas finds + every placed subject)
node docs/product/group-adventures/verification/atlas-standin.mjs \
  docs/product/christmas/verification/atlas-candidates-2026-10-24.json.gz 55750
# a production build with the stack's env, on the lane's port
set -a; . ~/passport/scratch/christmas-stack/env; set +a
ATLAS_API_URL=http://127.0.0.1:55750 npm run build
ATLAS_API_URL=http://127.0.0.1:55750 node node_modules/next/dist/bin/next start -p 3131
# the family's journey on a 390 px phone (SHOTS=1 rewrites screenshots/)
E2E_PORT=3131 npx playwright test -c docs/product/christmas/verification
# the state production is in until step 2:
CHRISTMAS_WITHOUT_TOGETHER=1 node docs/product/christmas/verification/stack.mjs start
CHRISTMAS_OFF=1 E2E_PORT=3131 npx playwright test -c docs/product/christmas/verification christmas-off
```

Traps met: `next start` launched through a wrapper leaves the real
`next-server` listening — kill it by the PID `ss -ltnp` shows, and check
`/proc/<pid>/cwd` before trusting a run. `NEXT_PUBLIC_*` is inlined at build
time: build with the env you will serve with.

## Known limits (honest)

- **Atlas coverage** — see README "Atlas: what it gave". Most Christmas
  events are unplaced; prices are words, not numbers.
- **Music** — the brief asked for optional music and sound. There is
  sound (the original experiment's synthesized fire, off by default). There
  is no music: Passport holds no licensed music, and none was invented.
- **Live updates** are polling (30 s announcements, 45 s moments, only while
  the page is visible). No push notifications, by doctrine §6.
- **Photo helper** duplicates Hockey Memories' 20-line `shrink()` (not
  exported there). Candidate for `src/lib/media/` when Hockey is next touched.
- **The guide** (`/adventures/[id]/guide`) is the core's and does not yet
  show shared moments; it shows its own _Afterwards_ space.

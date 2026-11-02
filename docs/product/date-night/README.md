# Date Night

> Latest: [`SHARED-ADVENTURE.md`](SHARED-ADVENTURE.md) (2026-11-02): five
> rooms behind a bottom bar, leave-time options, plays to text, and the
> packing panel that says why it's off.

A personal invitation to an adventure. The first one is **Lorne ❤️ Jess, 2
November 2026**, at `gohaveaday.com/lorne-and-jess`. Owner brief: "Date Night —
Lorne & Jess" (2026-11-01).

## What it does

- **The invited person (no account):** opens the link and sees the invitation,
  tomorrow's sunset and Environment Canada's forecast. For each idea they pick
  _Yes please / Maybe / Not this time_. Those are desire signals, not a plan
  (doctrine §2.2). They can also add their own ideas, tap Atlas places or type
  their own, say how adventurous they feel (five levels), pick food and drinks,
  and leave a message. Then they press Send. The draft is kept on their phone as
  they go, and they can change it and send again; the newest answer is shown
  first.
- **The person who planned it:** goes to `<path>/answers`, signs in, and sees
  every answer. Postgres decides who can read them: only the owner of the
  night's adventure. A stranger who is signed in, and a visitor who is signed
  out, see nothing.

## Truthfulness and safety

- Ideas never say anything is safe, open or available (a unit test enforces
  this). Risky ideas carry **Check first** notes that say what to check and
  link the official source: cold water (Lifesaving Society BC & Yukon), fire
  (BC Wildfire Service bans), hunting (BC regulations synopsis), avalanche and
  snow (Avalanche Canada), roads (DriveBC).
- King Eddie and Crazy Creek are not in Atlas (2026-10-24 corpus). The page
  says it has no hours, access or conditions for them.
- Viewpoints and suggested places are Atlas ids, and their names and photos
  are read from Atlas when the page loads. An id Atlas stops returning is
  dropped. Distances are straight lines and are labelled that way.
- Sunset is calculated. The forecast is Environment Canada's for the nearest
  city it publishes (Vernon), names that city, and covers only the hours the
  forecast reaches. It is shown only when `WEATHER_PROVIDER=msc`, the existing
  switch. Without it, the page links to the forecast.

## Architecture

| Layer                            | Where                                                                                                                                                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Generic engine (knows no couple) | `src/domain/date-night/` (types, answer validation, cautions, conditions), `src/components/date-night/`, `src/app/date-night/[slug]/`, `src/app/api/date-night/[slug]/`, `src/lib/date-night/store.ts` |
| One night's configuration        | `src/domain/date-night/nights/lorne-and-jess.ts`, registered in `nights/index.ts`; short path in `next.config.ts` `DATE_NIGHT_PATHS` (a test keeps them in step)                                       |
| Shared Passport capabilities     | Adventure core (`kind: "date-night"`, owner = planner), Atlas corpus read, `environmentFor`, `daylightAt`, `Picture`                                                                                   |
| Database                         | `supabase/migrations/20261102000000_passport_date_nights.sql`                                                                                                                                          |

`dateNight(slug)` is the seam where "make your own Date Night" would come in.
Nights are files today. They would become rows written by a form, and the pages
would not change. Making that form is **not** built, and whether invitations
should be answerable without sign-in in general is an open product question
(doctrine §15.12).

## Verification

```
node docs/product/date-night/verification/stack.mjs start          # 559xx, real GoTrue/PostgREST/PG
DATE_NIGHT_STACK_ENV=~/passport/scratch/date-night-stack/env npx vitest run src/lib/date-night/privacy.stack.test.ts
node scripts/critic/atlas-mock.mjs <atlas-candidates-2026-10-24.json.gz> 55950
set -a; . ~/passport/scratch/date-night-stack/env; set +a
ATLAS_API_URL=http://127.0.0.1:55950 WEATHER_PROVIDER=msc npm run build && next start -p 3120
node docs/product/date-night/verification/stack.mjs start           # fresh DB again: setup is first-owner-wins
cd docs/product/date-night/verification && SHOTS=1 E2E_PORT=3120 npx playwright test -c .
```

The privacy test restarts the stack partway through to prove answers persist.
The phone spec covers the whole journey: Lorne signs up, the operator sets up
the night, Jess answers with no account, a stranger and a signed-out visitor
are refused, and Lorne reads every field. It also covers a send before the
migration exists (503): the draft is kept on the phone and survives a reload.

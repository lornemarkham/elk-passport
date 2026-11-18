# People's Pulse

**What do people really think?** · Powered by ELK

V2 (map, shifts, results card, Question of the Day, source check, spread, Ask My Circle): [`PEOPLES-PULSE-V2.md`](PEOPLES-PULSE-V2.md).

Built 2026-11-18 for the owner's brief _P0 — BUILD PEOPLE'S PULSE_ (mission
906). Lives inside Passport, under Labs, at **`/labs/pulse`**. Status in Labs:
**Experimental**.

A person asks a question, shares the link, friends vote without an account,
and everyone watches the results move and compares the people their link
reached (their circle) with everyone else and with provinces and cities. It is
a serious, simple community-opinion tool. It is not a scientific poll, and it
says so wherever results appear.

## Routes

| Route                               | What                                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| `/labs/pulse`                       | Landing: Create a Pulse, Trending, Popular, Recent, how it works, disclaimer |
| `/labs/pulse/new`                   | Create (question + Yes/No by default; details are optional)                  |
| `/labs/pulse/<id>`                  | Vote, live results, compare, claim comparison, share, report                 |
| `/labs/pulse/<id>?c=<code>`         | The same, arriving through someone's referral link                           |
| `/labs/pulse/<id>/opengraph-image`  | The link preview (question and answers, never results)                       |
| `/admin/pulse`                      | Moderation queue, Passport administrators only (`ADMIN_EMAILS`)              |
| `/api/pulse`, `/api/pulse/<id>[/…]` | JSON API: list, create, read, vote, report; `/api/pulse/admin` moderation    |

## How each requirement is met

| Brief                    | Built                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Create                | Question, 2–6 answers (Yes/No default), optional description, claim, source URL, scope (Canada / province / city), end date (none, a day, a week, a month). One screen, details folded away.                                                                                                                                                                                                                |
| 2. Voting                | No account. Large radio buttons (≥ 44 px), keyboard-operable, a Vote button. Results only after voting (or "Just show me the results").                                                                                                                                                                                                                                                                     |
| — duplicates and bots    | One vote per browser (random httpOnly cookie, stored only as a keyed hash). A cap of 40 votes per network per Pulse per day (keyed, daily-rotating hash of the address). A signed ballot from the page that must be ≥ 0.7 s old. Creation: a hidden honeypot field, ≥ 2.5 s on the form, 10 Pulses per browser or network per day. Per-instance rate limits. **Not** one person, one vote — the UI says so. |
| 3. Sharing               | Unique 8-character URL. Copy link, the phone's native share sheet, SMS, email, WhatsApp, Facebook, X. Open Graph + Twitter card image per Pulse.                                                                                                                                                                                                                                                            |
| 4. My Circle             | Every browser has a referral code per Pulse, derived (HMAC) from its device id, so the link is the same before and after voting. A circle is you, everyone who voted through your link, everyone who voted through theirs, and so on. No contacts are read; no one's votes are listed.                                                                                                                      |
| 5. Geography             | Optional self-reported province and city on the ballot, remembered on that phone only. Stored with `geo_source = 'self'`; nothing is verified and the UI says "self-reported". Places with fewer than 5 votes are never named.                                                                                                                                                                              |
| 6. Live results          | Total, percentages (whole numbers adding to 100), bars, compare-with-everyone stacked bars, votes over time, a table view. Phones poll every 4 s while visible.                                                                                                                                                                                                                                             |
| 7. Claim comparison      | ORIGINAL CLAIM n% beside PEOPLE'S PULSE PARTICIPANTS m% for the same answer, with source name and link required, "not checked" and the representativeness caveat. Pulse figure hidden until 5 votes.                                                                                                                                                                                                        |
| 8. Discovery             | Recent (newest), Popular (most votes), Trending (most votes in the last day, at least 3). No recommender.                                                                                                                                                                                                                                                                                                   |
| 9. Moderation and safety | Text checks refuse emails, phone numbers, street addresses, postal codes, links outside the source field, and a short list of slurs/threats. Report button with six reasons; three distinct reports pause a Pulse for review. Admin queue to restore, pause or remove. Disclaimers on every results view.                                                                                                   |
| 10. Design               | Mobile-first, paper and ink, its own mark, no account, validated colour-blind-safe answer palette (dataviz skill), labels printed beside every mark.                                                                                                                                                                                                                                                        |
| 11. Technical            | Inside Passport; Supabase Postgres through key-checked SECURITY DEFINER functions (CourtQueue's model, ADR 017); existing admin gate; existing rate limiter and same-origin guard; no new dependency, no paid service, no new secret required.                                                                                                                                                              |

## Privacy rules (in `src/lib/pulse/results.ts`)

- **Everyone** is shown live and exact.
- **A subset** (circle, province, city) shows nothing until it has 5 votes,
  and is then counted over its earliest `floor(n/5)·5` votes. Watching your
  circle while a friend votes shows nothing new until four more have voted, so
  one person's answer can't be read off a change.
- Provinces under 5 are pooled into one "from provinces with too few to show"
  count; cities under 5 are omitted.
- The server reads votes as anonymous rows (answer, place, time, two referral
  codes). No endpoint returns any voter's identity or any list of a person's
  votes. Your own answer is returned to your own browser only.
- **Known residual risk:** differencing. With few places, Everyone minus the
  named provinces reveals the pooled remainder's total split. Counts, not
  individuals; acceptable for a voluntary-opinion tool, recorded here.

## What is stored

See the header of `supabase/migrations/20261118000000_passport_pulse.sql`.
No name, email, account, raw IP address or user agent.

## Configuration

| Variable          | Default                                     | Purpose                                                    |
| ----------------- | ------------------------------------------- | ---------------------------------------------------------- |
| `PULSE_STORE`     | `memory` outside production, Postgres in it | `memory` forces the in-process store (tests, demos)        |
| `PULSE_STORE_KEY` | HMAC of `ATLAS_SERVICE_TOKEN`               | Proves the server to the database; keys the one-way hashes |

Without the migration the pages say "still being set up" and the API answers
503 `not-ready`. Production never falls back to memory.

## Verification

Unit (memory store, pure rules): `npx vitest run src/lib/pulse`.

Real Postgres + PostgREST, through the anon key, as production reaches it
(CourtQueue's local stack harness, in its own directory):

```
export STACK=~/scratch/m906/pulse-stack        # bin/ and node_modules/ copied from a stack
node docs/product/badminton/verification/stack.mjs start
node docs/product/badminton/verification/stack.mjs apply supabase/migrations/20261118000000_passport_pulse.sql   # twice: idempotent
set -a; . $STACK/env; set +a
npx vitest run src/lib/pulse/store.stack.test.ts
node docs/product/badminton/verification/stack.mjs apply docs/product/pulse/verification/sample-data.sql   # optional, local only
```

Phones end to end against that stack:

```
PULSE_STORE=postgres PULSE_STORE_KEY=pulse-local-stack-key-0123456789 npm run build && npx next start -p 3120
E2E_PORT=3120 PULSE_SHOTS=/some/dir npx playwright test e2e/peoples-pulse.spec.ts
```

Screenshots from the sample data: [`screenshots/`](screenshots/).

## Rollback

The app side is the code. The database side is additive; to remove it, in the
SQL editor (kept out of the migration so the release runner's line scan sees
no destructive SQL):

```
drop function if exists public.passport_pulse_set_status(text, text, text),
  public.passport_pulse_reported(text), public.passport_pulse_report(text, text, text, text, text, int),
  public.passport_pulse_list(text, int), public.passport_pulse_votes(text, text),
  public.passport_pulse_mine(text, text, text),
  public.passport_pulse_vote(text, text, text, text, text, text, text, text, text, int),
  public.passport_pulse_get(text, text),
  public.passport_pulse_create(text, text, jsonb, timestamptz, text, text, int),
  public.passport_pulse_claim(text), public.passport_pulse_check(text);
drop table if exists public.passport_pulse_reports, public.passport_pulse_votes,
  public.passport_pulses, public.passport_pulse_keys;
```

Resetting a key claimed by the wrong server: `delete from
public.passport_pulse_keys where id = 1;` then let the right server claim it.

## Known limitations

- One vote per **browser**, not per person: a second browser, private window
  or cleared cookies can vote again, up to the network cap.
- Geography is self-reported only. Nothing is verified.
- Results read up to 50,000 votes per Pulse and are aggregated in the app; a
  Pulse beyond that needs aggregation moved into SQL.
- Polling, not push: about 4 s behind, and one read per instance per 1.5 s per
  Pulse.
- The text checks are a first line, not moderation: reports and review do the
  rest. Moderation needs a Passport administrator account (`ADMIN_EMAILS`).
- No editing or deleting a Pulse by its creator yet (there is no creator
  account); a creator can report their own Pulse, an administrator removes it.
- The per-network cap can stop a large shared network (a campus) after 40
  votes on one Pulse in a day.

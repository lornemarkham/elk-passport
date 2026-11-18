# Passport Labs: Quick Ideas

Built 2026-11-18 (mission 908) as the third phase of People's Pulse
([V1](PEOPLES-PULSE.md), [V2](PEOPLES-PULSE-V2.md)). **No new application:**
every experience below is a People's Pulse with a `kind`, on the same routes,
store, vote rules, referral circles, moderation and results card. Status in
Labs is unchanged: **Experimental**.

## What a visitor can do

`/labs/pulse` now opens on **"What do you want to know?"** with three ways in:
**Ask everyone** (a public Pulse), **Ask your friends** (Should I Do It?, by
link only) and **Compare answers** (Is This Normal?). Below that: the five
experiences, eleven templates, the Question of the Day, Trending, Popular and
Recent. "Powered by ELK" is in the footer.

| Experience      | `kind`   | Ballot                                                  | Results                                                                                                                                    |
| --------------- | -------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| People's Pulse  | `pulse`  | one answer                                              | as V1 and V2                                                                                                                               |
| Should I Do It? | `decide` | Yes / No / Not yet + optional reason (280 chars)        | percentages; reasons by answer; words used in 2+ reasons ("most common arguments", a plain count); "From your circle"; optional AI summary |
| Settle This     | `settle` | one of 2–4 sides                                        | a verdict: _not settled yet_ (under 5), _dead even_, _too close to call_ (under 10 points), or _X wins_                                    |
| Is This Normal? | `normal` | one **range** (never a raw number) + optional category  | distribution, the middle answer, "N% lower, N% same, N% higher than you", each category's middle answer                                    |
| Rank These      | `rank`   | tap 3–6 things in order (arrows to adjust, no dragging) | the group's order by points (first = n−1 … last = 0), average position, % who put it first; your circle's order                            |

Should I Do It? defaults to **only people I send the link to** (`unlisted`):
never on the shelves, `noindex`, but anyone with the link can answer. Any kind
can be made unlisted; `pulse` and `settle` can turn on reasons.

### Templates (Phase 5)

Presets on the one create form (`src/lib/pulse/templates.ts`); a template is
a head start, never new behaviour: Which One Should I Buy? (settle + reasons,
unlisted), Am I Overpaying? (normal: phone, internet, groceries, eating out),
Am I Underpaid? (normal: yearly pay by field), Would You Buy This House?,
What Would You Do?, Change My Mind, Make a Prediction (closes in a week), Ask
Canada, What Would Your Town Do?, Challenge This Statistic (opens V1's
published-claim section), Gaming Pulse. "GTA Pulse" was not named after the
trademark; Gaming Pulse covers it. Is This Normal? topics: groceries,
commute, vacation days, phone bill, eating out, home internet, yearly pay.

## Privacy and honesty

- **Is This Normal?** asks about money and time, so it stores a range, and
  **even Everyone** is released only from 5 answers and then in steps of 5
  (`computeResults` draws every view from that pool). Categories need 5 each.
  Every results view and card says these are the people who chose to answer,
  not a representative sample or population statistics.
- **Reasons** are shown from 5 votes, in steps of 5, with the voter told
  "Shown with your answer, never your name. No personal details." They pass
  the same `textProblem` filter as questions (personal details, links,
  attacks are refused, not stored). Circle reasons show without their answers,
  in a fixed shuffled order, once the circle has 5.
- **Rankings** of a circle show from 5, in steps of 5. Cards for rankings and
  ranges never carry a province.
- **AI summary** (Should I Do It?, and any Pulse with reasons): only where
  `OPENAI_API_KEY` already exists (the approved service Insiders and the
  source check use), only when someone presses the button, only over reasons
  already shown, at least 5 of them, cached per Pulse per step of 5. Labelled
  "AI summary … may be wrong"; the prompt forbids advice, invented reasons or
  guessing who anyone is. Without the key there is no button.
- No contacts are read. Sharing uses the phone's share sheet, SMS, email,
  copy, WhatsApp, Facebook and X links, as V1.

## Proposed questions (Phase 6)

`src/lib/pulse/drafts.ts` holds agent-proposed questions: topic, neutral
wording, answers, sources (each link checked to answer when added), why now,
and who proposed it. **Nothing publishes itself.** `/admin/pulse` lists them;
an administrator presses Publish. `high-stakes` drafts (public policy,
health) also need "I reviewed the wording and sources" ticked; the server
refuses without it. A draft's Pulse id is derived from the draft id, so a
second Publish is refused, not duplicated. Eight drafts are seeded (prices,
housing, gaming, entertainment, technology, local, policy, health).

**Trend sources researched, not integrated.** An automatic feed was not
built: candidates are Google Trends' daily trending searches for Canada
(RSS), CBC and CP news RSS, Statistics Canada's _The Daily_ (release
calendar; its site refuses scripted fetches from here, 403), and
subreddit top posts (API terms apply). Any of them would only ever feed
drafts into this queue. That is a next step for the owner to choose.

## Usage analytics (Phase 9)

`/admin/pulse` → **Usage**, last 30 UTC days, counts only:

| Metric                        | Source                                                           |
| ----------------------------- | ---------------------------------------------------------------- |
| Questions created, by kind    | `passport_pulses` (`data.kind`, `data.template`)                 |
| Votes, by kind                | `passport_pulse_votes`                                           |
| Votes via a shared link       | votes with a `via` code (referral conversions)                   |
| Shares started, Ask My Circle | `passport_pulse_events` `share`, `circle-ask` (button pressed)   |
| Results cards shared          | `card`                                                           |
| Shared links opened           | `link-open` (once per tab, only when the link carried a code)    |
| Link opens → votes            | votes via a link ÷ links opened                                  |
| Returning voters              | browsers (hashed device) that voted on 2+ days — computed in SQL |
| Popular templates             | `data.template` (only names `templates.ts` knows are stored)     |

Events are `(day, event, kind) → n`: no device, address or Pulse id. They are
rate-limited (20/min, 200/day per address) and counting never blocks a share.
A "share started" is a button press, not proof anything was sent.

## Data and configuration

One additive migration,
`supabase/migrations/20261119000000_passport_pulse_modes.sql`: three nullable
vote columns (`reason`, `ranking`, `grp`), table `passport_pulse_events`,
functions `passport_pulse_cast`, `passport_pulse_rows`, `passport_pulse_count`,
`passport_pulse_usage`, and `passport_pulse_list` replaced (same signature) to
skip unlisted Pulses. Closed to API roles like the rest. Applied twice
(idempotent) on the local stack. **Not applied to any real project.**

Order matters: `20261118000000` → `20261118120000` → `20261119000000`.
Until the third is applied, the app sends plain votes through V1's
`passport_pulse_vote`/`passport_pulse_votes`, so V1 Pulses keep working;
reasons, rankings, categories, unlisted filtering in SQL (the app filters as
well) and usage need it. No new secret, no new dependency.

## Verification

- Unit: `npx vitest run src/lib/pulse src/app/api/pulse` (modes, AI summary
  with a stub, drafts publishing and the high-stakes gate, event route).
- Real Postgres + PostgREST: `src/lib/pulse/store.stack.test.ts`, 12/12,
  including the database refusing a short ranking and an unknown category,
  unlisted Pulses off the shelves, and usage returning no hashes.
- Phones: `e2e/quick-ideas.spec.ts`, 7 tests, each phone on its own made-up
  address: Labs home, Should I Do It? with five people and reasons, a private
  decision absent from the shelves, Settle This to a verdict, Is This Normal?
  hidden at four and shown at five, Rank These by tapping with the PNG card,
  templates.
- Screenshots: [`screenshots/qi-*.png`](screenshots/).

## Rollback

App: the code (V1/V2 still read their Pulses). Database, in the SQL editor:

```
drop function if exists public.passport_pulse_usage(text, int),
  public.passport_pulse_count(text, text, text),
  public.passport_pulse_rows(text, text),
  public.passport_pulse_cast(text, text, text, text, text, text, text, text, text, int, text, text, text);
drop table if exists public.passport_pulse_events;
alter table public.passport_pulse_votes drop column if exists reason,
  drop column if exists ranking, drop column if exists grp;
```

then re-run V1's `passport_pulse_list` definition from `20261118000000`.

## Known limitations

- One vote per browser, not per person (as V1).
- Common words are a plain count, not "arguments" understood; the AI summary
  was not run live (no key here).
- Results cards are cached 30 s and are a snapshot.
- Draft publishing is a code change per draft; there is no in-app editor.
- The Labs catalogue at `/labs` is unchanged; the "Labs homepage" the brief
  describes is `/labs/pulse` (see the doctrine note).

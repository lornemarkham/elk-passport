# People's Pulse V2

Built 2026-11-18 (mission 907) as a fast follow on V1
([`PEOPLES-PULSE.md`](PEOPLES-PULSE.md)). Same application, same routes, same
vote store; V2 adds views and one small table. Status in Labs is unchanged:
**Experimental**. It is still a voluntary community-opinion tool, not a
scientific poll, and says so on every results view and on every card.

The V1 doctrine conflict (an opinion tool is not the day loop, doctrine §1)
is **still open** and still the owner's call. V2 does not resolve it.

## What V2 adds

| #   | Feature                | Where                                   | How it works                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Canadian map           | `_ui/PulseMap.tsx`                      | A tile map: 13 equal tiles placed roughly where the provinces sit. Colour the map by any answer; tap up to three provinces to set them beside Everyone. Every shown tile prints its percentage and `n=`. Under 5 votes a tile is grey, disabled and says nothing else, not even a count. "Self-reported" is on every row and in the note.                                                                                                                                                                                                                                                                                               |
| 2   | Opinion shifts         | `_ui/Shifts.tsx`, `insights.ts`         | Each answer's share after the first N votes, from 10 votes on (fewer is noise). Fixed 0–100% scale, never stretched. Participation growth is the existing votes-over-time line plus a dashed line for votes that arrived through a shared link. Network differences are in "How it spread".                                                                                                                                                                                                                                                                                                                                             |
| 3   | Shareable results card | `[id]/card/route.tsx`, `ResultsCard`    | A 1080×1350 PNG: question, percentages, total participants, "Powered by ELK", the not-a-poll line. `?c=<circle>` adds My circle vs Everyone; `?p=BC` adds a province. A comparison appears only if that group has 5+ votes. The share button hands the PNG to the phone's share sheet (falls back to a link, then to copying).                                                                                                                                                                                                                                                                                                          |
| 4   | Question of the Day    | `/admin/pulse`, `questionOfTheDay`      | An administrator picks one Pulse per day (today or the next six). It shows at the top of `/labs/pulse`. No ranking fills an empty day: an empty day shows nothing. Days end at midnight Pacific. Needs the `…_featured` migration; without it the landing page simply omits the block.                                                                                                                                                                                                                                                                                                                                                  |
| 5   | AI source check        | `sourceCheck.ts`, `new/SourceCheck.tsx` | Optional, in the claim section. Opens the one page the creator linked and shows only what it says: title, publisher, a date the page declares, and sentences (verbatim) that contain the figure and describe the method. It does not search, guess a source, or judge truth. "Use" buttons copy a finding into the creator's own notes (published / measures / method), which are shown beside the claim as the creator's words, unchecked. AI wording is a further opt-in, only where `OPENAI_API_KEY` already exists (as for Insiders), runs only on those copied sentences, and is labelled "may be wrong". No key = no AI, no cost. |
| 6   | Referral visualization | `_ui/Spread.tsx`                        | Circles sized by area for how many people were 0, 1, 2… links from the start; your own link's reach the same way; networks (people who joined through the same chain) numbered "Network 1…" by size and compared with Everyone. Counts only: no code, name or contact leaves the server, and the spread never says what anyone answered.                                                                                                                                                                                                                                                                                                |
| 7   | Ask My Circle          | `_ui/AskCircle.tsx`                     | A big button: native share (or copy) of the personal link with the unchanged question. My circle vs Everyone: stacked bars, the gap in points per answer, and until 5 are in your circle an honest "N more" message. See below for why a person can't vote twice.                                                                                                                                                                                                                                                                                                                                                                       |
| 8   | Phones first           | everywhere                              | Phone viewport e2e, no sideways scroll, 44 px targets, no account, sharing is the first thing on the results view.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 9   | Privacy and integrity  | unchanged + below                       | V1's protections stand. New aggregates obey the same 5-vote, steps-of-5 rule. The source check can only open public `https` pages (see below).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## Ask My Circle and one dataset

A circle is a _view_ of the one vote set, not a copy. Your referral code is
derived from your device and the Pulse, so the link is identical before and
after you vote and never changes the question. A vote is keyed by the voter's
hashed device (primary key `(pulse_id, voter)`), so a second vote through any
other link is a duplicate: counted once, attributed to the first link used.
Tests: `service.test.ts` ("Ask My Circle"), and the e2e "one person cannot
vote again through another link". Like V1, this is one vote per **browser**,
not per person; a second browser can vote again up to the network cap.

## Privacy rules added

- Map: a province is named only from 5 votes; below that no tile reveals even
  a count.
- Networks and circle comparisons: from 5, in steps of 5.
- Shifts: Everyone only, from 10 votes. (Everyone is already exact in V1.)
- Spread: generation counts and network sizes; no referral code is returned.
- The results card for a circle works only for someone who holds that circle's
  link, and obeys the same thresholds.
- Known residual risk (same as V1): differencing. A network's size with
  steps-of-5 shares leaks nothing about one person; the pooled remainder of
  provinces can still be inferred from Everyone minus named provinces.

## Source check safety

A server opening a stranger's link is the risky part. The check: `https` only,
no port, no credentials, no IP literal, no single-label or `.local` hosts;
**addresses are checked at connection time** (a name resolving to a private,
loopback, link-local or metadata address is refused); redirects are followed
by hand and re-checked (max 3); 7 s timeout; 900 KB cap; HTML and text only
(PDF is declined with a plain sentence). A 4-per-5-minutes, 20-per-day limit
applies per address, and only to checks that really fetch.

## Data and configuration

- One additive migration: `supabase/migrations/20261118120000_passport_pulse_featured.sql`
  (table `passport_pulse_featured`, functions `passport_pulse_feature` and
  `passport_pulse_featured`, explicit grants, closed to all API roles). **Not
  applied to any real project.** Applied twice (idempotent) on the local stack.
- Claim notes (published / measures / method) live in the existing JSON, so
  they need no migration.
- No new dependency, no new secret. AI: `OPENAI_API_KEY` if already present.

## Verification

- `npx vitest run src/lib/pulse src/app/api/pulse` — unit (memory store).
- Real Postgres + PostgREST as production reaches it (V1's recipe, then also
  apply the featured migration): `src/lib/pulse/store.stack.test.ts`, 9/9,
  including featuring, replacing, clearing and hiding a paused Pulse.
- Phones end to end: `e2e/peoples-pulse-v2.spec.ts` (and V1's
  `peoples-pulse.spec.ts`) against the stack, built **with the stack's env**
  (`NEXT_PUBLIC_*` is baked in at build). The Question of the Day landing test
  runs when `PULSE_FEATURED` names a question featured for today.
- Live read of a real public page: `https://www.statcan.gc.ca/…` returned its
  title; `https://localtest.me/` (resolves to 127.0.0.1) was refused.
- Screenshots: [`screenshots/v2-*.png`](screenshots/), from the sample story
  in the e2e spec (14 votes, two provinces, two networks).

## Rollback

App side: the code. Database side, in the SQL editor:

```
drop function if exists public.passport_pulse_featured(text, date, int),
  public.passport_pulse_feature(text, date, text);
drop table if exists public.passport_pulse_featured;
```

## Known limitations

- The map is a tile map, not a geographic outline: deliberate (equal tiles
  don't let Nunavut's area outweigh PEI's people), but not a literal map.
- Opinion shifts only exist as "after the first N votes"; there is no
  per-network shift over time.
- One vote per browser, not per person; geography is self-reported.
- Question of the Day is manual: no scheduler, no automatic fallback.
- AI wording was not exercised live (no `OPENAI_API_KEY` here); its prompt
  and parsing are unit-tested with a stub. The page reader finds figures only
  in a page's text, not in charts or images or PDFs.
- The results card is a snapshot at the moment it is made; it does not
  update after being shared.
- Not deployed: see the release notes in the mission report.

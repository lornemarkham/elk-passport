# Date Night: Connect & Play

Owner brief M940 (2026-11-19). Route `/datenight/play`; ADR 024 (proposed).

Questions and games for two people, on one phone or two, **no account**. Built
inside Passport's Date Night, not beside it: the front door links to it, the
Experiences menu lights Date Night on it, and "Plan something together" hands
off to the existing Date Night and Discovery.

## Modes (independent of stage)

- **Get to know me**: conversation only (warm-ups, interests, personal,
  memories, dreams). No scores, no games.
- **Figure me out**: Would You Rather, Guess My Answer, Most Likely To, Two
  Truths and a Lie, Truth or Dare (date edition). Reveals say "Got it" or "Not
  quite"; nothing is counted.
- **Surprise me**: alternates funny questions, real ones, challenges and games.
- Either person can change mode or stage at any time; the next card follows,
  asked cards stay. Stages (just matched … married) only set how personal.
- Content: `src/domain/date-night/connect/content.ts` (about 130 cards);
  dealing: `deck.ts` (pure, deterministic, tested per mode and stage).

## Own questions

Each person may write up to three, privately. They are asked of the _other_
person every 3–4 cards, alternating, never first, skippable with no reason.
The other phone never receives an unasked question (tested on the server
response and the page HTML).

## Invitation and identity

`/datenight/play/<code>`: 16 characters, 80 random bits. Opening the link
takes no seat (link-preview bots are safe); pressing Join does, atomically.
Identity is a per-night httpOnly cookie; the server keeps only its sha256.
A third visitor learns only "full". One phone passes between people with a
hand-over screen before each private turn.

## Privacy and retention

- Storage is a temporary Redis hash (memory in dev/tests), **24 h after last
  touch, then gone**. No migration, no database table.
- An answer is deleted when the night moves past its card.
- Leave removes your name, questions and answers at once and invalidates your
  cookie; the last person out deletes the night.
- Pages are `noindex`, `Referrer-Policy: no-referrer`, API `no-store`,
  same-origin and rate limited.
- The only thing passed to Atlas/Discovery is a sentence built from interest
  words both people picked (`/discovery?q=…`). Never an answer or a code.

## Verification (2026-11-19, local main, `next start` on 3120, memory store)

- Unit: 38 new tests (content rules, dealing, privacy, races, leave).
- `e2e/date-night-connect.spec.ts`: 10 pass: two real browser contexts as two
  phones at 390×844, private picks, full-night stranger, own questions,
  mode/stage change, one-phone hand-over, leave, no horizontal scroll and
  every button ≥ 44px, front door to first card in two taps.
- Not done: a real iPhone/Android, VoiceOver/TalkBack, production Redis.

## Deferred / known limitations

- **Not deployed.** The mission lane forbids deploys. Production needs
  `UPSTASH_REDIS_REST_URL` / `_TOKEN` (the Fairview 3 names) set in Vercel;
  without them the page says it isn't switched on.
- Two phones poll every 2.5 s; no push, by design.
- No back button to a previous card; no history screen.
- One phone cannot be upgraded to two mid-night.
- One-phone menu edits only the first person's questions (both can be entered
  at the start).
- A skipped card skips for both phones (one shared deck).
- Discovery's reading of "a date for two that's outdoor and food" was not
  verified against a live Atlas.
- Card copy is English only and has had no editor's pass.
- Whether to show Connect & Play on the Experiences menu directly (not just
  under Date Night) is the owner's call.

## Doctrine

Names two conflicts, resolves neither (§15.12): invitations answered without
an account (now a second case, ADR 024), and whether Most Likely To / Truth or
Dare are §6 "shared challenges" or §14 "elaborate social games".

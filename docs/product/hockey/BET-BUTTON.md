# Hockey Night — fix the Bet button (2026-10-24)

**Asked:** in the Bet sheet, _bryan.k.smith · First goal · VAN · "booo"_ and
**THROW IT AT BRYAN.K.SMITH** "appears but does not work". Find the cause,
fix it, show loading / success / error, make the recipient able to accept or
pass, the sender able to see the status, stop duplicates, test it with real
accounts, check RLS. No new betting system: this is the Mayhem challenge
architecture (`MAYHEM.md`), unchanged.

**Baseline:** `36dba1d` (= GitHub main when work began).

---

## 1. What I could and could not reproduce

**Could not reproduce a dead button on the local stack.** On `36dba1d` with
every migration applied (real Postgres + GoTrue + PostgREST, production's
grants posture), the exact flow — recipient `bryan.k.smith`, First goal, VAN,
"booo", sender a non-host with teams declared — returns 200, writes one
`passport_occasion_challenges` row, and the sheet closes. The full path was
traced: `ThrowDown` → `useSharedNight.issueChallenge` → `POST
/hockey/api/occasions/:id/actions` → `act()` → `issueProblem` →
`passport_issue_challenge` (SECURITY DEFINER; no INSERT is granted on the
table) → the row → `loadNight` → the recipient's poll. Each hop exists and is
granted. It is **not** a missing backend action, not a permissions problem on
the local stack, and the button is only disabled until a side is chosen.

**Could not look at production.** The lane has no production credentials, and
the one read-only probe I tried (an anonymous call to the RPC, which would
have told me whether `passport_issue_challenge` exists there) was refused by
the auto-mode classifier as credential exploration, so I did not pursue it.
Whether production has the whole of `mayhem-migration.sql` (and a refreshed
PostgREST schema cache) is therefore **unverified by me** — see §5.

**What I did reproduce on `36dba1d`**, each observed or demonstrated by a test
that fails on the old code and passes on the new:

| #   | Defect (in the sheet, all client side)                                                                                                                                                                                                                                     | Why it looks like "the button doesn't work"                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **The sheet stole focus on every poll.** Its effect depended on `onClose`, which `PlayTab` re-creates on every render, and the page re-renders every 5 s. Measured: after typing "boo" and waiting one poll, `document.activeElement` was the dialog `div`, not the input. | On a phone that drops the keyboard mid-word and moves the bottom-anchored sheet under the thumb.                                           |
| 2   | **The backdrop closed on `click`.** A press that begins on the button and ends on the backdrop (the sheet moving as the keyboard drops) lands the click on the backdrop and closes the sheet with nothing sent.                                                            | Silent: the sheet just goes. No error, no bet.                                                                                             |
| 3   | **The refusal lived in shared state.** The server's reason was `night.error`, which any other write from the page clears, and which is also drawn in a toast behind the sheet.                                                                                             | A refusal ("Bets close at puck drop", "already thrown") could vanish before it was read.                                                   |
| 4   | **A 200 that was not a night counted as success** (a login page, a proxy error). `send` only checked `res.ok`.                                                                                                                                                             | The sheet would close as if sent.                                                                                                          |
| 5   | **No success confirmation, and a disabled button with no reason.**                                                                                                                                                                                                         | Nothing said "sent", and nothing said which choice was missing.                                                                            |
| 6   | **No in-flight guard but React state**, which is asynchronous.                                                                                                                                                                                                             | Two quick taps could send twice (the database's unique index then answered the second with "already thrown" _after_ the sheet had closed). |

I am **not** claiming these are the only possible cause of what was seen in
production. They are the defects I can show; §5 lists what the owner should
check in the production database, and the new error handling means a
database-side refusal now appears inside the sheet instead of being lost.

## 2. What changed

Files (all in the Hockey lane; no shared contract touched):

- `src/components/hockey/play/ThrowDown.tsx` — focus on mount only (latest
  `onClose` held in a ref); backdrop closes only when the press began on the
  backdrop; own refusal state shown in the sheet (`role="alert"`) with the
  button re-enabled; a ref guard so a second tap cannot send; `aria-busy`;
  "Sending…" kept; a line saying what is missing ("Pick your side to throw
  it."). **Design unchanged.**
- `src/components/hockey/useSharedNight.ts` — `post()` returns
  `{ok}|{ok:false,error}` (`send()` is now a boolean wrapper over it, so every
  other caller is untouched); a 200 without a night in it is a failure; a
  response that lost a race with a newer write triggers a refresh instead of
  being dropped. `issueChallenge` returns the result.
- `src/components/hockey/PlayTab.tsx` — after a throw the sheet goes and
  _"Thrown at bryan.k.smith. They can accept or pass — you'll see which, right
  here."_ shows at the top of PLAY for seven seconds (`role="status"`).
- `src/components/hockey/play/ChallengeCard.tsx` — the sender's card reads
  _Waiting on X to accept or pass_ → chip **Accepted** and _X accepted. It's
  on._ (or **Passed** and _X passed. No penalty, and nobody else saw it._);
  the recipient's reads _You accepted._

The server, the SQL and the RLS are unchanged: they were right.

## 3. The flow, as tested

Four people, real GoTrue accounts, real RLS, 390 px phones —
`verification/bet-button.spec.ts` (8 tests, ~25 s):

1. **Setup** — bryan.k.smith hosts (Wild), Casey (Canucks) and Drew join, Ivy
   signs in and stays off the night.
2. **The sheet** — choose bryan, First goal, VAN; the button is disabled with
   a reason until a side is chosen; type "booo" with a poll landing mid-word
   and the input keeps focus; a press that ends on the backdrop does not
   close it; the connection drops → error inside the sheet, button back, no
   row; retry slowly → "Sending…", disabled, **one** request however many
   taps, the sheet goes, the page says "Thrown at bryan.k.smith"; the
   sender's card says _Waiting on bryan.k.smith to accept or pass_; exactly
   one row (`first-goal`, `home`, `booo`, `open`).
3. **Same bet again** — refused inside the sheet ("You've already thrown that
   one at them."), sheet stays open, still one row.
4. **Recipient accepts** — bryan, who touched nothing, sees the Play badge and
   the card within a poll; **Bring it on**; Casey, no reload, sees _bryan
   accepted_ / **Accepted**; a second accept is refused (422, already
   answered).
5. **Recipient passes** — a second bet (overtime); **Pass quietly**; Casey
   sees _passed_; Drew's rows do not include it.
6. **Invalid and duplicate** — duplicate (app and the database's unique index,
   409); self; side not of that market; no side / no market; a unknown id; a
   name instead of an id (400); a signed-in non-member as target.
7. **Who may do what** — no session (401); non-member (404); a third party and
   the challenger cannot accept, a non-challenger cannot withdraw (403); with
   a member's JWT straight at PostgREST: INSERT, UPDATE (by challenger and by
   target) and DELETE on `passport_occasion_challenges` are refused, the row
   is untouched; a stranger reads `[]`; a declined bet is readable by its two
   people and not by Drew; the issue RPC refuses anon and non-members.
8. **Puck drop** — after the start moves into the past, issuing and accepting
   are both refused in the app (422) and the RPC refuses directly (400).

Also: `ThrowDown.test.tsx` (5 unit tests — 4 of them fail on the old sheet)
and the existing `mayhem-attack.mjs` (all checks) and `rls-attack.mjs`
(all checks), plus `grants-check.sql` (4/4 OK).

One existing spec was loose: `alive.spec.ts` matched `getByText("Sycle Cup
champion")`, which since Mayhem also matches Chirp Bot's final-verdict line on
the same screen. It now matches the badge exactly. (Not caused by this fix.)

## 4. Gates

See the release note at the foot of this file for the run on the integrated
commit.

## 5. For the owner — what I could not check

1. **Production schema.** If a bet fails only in production, run (read-only)
   `verification/grants-check.sql` and `mayhem-preflight.sql` against it and
   check that `passport_issue_challenge(uuid,text,uuid,text,text,text,text)`
   exists exactly once with `EXECUTE` for `authenticated`, and that the four
   `first-team` / `final-score` / `overtime` / `total-goals` template rows
   exist for the night (`passport_occasion_prompts`, `content is null`) — the
   function refuses a bet on a question the night does not hold. After a
   paste into the SQL editor, `NOTIFY pgrst, 'reload schema'` if the RPC is
   reported missing.
2. With this change a database refusal is **said, in the sheet**: the exact
   words ("that question is not on tonight", "Could not find the function…")
   will be on the screen, which is the quickest way to learn what production
   is actually saying.
3. The root `npx playwright test` suite (Discovery, Conference…) was not run
   in this lane (needs the Atlas mock and placeholder Supabase env, see
   memory); nothing outside Hockey was touched.

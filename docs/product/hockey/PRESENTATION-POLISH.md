# Hockey Night — coworker polish (2026-10-22)

**Branch:** `feature/hockey`, on top of the approved visual overhaul
(`f3b1aa3`). Not pushed, not deployed. **No schema, RLS, auth, invitation,
migration or environment change. No production data touched.** Nothing
outside `src/app/hockey/`, `src/components/hockey/`, `src/domain/hockey/` and
`docs/product/hockey/` was changed ("Outside my lane": none).

Pictures: [`polish/`](polish/) — a real night, three real accounts, on
375 and 390 px phones, Atlas serving production's own candidate body with
`presentationImage` removed (what production's `/go` carries today, §1).

---

## 1. Restaurant photos — what actually happened

**Asked:** real Atlas photos showed in local tests, not in the
production-backed preview. Why?

I could not open the Vercel preview or production Atlas from this lane (no
token, no `vercel`, by design), so what follows is what I could **measure**,
and what I could not.

**The path.** Atlas `/discovery/candidates?on=<game day>` → `listDiscoveryCandidates`
→ `nearbyFood` / `nearbyImage` (`domain/hockey/nearby.ts`) → `GET
/hockey/api/occasions/[id]/nearby` → the Plan tab's `useNearby` → `VenueCard`.
The ballot starts with **only** the concourse; every real place on a card
arrives from that one lazy fetch.

**Measured against the 19 food-and-drink places within 1.6 km of Rogers Arena**
(production body captured 2026-10-20, and production Passport's public `/go`
payload fetched 2026-10-22):

| Finding                                                                                                                                                                                                                                                                                                                                                  | Evidence                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Chambar's photograph is `http://`.** An https page will not draw it (mixed content). Every local test runs on `http://localhost`, which draws it. Chambar is the nearest place, so it is the first card.                                                                                                                                               | `heroUrl: "http://www.chambar.com/…"`; the same file answers 200 over https.    |
| **Production does not send `presentationImage`.** `/go` today carries `heroMedia` for 14 of the 19 and **no** `presentationImage`. The local fixtures carried it for 2,733 candidates. Moxies, Fanny Bay and Greta YVR (own-site photos) have _only_ that field, so on production they have no photo at all.                                             | `grep presentationImage` on the live payload: 0; on the 2026-10-20 body: 2,733. |
| **Half of what Atlas calls an "exact" photo is not a photograph.** 17 URLs reached cards; 8 are real photographs. The rest: `VenturaLogo.png`, `ArrowUp.png` (56 × 56), `Pizza-MenuMock-1.png` (67 × 139), `Shawarma-Time-300x100.png`, a 100 × 100 icon, a 1024 × 1519 logo, a transparent wordmark, a blank beige graphic — and PiDGiN's is a **404**. | Downloaded and inspected (`file`, contact sheet).                               |
| **The first read is slow and the route had no time budget.** Atlas's cold corpus read is 8–19 s (`atlas-repo.ts`), `?on=` is its own cache key, the route had no `maxDuration`, and one failure left the vote with no places and no way to retry.                                                                                                        | Code; I could not see the preview's function limit.                             |

**Most likely cause of what you saw:** the first three together — Chambar
blocked, three own-site photos absent because production lacks the field, and
logos/icons filling other cards or failing. The slow-read failure is a fourth
possible contributor I could not rule in or out. If photos are still missing
on the new preview, open the browser's Network tab, find `…/nearby`, and read
`places[].image`: present means a rendering problem (tell me which card),
absent means Atlas did not send it.

**What changed (all in Hockey's files; no photograph is ever invented):**

- `secureUrl` — an `http://` photo is requested over https; if the host does not
  answer there the card falls back to its designed no-photo treatment.
- `looksLikeNotAPhoto` + `photoUsable` — a file named logo / icon / arrow /
  menu-mock, or a decoded image under 400 × 240 or outside 0.7–2.6 wide, is
  refused and the designed card shows. Judged from the file, not the place.
- Places with a photograph come first (JPEGs before PNGs, which are usually
  graphics), then nearest; nothing is dropped. The plan row's round thumbnail
  now has the same load-failure and size rule (it had neither).
- `/nearby` has `maxDuration = 60`, the Plan tab says what it is waiting for,
  retries once by itself after 4 s, and offers **Try again**.

**Still wrong, and Atlas's to fix** (not changed from here): Atlas hands
logos, an icon, a blank graphic and a transparent wordmark to Passport as
"exact" subject photographs; PiDGiN's `heroUrl` 404s; production Atlas is not
sending `presentationImage`. After my rules, 8 places show real photographs;
**Aureliana (a beige graphic) and Funky Winker Beans (a wordmark on
transparent PNG) still pass** — they are large and not named like logos, and
only pixel inspection or Atlas's own evidence would catch them. They sort
behind the JPEG photographs. Doctrine §15.15 ("this entity sucks") is the open
question for a human correction loop; I did not build it.

## 2. Restaurant presentation

Before: a new night's vote was **one card — "Just eat in the concourse"** —
with the real places a swipe away underneath.

Now (`PlanTab.tsx`, `VenueCard.tsx`): with nothing real on the vote, the best
three places open full-width as photographs with a big **Add to vote**; the
rest are the swipeable shelf under "More near Rogers Arena". Places already
voted on sit above the shelf. **Just eat in the concourse** stays a real,
votable option, under **Or keep it easy**. Region names and aria labels are
unchanged for the tests.

## 3. Mobile (320, 375, 390 px)

The audit (`mobile.spec.ts`) now fails on a tap target under **40 px** (was 32) and on any visible word under **12 px**, at 320 / 375 / 390, on every room.
It found, and I fixed: 18 instances of 10.5–11.5 px text (countdown units,
HOME/AWAY, kind chips, "host", the lock lines, the no-photo note) → 12 px;
footnotes at 25–30 % white → 55 %; the seven pick pucks at 36 px → 40 px. No
horizontal overflow at any width. Now 3/3.

Not changed: the lab's own components (`src/experience-lab`) have a few more
11.5 px lines (curator setup, time machine). They are not on the guest's
screens; they are outside this lane.

## 4. Two real users, real stack

Real PostgreSQL + GoTrue + PostgREST with production's grants, the unmodified
app, real sign-ups through `/auth` — no mocked auth, no service role.

| Asked                                             | Covered by                                                                                                                                                                        | Result                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Invite and join                                   | `acceptance` (desktop host, phone guest, stranger 404, forwarded link dead, removal), `redesign`, `modules` (host + two guests)                                                   | pass                                       |
| Restaurant voting, with the other phone following | `acceptance`, `plan-and-results`, `redesign`                                                                                                                                      | pass                                       |
| Add a restaurant                                  | `acceptance` (typed + nominated), `redesign` (Maya nominates Chambar; it appears on Lorne's phone as a photograph), `polish` (a nominated place lands above the concourse)        | pass                                       |
| Shared plan updates                               | `redesign`, `plan-and-results` (leader, tie, lock)                                                                                                                                | pass                                       |
| Predictions and sealing                           | `acceptance` (a sealed pick invisible to the other), `redesign` (sealed → reveal → judged), `plan-and-results`                                                                    | pass                                       |
| Chat                                              | `acceptance`, `modules` (three phones)                                                                                                                                            | pass                                       |
| Permissions                                       | `acceptance` (forged `actorId` ignored; a guest cannot set the brief or call results), `modules` (guest gets 403 through Passport and 0 rows through PostgREST), `rls-attack.mjs` | pass — RLS attack script all checks passed |

I added no new multiplayer test: the existing ones already cover each item and
passed unchanged apart from the two spec expectations noted in §5.

## 5. Verification — `feature/hockey`, 2026-10-22

| Gate                                                                    | Result                                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`                                                      | clean                                                                                                               |
| `npx eslint .`                                                          | 0 errors (40 warnings, none in Hockey)                                                                              |
| `npx prettier --check .`                                                | clean                                                                                                               |
| `npx vitest run`                                                        | 3,345 passed, 30 skipped (Hockey domain +5 tests: https, logo names, size rule, photo-first order)                  |
| `npm run build`                                                         | ok                                                                                                                  |
| Hockey browser suite (`playwright -c docs/product/hockey/verification`) | **9/9**: acceptance, plan-and-results, mobile 320 + 375 + **390**, multi-night, modules, redesign, **polish (new)** |
| Slow Atlas (first read held 12 s)                                       | polish spec passes; the loading line shows, then the cards                                                          |
| `rls-attack.mjs`                                                        | all checks passed                                                                                                   |

Two specs need a particular Atlas, as before: `acceptance` the synthetic
stub (`atlas-stub.mjs`), `redesign` the real body **with** `presentationImage`,
`polish` the real body as production serves it. Run against the wrong one they
fail on names or on Moxies' own-site label — I hit exactly that once and ran
each against its own.

**Not run:** the repository-wide Playwright suite (nothing outside Hockey
changed; the last recorded baseline is 250 passed / 4 environmental failures,
`RELEASE-2026-10-23.md` §4); the email-confirmation spec (needs its own stack);
a physical iPhone or Android (Chromium phone emulation only); the production
preview itself.

## 6. Remaining issues

1. **Atlas data quality** (§1): two non-photographs still pass; PiDGiN's photo
   404s; production lacks `presentationImage`, so three places have no photo.
   Passport cannot fix this honestly; Atlas can.
2. **The first Plan load after a deploy can take 8–19 s** (Atlas's corpus read)
   before places appear. It now says so, retries and has a time budget, but it
   is Atlas's latency. Opening Plan once yourself before sharing warms the
   instance.
3. **Photos are the places' own hotlinked pictures.** A host that blocks
   hotlinking or goes down shows the designed card — never a stand-in.
4. **Open architecture question, unchanged and not mine to resolve:** Hockey
   still runs on its own `passport_occasion_*` foundation while ADR 009 chose
   Adventures (`RELEASE-2026-10-23.md` §2, doctrine §10 and §15.12).
5. **Live NHL scores:** none; the host calls the result.

## 7. Deployment — exact steps (yours; I did not deploy)

Code only, again: **no migration, no env var, no Supabase change.** A night in
progress keeps every vote, pick and message.

1. Fetch on the Mac: `git fetch metatron:passport/main feature/hockey`; the tip
   is this release candidate (hash in the report). If `origin/main` is the
   previous candidate, `git merge --ff-only FETCH_HEAD`; otherwise merge and
   re-run the gates above.
2. Check how production deploys (Vercel → `elk-passport` → Settings → Git — the
   record disagrees with itself, see `VISUAL-OVERHAUL.md` §7). Connected:
   `git push origin main`. Not connected: `vercel deploy --prod` from that
   checkout at that commit.
3. **Check it on your phone, signed in, on the real night (5 min):**
   - [ ] Plan opens. Wait up to ~15 s on the first load: "Asking Atlas…", then
         photographs. Chambar's picture is there (it was the one blocked).
   - [ ] The vote leads with photographed places; **Just eat in the concourse**
         is under **Or keep it easy** and still votes.
   - [ ] No logo, icon or banner passes for a photo. (Aureliana and Funky
         Winker Beans may — §1.)
   - [ ] Add a place from a card; a second phone sees it within ~5 s.
   - [ ] If any card that should have a photo does not: Network → `…/nearby` →
         `places[].image` (§1).
4. **Undo:** Vercel Instant Rollback to the previous deployment.

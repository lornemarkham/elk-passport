# Date Night — finish, polish & ship

Monday 2 November 2026. Owner brief: "PASSPORT — DATE NIGHT: FINISH, POLISH &
SHIP" (P0), on production `963daec` (GitHub `main`, which already carried
`SHARED-ADVENTURE.md`'s work). Not a redesign: the forest hero, the
photography, the journey timeline, the five rooms and the plays are all as
they were. What changed, by the brief's numbers:

## 1. Packing: PGRST205 in production

**The cause.** `20261102100000_passport_adventure_packing.sql` (and the
together migration before it) ended without `NOTIFY pgrst, 'reload schema';`.
Run in the SQL editor, the table exists but PostgREST's schema cache doesn't
know it yet. The API then answers `PGRST205 Could not find the table
'public.passport_adventure_packing' in the schema cache`, which is the error
the Together page shows. The adventures core migration has always ended with
the NOTIFY; these two didn't.

**The fix.** Both migrations now end with the NOTIFY. They are guarded
throughout, so **re-running the packing file is the whole remedy** and touches
no rows.

**Proven on the real local stack** (GoTrue + PostgREST + Postgres, 570xx):

1. The table dropped and the cache reloaded, then the **old** file (963daec,
   without the NOTIFY) applied: the API answers `PGRST205`, which is
   production's exact symptom.
2. A row inserted straight into the table (data present while it's broken).
3. The **new** file applied: the table is visible. Anonymous callers now get
   `42501 permission denied`, which is correct because anon has no grant.
   The row is still there (count 1 before, 1 after). Signed in, `magic.spec`
   then packed, ticked and added on two phones.

**Not done from here:** applying it to production. This checkout has no
production credentials by design, and a read-only anon probe of production
PostgREST was refused by the session's safety classifier. It is the
operator's first step in **Release** below.

## 2. Together buttons that hold still

**The cause of the flicker.** Every Together button was disabled while
`busy`, and `busy` included `refreshing`: the background
`router.refresh()` the night runs **every 15 seconds** (and after every
save anywhere on the page, such as a packing tick or a plan change). So
_Text Jess_, every answer button and every reaction greyed out on a timer.
That matches "sometimes enabled, sometimes not" exactly.

**Now:**

- Together's buttons are disabled only while **your own** play or answer is
  saving. Background refreshes and other rooms' saves no longer touch them.
  `finish.spec` watches the button for 33 seconds (two refreshes) and it is
  never disabled.
- The composer's button says what's missing, under it and as its
  `aria-describedby`: _Pick your guess at what Jess chooses._ / _Fill in
  both choices._ / _Write the note first._ / _Write the secret first._ /
  _Write something first, or tap Another._ / _Choose an adventure first;
  then there's something to decide._ While saving it reads _Saving…_.
- Every reaction button (_❤️ Got it_, 😂 / _Absolutely not_ / _…wait,
  actually_) now dims like the others when disabled.
- All nine interactions use the same composer and the same card, so these
  rules cover This or That, Send a Challenge, You Decide, Predictions, Photo
  Dare, Surprise Me, Love Note, Secret Surprise and the Bad Ideas
  Department. Keyboard: the composer opens and makes from Enter
  (`finish.spec`, desktop).

## 3. Send to Jess, and nothing claimed

- **Make it, then send.** The composer's button is **Make it for Jess**. It
  saves the play and makes the link (Jess's invitation carrying the play, if
  she hasn't joined). Then a panel opens: _Made. Now send it to Jess._,
  _It goes from your own messages. Nothing is sent until you press send
  there._, the words, **the link itself** (selectable), and **Send to Jess**
  and **Copy link**.
  **Why two taps:** a share sheet needs a fresh tap. The old one-tap version
  opened it _after_ a save and an invitation round trip. By then the tap had
  expired on iPhone (Safari allows about a second), so the share was refused
  and the page fell back to a text or a copy, unpredictably.
- **On every card:** **Send to Jess** (on Jess's side, **Tell Lorne**) and
  a labelled **Copy link** (it used to be an unlabelled icon). The link is
  ready without a round trip whenever it can be, so the tap opens the share
  sheet.
- **The invitation** works the same way: **Make Jess's invitation**, which
  shows her link, then **Send to Jess** and **Copy link**, with the same
  "nothing is sent until you press send" line.
- `share.ts`: the copy and the share sheet start in the same tick, so both
  get the tap. Phone with no sheet: a new text (`sms:`). Computer: copied.
  What the page says afterwards (`afterSend`) never claims anything went:
  _Link copied. Paste it into a message to Jess._ or nothing at all while
  the share sheet or the texts app is open. `finish.spec` checks no "sent
  to" / "message sent" text appears anywhere.
- **The recipient**: the link opens the invitation; Jess signs in or makes
  an account (one email and password), joins, and lands on that card. An
  account is still needed. The night is members-only by RLS, and whether
  invitations can be answered without one is doctrine §15.12, still open.

## 4. Whose turn

- Each card carries **Your turn**, **Jess's turn** or **Done ✓**
  (`turnOf` in `plays.ts`). A dare you're "in" for stays your turn until
  you've done it; a note that hasn't opened carries none.
- Under the heading: **Your turn · 2** and **Jess's turn · 1**.
- The line under _Play together_ now says what happens: _Make one, send it
  to Jess. Their link opens it right here, and their answer shows up on
  yours._ Answers arrive within the 15-second refresh, without a reload
  (`finish.spec`: Lorne sees _Jess picked Sunset_ and the turn flips to
  Done without touching anything).
- Decisions still change the adventure: **You Decide** with the night's
  endings or adventures, then **Make it so** (unchanged, re-verified in
  `magic.spec`).

No chat, no scores, no new table.

## 5. Passport Soundtrack

A reusable capability, first used as **Soundtrack for tonight** in the
Together room.

| Layer                       | Where                                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Reading a link              | `src/domain/soundtrack/spotify.ts`: playlist/album/track/artist/show/episode, `?si=`, `intl-xx/`, URIs, `spotify.link` |
| Moods and real playlists    | `src/domain/soundtrack/moods.ts`: `recommend(moods, driveMinutes)`                                                     |
| Keeping it on an adventure  | `src/domain/soundtrack/stored.ts`: an ordinary item, note tagged `♥music `; the newest wins                            |
| The component               | `src/components/soundtrack/Soundtrack.tsx`: storage, moods and colours come from the caller (`--st-accent`)            |
| Date Night's choice of mood | `src/domain/date-night/soundtrack.ts`: romantic drive + sunset; backroads/mountain from the plan; road trip ≥ 25 min   |

- **Paste** a Spotify link: a bad one is explained (_That isn't a Spotify
  link. In Spotify: ⋯ → Share → Copy link._). **Name it** if you like.
  **Save to our adventure.** Saving another replaces yours.
- **Open in Spotify** (the canonical link), **Send to Jess** (the same
  share helper), **Preview here** (Spotify's own embed, loaded only when
  asked), **Change**, **Remove**.
- **The drive**: _About 100 minutes in the car: roughly 29 songs._ (every
  drive in the plan, there and back).
- **Recommendations** are Spotify's own public playlists, each one **opened
  on open.spotify.com on 2 November 2026 and checked by its title** (an
  unknown id answers "Page not available"): Timeless Love Songs, Love Pop,
  Country Favourites, 90s Country, Hot Country, Happy Folk, Afternoon
  Acoustic, Chill Hits, Your Favorite Coffeehouse, Classic Road Trip Songs,
  Songs to Sing in the Car, Rock Classics, plus Rock Party / Party Hits
  (game night) and Christmas Classics / Christmas Hits for the other
  Experiences. No URL is invented. With a soundtrack saved, they fold away.
- **No Spotify sign-in.** Nothing is stored but the link. No migration.
- **Reuse:** any Experience on the adventure core can do what NightBoard
  does: `soundtrackOf(items)`, an items POST with `encodeSoundtrack`, and
  `<Soundtrack moods={recommend([...])} />`. **Not wired into Snow Day,
  Hockey Night or Christmas**: ship the vertical slice first. Hockey Night's
  own tables aren't the adventure items, so it would pass its own
  `onSave`.

## 6. Memories

Not redesigned. Verified on the real stack (`finish.spec`): Jess writes a
line and **uploads a photo** (the real `campfire.jpg` through the file
input and `shrinkPhoto`). Lorne reloads and sees the line, and the photo
loads (`naturalWidth > 0`, served by the members-only photo route).
`magic.spec` covers a text memory. **No defect found**, so nothing changed.

## 7. Verified

Fresh dependencies (`npm ci`, Next 16.4.4, the versions production builds),
in a scratch clone of this commit:

- `tsc --noEmit` clean · `eslint .` 0 errors · `prettier --check` clean ·
  **vitest 4146 passed** / 42 skipped (339 files), including
  `soundtrack.test.ts` (10), the new `turnOf` tests and the Date Night
  `soundtrack.test.ts` (3).
- `npm run build` clean (against the stack env, and again with placeholder
  env for the repo e2e).
- **Real stack** (570xx, `next start` on 3133, the 2 November corpus
  stand-in): `finish.spec` ✓, `magic.spec` ✓, `markham.spec` ✓ ✓,
  `date-night.spec` ✓ ✓ (fresh stack), `night.stack.test` ✓ ✓ (real RLS:
  plan, packing, memories).
- The packing remedy, rehearsed (§1).
- Whole-repo Playwright: see the commit's report.

Screenshots: `verification/screenshots/finish-*.jpg`. 01 the composer ready,
02 _Made. Now send it_, 03 Together with the soundtrack, 04 Jess: _Your
turn_, 05 her photo on Lorne's phone, 06 desktop: copied, and said so.

Spec traps found on the way: inside Playwright Test, `browser.newContext()`
**inherits the project's `isMobile`/`hasTouch`**, so `magic.spec`'s
"desktop" is a touch screen (its clipboard check passes only because the
copy runs alongside). `finish.spec` sets `isMobile: false, hasTouch: false`.
`date-night.spec` needs `STACK=` pointing at the stack it runs against,
because its setup helper defaults to `~/passport/scratch/date-night-stack`.

## Release

**Code + one SQL re-run. No new table, no environment variable.**

1. **Packing** (Supabase SQL editor, Passport project
   `frllwwxesxbmmaadzfaf`): run `PREFLIGHT-SHARED.sql` block **B** and note
   the counts; then paste and run
   `supabase/migrations/20261102100000_passport_adventure_packing.sql` as it
   is now (guarded, creates nothing that exists, ends with the reload). If
   block A said the together migration is missing, run
   `20261101000000_passport_adventure_together.sql` first. Run **B** again:
   same counts. Then **G**: all true, policies 4.
2. **Push** `main` to GitHub (Vercel deploys `main`).
3. **On gohaveaday.com/datenight, signed in as Lorne:** Together, where the
   list opens with no PGRST205. Make a This or That, then **Send to Jess**
   (the share sheet opens, with the link). Soundtrack: paste a playlist,
   Save, Open in Spotify. Memories: add a photo.

Rollback: redeploy `963daec`. Nothing in the database needs undoing (the
re-run migration only adds a reload). A saved soundtrack is an item whose
note starts `♥music `. The older page doesn't know it and would show it as
a suggestion card; delete it if that matters.

## Named, not resolved

- **Recipient sign-in.** Jess still needs an account to answer. Removing
  that is doctrine §15.12 (open) and would mean a different security model
  for the night. Not decided here.
- **Soundtrack as shared UI.** Doctrine §10 says shared capability isn't
  shared UI. The component is experience-neutral (colours, moods and
  storage come from the caller), but whether Hockey or Christmas would
  _show_ it this way is their call. Not wired into them.
- **The playlists can age.** Spotify can retire an editorial playlist. Each
  link then says so on Spotify's side. Re-check them the same way (open the
  URL, read the title) and replace any that went.
- **"Your playlist or My playlist"** is still a plain You Decide pair. It
  doesn't change the saved soundtrack.
- The owner can remove the other person's soundtrack (the core's
  owner-may-change-anything rule), as with plays.

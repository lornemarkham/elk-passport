# Release record 2026-11-10: Local Insider Network (`/local`, `/ambassadors`)

Owner brief: _P0: Local Insider Network_ (mission 683). Product:
`docs/product/insiders/README.md`. ADR 018 (proposed). Candidate: local `main`
on Metatron, code `b19915e` plus the commit that adds this file. **Not pushed
and not deployed from the mission**: this checkout cannot push or deploy
(`CLAUDE.local.md`). Passport is BETA in Forge's policy, so the release runner
picks up local `main` once no Passport mission is running.

## What ships

- Routes: `/local`, `/local/share`, `/local/[id]`, `/ambassadors`,
  `/api/insiders/{read,submit,ambassadors,listings/[id]}`; Discovery (`/`,
  `/discovery`) gains the "From the locals" section and the _Know something
  we're missing?_ button.
- Code: `src/domain/insiders/`, `src/lib/insiders/`, `src/components/insiders/`,
  the routes above, and a prop through `src/app/discovery/page.tsx` →
  `DiscoveryListView`. No middleware, shell, schema or package change.
- Migration: `supabase/migrations/20261111000000_passport_insiders.sql` —
  additive; tables `passport_insider_docs`, `passport_insider_keys` (RLS on,
  no policies, no grants), functions `passport_insiders_check`, `_claim`,
  `_get`, `_put`. No transaction control, no destructive statement.
  Independent of every other pending file.

## Production needs, in order

1. **The migration applied** (runner, or paste into the SQL editor of the
   Passport project). Without it, `/local` says the network isn't answering,
   Discovery shows no "From the locals" section, and nothing else changes.
2. **No new environment variable is required.** The store key is an HMAC of
   `ATLAS_SERVICE_TOKEN` (as CourtQueue's). Already-present variables decide:
   - `ADMIN_EMAILS` — who reviews and invites ambassadors.
   - `ADMIN_TOKEN` — lets a published listing be queued to Atlas; without it
     each listing records `Atlas: not-configured` and still publishes.
   - `OPENAI_API_KEY` — the AI reader and posters; without it the rules read
     typed and spoken text and the form says posters need the AI reader.
3. **Deploy** the candidate.

## Check production (after the runner ships it)

1. `https://gohaveaday.com/local` → four listings (Night Pig, Squealing Pig,
   Vernon Jazz Club monthly jam, Vernon Badminton Club). The Pigs read "Last
   held Sat, October 10, 2026 · next date not announced yet".
2. `https://gohaveaday.com/discovery?ask=dirt%20biking` → "From the locals"
   shows both Pigs.
3. On a phone, `/local/share`: type a sentence about a real local thing → _Fill
   in the details for me_ → check → _Send it_ → "Got it".
4. Signed in as an administrator, `/ambassadors` → the submission is under _To
   review_ with what still needs checking. Check the date against its page,
   save, _Publish_ → it shows on `/local`, and its row says `Atlas: queued`.
5. Invite an ambassador by their Passport sign-in email; they open
   `/ambassadors` after signing in with that (verified) address.

## Owner decisions open

- ADR 018 _The conflict_: may Passport show a published local listing before
  Atlas has read its page? (Built: yes, in its own section.)
- Whether Vernon Outdoors Club and the Vernon off-road club may be listed
  (membership clubs: permission needed; held in the review queue).
- The Atlas follow-up brief: `docs/product/insiders/ATLAS-BRIEF.md`.

## Rollback

Revert the commits; the section and routes go. The tables can stay (unused).

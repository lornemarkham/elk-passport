# 017 · CourtQueue keeps its own small room: name-and-PIN players, versioned documents

**Decided:** 2026-11-10, by mission for the owner's brief _P0: Build
CourtQueue_ ("Simple authentication"; "Keep the implementation isolated from
unrelated Passport products"; "Prevent duplicate assignments through database
transactions or equivalent concurrency controls"). **Status:** implemented on
local `main`; migration `20261110000000_passport_courtqueue.sql` not yet
applied to production. **Departs from** [ADR 009](009-one-group-foundation.md)
— see _The conflict_.

## Context

CourtQueue (`/badminton`) runs a drop-in badminton night: about 24 people,
three courts, a fair queue, games started and finished on players' own phones.
It has to work for people who have never heard of Passport, on Thursday, from
one gym Wi-Fi, with every phone agreeing on who is on which court.

## Decision

1. **Players are CourtQueue's own**: a name and a 4–8 digit PIN, no email, no
   Passport account. A sign-in is an httpOnly cookie holding a random token;
   the server keeps only its hash. The organizer resets forgotten PINs.
   Organizers are unlocked by `COURTQUEUE_ORGANIZER_CODE`, or by being signed
   in to Passport as an administrator (`ADMIN_EMAILS`, the curator gate).
2. **State is a few versioned JSON documents** — the club and one per session
   — in `passport_courtqueue_docs`, written only by compare-and-swap through
   two SECURITY DEFINER functions that require the server's key. Every change
   is a pure function of (document, who, what, server time)
   (`src/lib/courtqueue/engine.ts`); the loser of a race re-reads and
   re-applies. One document per night makes "one game per court, one place per
   player" a check on one value, run before every write.
3. **Statistics are derived, never stored**, so an organizer's correction to a
   start time corrects everyone's minutes.
4. **Phones poll every two seconds** (immediately on returning to the
   foreground or regaining signal) instead of holding a realtime socket: the
   documents are not readable by the anon key, so Supabase Realtime would need
   a policy that exposes them, and polling survives an iPhone locking and
   switching networks with nothing to reconnect.
5. **The server key defaults to an HMAC of the existing `ATLAS_SERVICE_TOKEN`**
   when `COURTQUEUE_STORE_KEY` is not set, so the feature needs no new secret
   to start. The derivation is one-way.

## The conflict

ADR 009 says every group thing uses one Passport-owned core
(`passport_adventures`) for membership and invitations. CourtQueue does not:
its players are not Passport users and its night is not an adventure. That
follows the brief's "simple authentication" and "isolated" — 25 people
signing up for Passport accounts (email, confirmation) in a gym is the
opposite of simple — but it is a second membership system, which is what ADR
009 set out to prevent. **Not resolved here.** If CourtQueue outlives its beta,
the owner decides whether its players should become Passport accounts and its
nights adventures of kind `badminton`.

## Reversibility

Additive: two new tables and four functions, nothing else in the database
touched. The rollback is in `docs/release/RELEASE-2026-11-12-COURTQUEUE.md`.

## Amendment 2026-11-10 — the real-world release

Owner brief _P0: CourtQueue real-world release_. Same room, three additions:

1. **Push without a new secret.** The VAPID key pair for Web Push is derived
   (HMAC → P-256 scalar) from the same server key as the store, so it is
   stable across deploys and needs no new environment variable. Changing the
   store key (or `ATLAS_SERVICE_TOKEN` when it is the base) changes the VAPID
   key and silently invalidates every phone's subscription; they re-subscribe
   the next time the app opens (`notify.ts` re-posts its subscription on load).
   Encryption (RFC 8291) and VAPID (RFC 8292) are written with `node:crypto`,
   no package, and checked against the reference decoder `http_ece` and an
   RFC-written decryptor in `release.test.ts`. Subscriptions live in one more
   document, `push`, in `passport_courtqueue_docs` — no migration.
2. **What the clock does happens on the way past.** Filling courts, reminders,
   "sign-up is open" and putting a night away are done by whichever request
   arrives first (every phone polls every 2 s) and written by compare-and-swap,
   so exactly one server sends each message. Before 8:00 am nobody polls, so a
   Vercel cron (`vercel.json`, 15:00 UTC = 8:00 am in BC) calls
   `/api/badminton/tick`, which does only what a poll does.
3. **The season is code, its cancellations are data.** Dates and hours are in
   `schedule.ts`; cancellations are on the club document, changed only by an
   organizer, logged.

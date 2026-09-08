# Who is using Passport, and what belongs to them

**Established:** 2026-09-07

This document names one boundary. Daily Passport, Guided Discovery, Experience,
boards and everything after them should read it rather than inventing a second
answer.

## The seam

```
currentUser()  →  PassportUser { id, email, displayName }  |  null
```

`src/lib/auth/currentUser.ts`, server-side only. `id` is the Supabase user id,
and it is **the** key durable user state is owned by. There is no second
identity, no Passport-side user table, and no mapping to maintain.

`null` is an ordinary answer, not an error and not a redirect.

## What was there before

Three unconnected notions of a person, none of which the server could see:

| Concept                    | Where                        | Reality                                                         |
| -------------------------- | ---------------------------- | --------------------------------------------------------------- |
| Supabase `auth.users`      | browser only, `localStorage` | real, invisible to every server render                          |
| `NEXT_PUBLIC_ADMIN_EMAILS` | client allowlist             | a nav-visibility hint, never a boundary                         |
| `"demo-user"`              | `atlas/src/api/server.ts`    | a string literal that owned every board anyone had ever created |

`GET /boards` took no owner and returned the whole table to every caller. The
`boards.owner_id` column was `not null` from the first migration and had held
exactly one value for its entire life.

## The three layers, and what each is responsible for

```
browser        knows nothing. Asks Passport. Never names Atlas, never sends an ownerId.
Passport       AUTHENTICATION. Resolves a real session from a cookie; supplies the ownerId.
Atlas          CORRECTNESS. Refuses to cross owners, whatever it is told.
```

The browser's session lives in a **cookie** (`@supabase/ssr`), not
`localStorage`, which is the single change that made server-side identity
possible at all. `middleware.ts` refreshes it; it protects no routes.

Atlas has no sessions and no idea who is calling — it is trusted infrastructure
behind Passport, the same position the `ADMIN_TOKEN` routes already occupy. It
still enforces ownership, so a bug in a Passport route handler produces a 404
rather than someone else's saved places.

## Rules

- **The ownerId is never read from a request.** It comes from `currentUser()`
  and nowhere else. There is no request shape a browser can send that reaches
  another person's boards.
- **Only the anon Supabase key reaches user-scoped code.** The service-role key
  is not used for user state; a bug cannot escalate past what the caller
  already has.
- **A board that is not yours is reported exactly like one that does not
  exist.** Probing ids tells a caller nothing.
- **Passport gives before it asks.** Discovery, search, scope, kinds and every
  detail page are fully usable signed out. Identity is requested at exactly one
  moment — a durable save — and even then the page stays where it is and
  `?next=` brings the person back.

## The profile, deliberately small

`displayName` comes from Supabase's own `user_metadata.display_name`, falling
back to the local part of the email. **There is no profile table**, because no
current behaviour needs a field that Supabase does not already carry.

A home or general area was considered and **not built**: exactly one Atlas
Region exists, `activeScope()` already resolves it, and a stored home area would
have no consumer. It becomes worth building when there are two regions to choose
between.

## What is deliberately not here yet

These are the next layer, and they **consume** this one rather than living
inside it:

- `viewed` / recently-seen
- `done` / visited
- `not interested`
- interest scoring, ranking, recommendations, inferred preference of any kind

None has a current consumer. A signal nobody reads is a schema you have to keep
true for no benefit.

## Operational note

`ATLAS_API_URL` must point at an Atlas API running the owner-scoped boards
routes. An older Atlas answers `GET /boards` with every board in the database;
Passport would then show one person another's saved places, and no amount of
correctness on this side would prevent it.

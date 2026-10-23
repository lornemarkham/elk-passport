# 011 · Find my people: a person's position, shared by choice, for a while

**Decided:** 2026-10-23, by the owner's _Conference — the Vancouver
Adventure_ brief ("Allow participants to voluntarily share their location for
a limited duration. Show consenting participants on the map. Sharing must be
opt-in, time-limited, and immediately revocable.") · **Status:** implemented
on `feature/conference-adventure`; migration proposed, not applied

## What it overturns, and how far

Two earlier statements said Passport keeps no position of a person:

- **ADR 002** — _"A person's location is situational, and Passport stores
  none of it."_ Coordinates were for one weather question, blunted to ~1 km,
  never written down.
- **Conference VISION §6** — _"Not a tracking product. It handles flights
  between airports, never a person's location."_

The brief overturns both **for one case only**: members of one conference
showing each other where they are, because they asked to. Everything else in
ADR 002 stands. Discovery, weather and "near me" in Explore still send a
blunted point for one answer and keep nothing.

## The rules

| Rule                                                                                                       | Enforced by                                                   |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Nothing is shared until the person presses **Share**, and the phone asks its own permission first          | the page (`FindMyPeople.tsx`); the browser                    |
| Only people who chose to be **seen** in the conference can share                                           | service + database policy (`passport_conference_is_seen`)     |
| Every share ends by itself: **15 min to 4 hours**, chosen up front; updates never extend it                | service (`move` keeps `expiresAt`) + database (≤ now + 4 h)   |
| **Stop** deletes the row; going hidden takes you off the map at once                                       | service + database (`user_seen` in the read policy)           |
| Only members of the same conference see it; expired rows are unreadable, even to their owner after a purge | database read policy; `passport_conference_locations_purge()` |
| Rounded to 4 decimal places (~11 m), accuracy capped                                                       | service (`round4`)                                            |
| Updates only while the page is open and sharing (`watchPosition`, at most every 20 s)                      | the page                                                      |
| Leaving or being removed erases it; so does the conference's expiry                                        | composite foreign key to `passport_conference_members`        |

## What was rejected

- **Blunting to ~1 km, as ADR 002 does.** A kilometre finds a neighbourhood,
  not a coworker on a sidewalk. 11 m finds the person and not their table.
- **Hockey Arena Mode's model** (self-declared places from a map, no
  coordinates). It is the precedent for the consent shape — a window, purge,
  vanish any time — and right inside an arena. A city has no list of places
  small enough to meet at.
- **Background or always-on sharing.** Passport has no service worker, and
  the doctrine's "less phone" (§6) argues against a phone that reports itself
  from a pocket. A share stops updating when the page closes and still ends at
  the time chosen.

## Still open

- Whether organisers should be able to switch Find my people off for
  everyone (they can: it is a module, off for any conference that unticks it).
- Doctrine §15.8 (privacy and consent for richer context) in general. This
  answers it for one capability in one kind of group, not for Passport.

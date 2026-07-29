# IMP-006 --- Wandering Discovery Field

**Product:** ELK Passport\
**Status:** Pending\
**Depends on:** IMP-005

## Vision

Discovery is not a feed.

Discovery is not a grid.

Discovery is a living field.

The user is not browsing content---they are wandering through
possibilities.

---

# Design Principle

> Build a forest, not a feed.

The field should quietly evolve around the user.

Cards arrive.

Cards linger.

Cards leave.

Some return later.

Nothing feels mechanical.

---

# Goals

- Give the field its own lifecycle.
- Let discoveries wander naturally.
- Introduce day and night moods.
- Reward curiosity.
- Never create urgency.

---

# Ownership

This IMP belongs entirely to **Passport**.

No changes to:

- Atlas
- APIs
- Database
- Recommendation engine
- Experience schema

---

# Discovery Lifecycle

Every card exists in one of these states:

```text
Queued
→ Entering
→ Lingering
→ Noticed
→ Departing
→ Dormant
```

Possible outcomes:

- Saved
- Dismissed
- Ignored
- Resurfaced

---

# User Intent

## Save ❤️

Move to board.

Leave the field.

Replacement arrives later.

## Dismiss ❌

Exit the field.

Remain hidden for the current session.

## Ignore 👀

Remain awhile.

Eventually drift away naturally.

May return later.

## Notice

Hovering or inspecting increases the card's lifetime.

---

# Population

Target:

- 18 visible cards
- Never immediately replace departures
- Allow temporary empty space
- Maximum two incoming cards simultaneously

---

# Entering

Cards should enter from beyond the visible field.

Never pop into existence.

Preferred entry:

- left
- top
- bottom

Avoid entering through the board.

---

# Leaving

Different causes deserve different exits.

Saved:

- drift toward board
- soften
- disappear

Dismissed:

- directional exit
- decisive

Ignored:

- slow fade
- gentle drift
- almost unnoticed

---

# Day and Night

Discovery has moods.

## Day

Feels:

- bright
- adventurous
- open

Favour:

- Paddle Board
- Mountain Bike
- Winery
- Hidden Beach

## Night

Feels:

- intimate
- warm
- mysterious

Favour:

- Campfire
- BBQ
- Stargazing
- Cabin
- Live Music

Weight experiences.

Never hard-filter them.

---

# Time Source

Initial implementation:

Browser local time.

Day:

07:00--18:59

Night:

19:00--06:59

Provide a developer override:

- Auto
- Day
- Night

---

# Wandering

The field should continuously---but slowly---change.

The user should occasionally notice:

"Oh... that's new."

without noticing exactly when it appeared.

---

# Camera

Instead of moving cards dramatically...

Move the world slightly.

Use shallow parallax.

Suggested layers:

Background: 2px

Middle: 5px

Foreground: 8px

---

# Card Personalities

Each experience has its own emotional motion.

Campfire

- warm
- slow
- inviting

Mountain Bike

- energetic
- responsive

Winery

- relaxed
- elegant

Paddle Board

- calm
- floating

BBQ

- warm
- rich

Avoid identical animation curves.

---

# Ethics

Never create artificial urgency.

Do not imitate social media.

Do not punish users for thinking.

Curiosity should be rewarded.

Pressure should never be used.

---

# Future Expansion

Reserved hooks:

- Seasons
- Weather
- Atlas-generated discoveries
- Local events
- User preferences
- Holidays

These are future enhancements only.

---

# Implementation Slices

## Slice A

Lifecycle model.

## Slice B

Population management.

## Slice C

Entering and leaving.

## Slice D

Ignore timing.

## Slice E

Day / Night mode.

## Slice F

Parallax.

## Slice G

Resurfacing.

---

# Acceptance Criteria

- [ ] Cards have lifecycle states.
- [ ] New cards drift in.
- [ ] Ignored cards eventually leave.
- [ ] Saved cards leave for the board.
- [ ] Dismissed cards stay hidden.
- [ ] Day and night moods work.
- [ ] Population remains stable.
- [ ] No instant replacements.
- [ ] Atlas unchanged.
- [ ] Discovery feels like a place, not a feed.

---

# Validation

Run:

```bash
npm run typecheck
npm test
npm run build
```

Review at:

http://localhost:3100/labs/discovery-space

Ask:

1.  Does the field feel alive?
2.  Does it invite wandering?
3.  Does day feel different from night?
4.  Do discoveries come and go naturally?
5.  Is the pacing calm?
6.  Does the user forget there is a system underneath?

---

# Definition of Done

IMP-006 is complete when Discovery behaves like a living environment
instead of a static collection of cards.

The user should feel that there is always something just beyond the edge
of the field waiting to be discovered.

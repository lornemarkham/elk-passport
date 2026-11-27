# Christmas — one unified discovery experience (M1154)

**Owner brief:** "P0 — CHRISTMAS: ONE UNIFIED DISCOVERY EXPERIENCE", owner
approved design direction, 2026-11-27. Doctrine paragraph: _Christmas is one
discovery experience 2026-11-27_.

The page answers one question at once: **what is happening around me this
Christmas?**

## The page, top to bottom

| #   | Band                          | What it is                                                                                                                           | Code                                                                         |
| --- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 1   | Christmas around {town}       | Compact header: the countdown, the place as the page's `h1`, where / when / how far. No full-screen hero.                            | `src/app/christmas/page.tsx`, `DiscoverControls`                             |
| 2   | Happening today               | Today's headline (Frostival on Nov 27) large with the organiser's photo, then the Hospice light-up, then Atlas's events today.       | `HappeningToday` (`FeaturedToday.tsx`), `AlsoToday` (`_parts/discovery.tsx`) |
| 3   | Don't miss this Christmas     | Emmanuel's Bethlehem Star showcase (church poster), SilverStar Light Up (SilverStar Stays photo), NONA / John Christmas Light Tour.  | `DontMiss`, `BethlehemStar`, `featured.ts`                                   |
| 4   | Coming up                     | Tomorrow · this weekend · the next two weeks. Confirmed events in a host's order, long runs left to Explore, each find once.         | `comingUp` (`finder.ts`), `ComingUp`                                         |
| 5   | What are you in the mood for? | The six ways, six equal photo tiles. A tile sets Explore's categories and lands on Explore; Cozy (nothing to filter) opens its page. | `WayStories compact`                                                         |
| 6   | Explore Christmas             | The M1128 finder: categories several at once, show more, the host's answer for dead ends. Leaves out what Coming up showed.          | `Explore` → `Finder exclude`                                                 |
| 7   | Christmas lights              | The map, ready-made drives near this town (`suggestedDrives`), Build My Lights Tour, locals' displays.                               | `ChristmasLights`                                                            |
| 8   | Make Christmas your own       | Surprise me; a plan from a sentence.                                                                                                 | `PlanHero`                                                                   |

Bar: **Discover · Advent · Lights Map · My Christmas** (`ChristmasNav`). The
test id of Discover stays `xmas-nav-home` so older tests and links hold.

## No duplicates

- Featured events leave the Atlas feed by name (`matchesFeatured`).
- Today / tomorrow / weekend / soon rows are disjoint (`comingUp`).
- Explore's unfiltered list leaves out what Coming up showed (`shownIn` →
  `Finder exclude`); choosing a category brings them back, because the
  visitor asked for that kind.
- e2e: `christmas-one-discovery.spec.ts` counts every card title on the page.

## Compatibility

`/christmas/discover?…` still redirects to `/christmas?…#discover` (the
header). `?theme=`, `?when=`, `?from=&to=`, `?km=`, `?at=` read as before.
Every way page (`/christmas/for/{way}`) is linked under the mood tiles.
Route planning is on the Lights Map (`/christmas/lights/tour`), linked from
the lights band.

## What it reused

The M1152 featured list, the M1128 finder, the M1126 picture rules and the six
way photographs are unchanged in substance. The Stay Awhile hero (M1127) is no
longer on the page; its components remain in `src/components/christmas/hearth/`.
Dream (Labs, M1130) was held off this release (reverted on the branch, intact
at `f3cb22f`).

## Decisions taken here (HYPOTHESIS, reversible)

- A mood tile filters Explore rather than opening its page — the brief says
  "connect them to existing discovery filters". Reverse: `moodHref` in
  `page.tsx` → `wayHref`.
- Coming up shows only on an undated look; once days are chosen, Explore is
  the answer for those days.
- NONA's tour has no organiser photo we could load (the Wix image refuses
  hotlinks), so its card is drawn, not photographed.
- Drives are offered within `max(km, 30)` of the town centre.

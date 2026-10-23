# Hockey Night — UX small release 2: restore discovery (2026-10-22)

Release 1 made Plan a five-row dashboard and, in doing so, tucked the
recommendations behind an "Explore places & vote" button. This release puts
them back where a person sees them, **inside** the compact Plan. **Code only.**
No migration, no schema, no Atlas ingestion or API change, no auth, invitation,
vote, seat or Arena Mode change. Not deployed.

Branch `feature/hockey`, on top of release 1 (`71d211d`).

## What changed

**1. Before the game shows three venue cards at once.** Opening the row shows
the question, then three cards — the same three Release 1 hid behind Explore:
not already on the vote, not closed on game day by Atlas's own hours, photo
first, then the shortest walk. Each card has the place's own photograph (or the
designed no-photo card that says so — never a stock picture), name, Atlas's
one-sentence description (when Atlas says it adds knowledge), the straight-line
walk to Rogers Arena (said to be an estimate), what kind of place it is, Atlas's
quoted game-day hours and any group-relevant fact (happy hour, screens…), and a
vote. **Add & vote** is two of the existing writes: `nominate` (server looks the
place up, so a made-up one is refused) then `respond` once the ballot has it. A
place already on the vote shows **Back** instead, and your own shows **Your
vote**. Under the cards: **See all N places** (filters as before), **On the
vote** (the compact rows, unchanged), and the typed "Somewhere else?" field.

**2. Meeting point is a visual choice.** Opening it shows the meeting places
near the arena as cards, then the old ballot underneath (so "Just meet at our
seats" and typed suggestions are untouched).

- The places are the shared curated list's `meeting` kind — the same options the
  `meet-spot` vote already carried. New: where Atlas holds the same place **by
  name**, its photograph, game-day hours and picture label come with it, under
  the restaurant picture rule (`nearbyMeetingSpots`). Where Atlas does not,
  the card says there is no photo Passport can vouch for. Nothing is borrowed
  from a look-alike.
- **Everyone** can vote on a card (the existing `meet-spot` vote).
- **The host** also gets **Meet here**: it writes the same `spot` the "Meet at
  the arena" form writes, through the same host-only endpoint
  (`PUT /meetup`, database-enforced), keeping the gate and time already set. A
  guest sees "Host's pick" but no button; a direct `PUT` from a guest is refused
  (tested). Needs Our Seats switched on, as the form does.

**3. Plan stays five rows.** Nothing is open until tapped; one row at a time.
Discovery only appears inside the expanded rows.

**4. The header is compact.** Home/away, the date and venue, puck-drop
countdown, who is in, and Passport's one line stay. Gone from the first screen:
a separate title line, the second commentary line, the big countdown tiles and
the "Now / Next" sentence (kept from 640 px up). On a 390 px phone the plan now
starts about 490 px down (was about 700), and about 450 px with others in the
night (the alone host also has the invite card).

## What was not touched

Auth, invitations, votes (same endpoints, same rows), seats, Arena Mode, the
database, Atlas ingestion, the `/nearby` contract (it only gains a `meeting`
list; the existing `places` list is unchanged).

## Open points for a person

- **Meeting-place photos.** Atlas may or may not hold Stadium–Chinatown Station,
  Terry Fox Plaza and the rest by name. The local stub uses a saved candidates
  body in which they have no photo, so the local screenshots show the no-photo
  card. Production will show whichever Atlas holds. Check after deploy.
- **"Host selects" is read as** the host's pick beside the group's vote (a
  second, host-only fact), not a replacement for the vote. If the host's pick
  should instead close the vote, that is a product decision to make.
- Restaurant photographs did not load in the sandbox (no internet), so
  screenshots show the framed photo area empty with its source label.

## Files

`src/domain/hockey/nearby.ts` (`nearbyMeetingSpots`) + test,
`src/app/hockey/_server/night.ts` (`meeting` in the nearby read),
`src/components/hockey/VenueCard.tsx` (`NearbyVenueCard` with actions,
`VoteButton`, `CardButton`), `PlanTab.tsx` (`PlacesExplorer` always open on the
dinner vote, auto-vote after nomination, meeting vote), new `MeetingSpots.tsx`,
`GameDayHero.tsx`. Specs: new `verification/release2.spec.ts`; Release 1 and
Hockey specs updated for the new button names (`Add X and vote`, `Back X`,
`X is your vote`) and the always-visible cards.

## Tests

Recipe as `RELEASE-1-UX.md`, plus `release2`:

```
RELEASE2_SHOTS=docs/product/hockey/release-2 STACK=… E2E_PORT=3130 \
  npx playwright test -c docs/product/hockey/verification/playwright.config.ts release2
```

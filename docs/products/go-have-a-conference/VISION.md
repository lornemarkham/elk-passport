# GO HAVE A CONFERENCE — Vision

> **Status:** product vision, recorded 2026-10-11 from the mission brief that
> created it. Everything in this file is **intent**. What is actually built is
> in [`FEATURES.md`](FEATURES.md), which says _built_, _prototype_ or
> _proposed_ for every line. Do not read a sentence here as evidence that the
> thing exists.
>
> **Authority:** [`docs/PASSPORT-PRODUCT-DOCTRINE.md`](../../PASSPORT-PRODUCT-DOCTRINE.md)
> outranks this file. Where they appear to conflict, the conflict is named in
> [§7](#7-where-this-touches-the-doctrine) rather than resolved here.

**First real pilot:** Sycle, Vancouver, **October 24, 2026**.

---

## 1. What it is

**GO HAVE A CONFERENCE is a reusable feature inside Passport / GO HAVE A DAY.**
A group of people are about to be in the same unfamiliar place at the same
time. Some have flights to catch, and there will be a schedule. Each person
gets a few free hours, nobody knows where to eat, and somebody is organising
a hockey game.

Right now that experience is a group email, a spreadsheet, a Slack channel
nobody reads, and 160 people separately googling "best restaurant near the
convention centre".

GO HAVE A CONFERENCE turns it into **one private place for the group**:

- who's coming, and when they land
- what's on, and what's featured
- what people recommend, and who wants to go
- a day worth having in the gaps between sessions
- and afterwards, the adventures you want to keep

It is not an event-management suite, and it is not a corporate engagement
platform. It is Passport doing what Passport is for (doctrine §1). It helps
people discover a day worth getting excited about and then actually live it,
**together, in a place most of them don't know**.

### The measure

The doctrine's measure applies unchanged. It is not "attendees posted 400
times", and it is not "engagement". It is a colleague on the flight home
saying:

> _"Holy shit. That was one hell of a conference."_

and meaning **the city, the people, and the night after the hockey game**,
not the keynote.

---

## 2. Who it is for

| Person                    | What they want                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Organiser**             | Set it up in minutes. Get people in without a sign-up wall. Say what's on. Not run a help desk.                         |
| **Participant**           | Know who's coming and when. Find something great to do with their free hours. Find their people. Not be spammed.        |
| **The quiet participant** | Come, enjoy it, and appear nowhere they did not choose to appear.                                                       |
| **Anyone, later**         | Use the same thing for a retreat, a wedding, a reunion, a festival, or a group trip. Sycle is a pilot, not the product. |

**Ordinary Passport users create conferences.** Any Passport user can do it.
It is not an enterprise sales motion and does not need an admin console that
ELK staff operate.

---

## 3. Principles

These come from the mission brief and are binding on every workstream.

1. **Passport owns the user experience.** Conference pages are Passport.
2. **Atlas is a separate knowledge product.** Places, restaurants, events and
   their facts come from Atlas across its boundary. Conference features never
   invent place information, and never copy Atlas into a second store.
3. **Discovery is a reusable Passport capability.** Conferences use it. They
   do not fork it.
4. **Conference features must not depend on a separate Discovery
   implementation being completed.** Every module has to work with Discovery
   as it is today, and get better when Discovery gets better. The link into
   `/go` with the conference's town already filled in is the baseline.
5. **Sycle is configuration, not hardcoded logic.** Nothing in code may know
   the word "Sycle". Sycle is one conference record. A wedding is another.
6. **Private by default.** A conference is invisible to anyone who isn't in it.
   A participant is invisible to other participants until they choose to be
   seen.
7. **Participants control what they share.** Their name, their flight, their
   plans, their interests. Each one is a separate choice, it can be reversed,
   and "delete everything about me" really deletes it.
8. **No fabricated flight positions or place information.** If the provider
   didn't report it, the screen doesn't claim it. If Atlas doesn't know it,
   the card says so. Absent means unknown, never a plausible guess.
9. **Mobile-first.** People will use this standing at a baggage carousel, or
   on a sidewalk outside a session room.
10. **Delightful, social and genuinely useful.** Make it work before making it
    clever, but make it _feel_ like Passport.
11. **No corporate engagement gimmicks.** No points, badges, leaderboards for
    posting, streaks or "engagement scores". No notifications that exist to
    drive opens. (Playful things people do together in the room, like
    "who scores first?" at the hockey game, are a different idea; see §5.6.)

---

## 4. The experience, start to finish

### Before: setting it up

An organiser opens Passport and says **"I'm organising a conference."** They
give it a name, a place, dates and a look (colour, a line of welcome), and
they choose which parts they want: arrivals, schedule, community, plans,
discovery.

Then they let people in, in whatever way suits the group:

- **a shareable link** that can expire or be revoked
- **an access code** to put on a slide or in an email
- **invitations** to specific people, later on

Nobody has to sign up before they can see what they've been invited to.

### Before: getting excited

A participant follows the link. The conference greets them **in its own
branding**, with a countdown, a welcome, and the featured thing everybody is
talking about. For Sycle, that's the **staff hockey game**.

They can add **their flight number and arrival date** if they like. The
**shared world map** shows everybody who opted in converging on the city.
Where a provider genuinely reports it, the map shows **live flight
positions**. Where it doesn't, it shows progress by the clock and says so.

### Arriving

**Arrival countdowns**, for you and for the next colleague to land. When
you land:

> _"You made it. Welcome to Vancouver."_

Then the question that matters: **what do you want to do here?**

### During: the community

A feed of real questions from real colleagues:

- _"Where is the best restaurant?"_
- _"Where can I buy shoes?"_
- _"What's everyone doing tonight?"_

The answers are **Atlas-backed place cards**, real places with real facts,
shareable, and gathered on **a shared map of recommended places**. They're
not links to a review site.

And the sentence that turns a feed into a night out:

> _"I'm going there at 7. Anyone coming?"_

That's a **shared activity with opt-in participation**: a time, a place, and
who's in. It's not a calendar invite and not an RSVP form. It's somebody
raising their hand.

### During: the free hours

**Discovery based on where the conference is and when it's on.** It offers
**free-time recommendations between sessions**: "two hours, close by",
"somewhere to meet humans", "a whole free day". **Group adventures** come
from GO HAVE A DAY, built for several people instead of one. Passport helps
you **find colleagues with similar interests**, the three other people who
also want to go to the climbing gym, without exposing anyone who didn't ask
to be found.

**Optional real-time chat and group conversations** are for groups that want
them. They're not required, and they're not the centre of the product.

### After

The conference ends. The group space winds down, and **personal data expires
on a schedule everyone could see from the start**. Your own adventures (the
day you built, the places you loved, what you actually did) can be **kept in
your own Passport**. They belong to you, not to the conference.

---

## 5. The ideas, in full

Every idea from the founding brief, grouped, numbered as in the brief. **None
of these is simplified away for the October 24 deadline.** The deadline
decides the _order_ they are built in (see [`ROADMAP.md`](ROADMAP.md)), not
whether they exist.

### 5.1 The conference itself — `passport-conference`

1. **Conference creation by ordinary Passport users.** Self-serve. No sales
   call, no ELK operator.
2. **Conference administrator dashboard.** Details, look, access, members,
   modules, all in one place, usable on a phone.
3. **Private conference membership and invitations.** Members only. Being
   invited is how you get in.
4. **Shareable conference links and access codes.** Links can expire and be
   revoked. Codes can be changed or switched off. Wrong guesses are slowed
   down.
5. **Conference branding and customization.** Colour, a welcome, a tagline,
   and later a cover image and the organiser's own words throughout. It should
   feel like _their_ event, inside Passport.
6. **Conference schedules and organized activities** _(→ `passport-events`)_.

### 5.2 The featured activity — `passport-events`

7. **Staff hockey game as a featured activity.** One featured thing, given
   real presence on the home page. For Sycle, it's hockey. For a wedding,
   it's the ceremony. Its facts (date, time, venue, how to take part) are
   shown only once an organiser confirms them, and until then it says
   _Awaiting confirmation_.

### 5.3 Arrivals — `passport-flights`

8. **Flight number entry and arrival dates.** You confirm which flight is
   yours from what the provider returns. The code doesn't guess.
9. **Shared world map showing incoming flights.** Everybody who opted in,
   converging on the conference city.
10. **Live flight positions where provider data permits.** Only where a
    provider reports a recent position. Otherwise, progress by the clock,
    clearly labelled as such, and only after a confirmed departure.
11. **Arrival countdowns and welcome experiences.** Your landing, the next
    colleague's landing, and a welcome when you arrive.

### 5.4 Community — `passport-social`

12. **Community feed for questions and recommendations.**
13. _"Where is the best restaurant?"_
14. _"Where can I buy shoes?"_
15. _"What's everyone doing tonight?"_
16. **Shareable Atlas-backed restaurant/place cards.** A recommendation is a
    real Atlas subject with real facts, and the same card a person would see
    in Discovery.
17. **Shared maps of recommended places** _(with `passport-discovery`)_.
18. _"I'm going there at 7. Anyone coming?"_ _(with `passport-groups`)_.
19. **Shared activities with opt-in participation** _(`passport-groups`)_.
20. **Find colleagues with similar interests** _(`passport-groups`)_. Based on
    interests people chose to state, never on inference about them that
    they didn't see.
21. **Group adventures using GO HAVE A DAY** _(`passport-groups` + `/go`)_.
22. **Discovery based on conference location and dates**
    _(`passport-discovery`)_.
23. **Free-time recommendations between sessions** _(`passport-discovery` +
    `passport-events`)_. The gaps in the schedule are the opportunity.
24. **Optional real-time chat and group conversations** _(`passport-social`)_.
    Opt-in, per conference and per person.

### 5.5 Across everything

25. **Privacy controls and attendee visibility.** Per person, per thing shared,
    reversible, and enforced on the server, not only hidden in the UI.
26. **Ability to preserve personal adventures afterward.** Into the person's
    own Passport, under their own identity, before the conference data
    expires.
27. **Reusable for retreats, weddings, reunions, festivals and group travel.**
    The model knows a _kind_ of gathering and the words that go with it. It
    has no Sycle-shaped or conference-shaped logic.

### 5.6 Preserved, not scheduled

These ideas came up alongside the brief or follow directly from Passport's
doctrine. They are recorded so they aren't lost. **None is approved to
build.**

- **Live, playful, in-the-room prompts** (doctrine §6): _"Who scores the first
  goal?"_ at the hockey game, or a last-run challenge on a ski day. These are
  for people who are already together, to make the moment better, never to
  pull them onto their phones. Doctrine §14 lists _elaborate social games_ as
  not-now, and that fence applies here.
- **Per-person invitations** that survive a lost phone (the main follow-up
  the `/sycle` prototype names).
- **Multi-leg journeys**: connections, not only the leg that lands.
- **Organiser announcements**: rare, and actually important.
- **Feedback that flows back** (doctrine §2.10): "that restaurant was closed",
  and the correction loop into Atlas (doctrine §15.15).
- **NOW GO HAVE ANOTHER**: the conference ends, and the people you met become
  the people you go have a day with next time.

---

## 6. What it is not

- **Not an event-management platform.** No ticketing, badge printing,
  session-room scheduling, sponsor booths or lead capture.
- **Not a social network.** The feed exists to get people out of the feed
  and into a restaurant together.
- **Not a tracking product.** It handles flights between airports, never a
  person's location. Once you land, you are "in Vancouver", and nothing more
  precise than that.
  _Narrowed 2026-10-23 by the owner's brief:_ members may choose to share
  where they are with each other, for up to four hours at a time, revocable
  at once ([ADR 011](../../architecture/decisions/011-find-my-people.md)).
- **Not a roster.** Being in a conference is not consent to be listed in it.
- **Not Sycle's app.** Sycle is the first conference. The thing being built
  is for everybody.

---

## 7. Where this touches the doctrine

These are named here, as CLAUDE.md requires, and **not resolved by this file**.

| Doctrine                                         | Tension                                                                                                                                                                                                                                                            | How this vision leans, pending a human decision                                                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| §6 _Less phone, more life_                       | A community feed and chat are the classic shapes of time-in-app products.                                                                                                                                                                                          | The feed is judged by how many people it gets **into the same room**, not by posts or minutes. Chat is optional and off by default.                                |
| §10 / §15.1 _Experiences: theme or composition?_ | Is a conference an Experience?                                                                                                                                                                                                                                     | The brief calls it a _feature within Passport_. It is built as one, not as an experience domain, and that does **not** answer §15.1 for October, Skiing or Hockey. |
| §15.12 _How group experiences work_              | Conferences are the first concrete group product.                                                                                                                                                                                                                  | Treat it as a pilot that **informs** §15.12. It must not quietly become the general answer.                                                                        |
| §14 _Not-now list_                               | "Elaborate social games" sit next to item 7's hockey game.                                                                                                                                                                                                         | The hockey game is a featured _activity_. Games about it are §5.6, preserved and not scheduled.                                                                    |
| §2.9 / §15.14 _Want / Plan / Lived vocabulary_   | "I'm interested", "I'm in", and "I'm going there at 7" are three different states.                                                                                                                                                                                 | Keep them distinct (doctrine §2.2). Do not let the conference coin the general vocabulary by accident.                                                             |
| Boards (§9)                                      | `lane/boards` models a gathering as _a Board plus what an organiser knows_. This vision needs membership, codes, admin and branding that a Board does not have. See [`ARCHITECTURE.md` §2](ARCHITECTURE.md#2-the-big-unresolved-question-is-a-conference-a-board). | **Decision needed.** The foundation keeps both paths open.                                                                                                         |

---

## 8. Where the earlier thinking lives

Three pieces of Sycle work already existed when this file was written. They
are evidence. They are not authority, and they are not discarded.

| Where                                                   | What                                                                                                                                                                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/sycle` (untracked in the `main` integration checkout) | A working arrival-board prototype: flight lookup, an honest flight-phase model, an azimuthal world map, opt-in visibility, a gate code, "I'm in" adventures through `/go`, and provider research (`docs/sycle/`). Hardcoded to Sycle, and **not committed**. |
| `lane/boards` @ `62e9900`                               | "Sycle in Vancouver" as a gathering on a shared Board: the hockey game as _Awaiting confirmation_, opt-in named interest, and doors into `/go`. Sycle is declared in code.                                                                                   |
| `lane/vision` @ `76b564e`                               | GO HAVE A DAY's own lineage and ideas (`docs/product/originals/`).                                                                                                                                                                                           |

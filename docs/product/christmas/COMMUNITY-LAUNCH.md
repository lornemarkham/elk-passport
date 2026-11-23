# Christmas Lights Map — community launch

**Owner brief:** "P0 — CHRISTMAS LIGHTS MAP: COMMUNITY LAUNCH" (OWNER DECISION —
FINAL, 2026-11-22). **Lane:** christmas. **Authority:** the
[doctrine](../../PASSPORT-PRODUCT-DOCTRINE.md) (§10, 2026-11-22 paragraph).

The goal, in the owner's words: _help families discover beautiful Christmas
displays throughout their communities._ This builds on Pin the Magic
([PIN-THE-MAGIC.md](PIN-THE-MAGIC.md), [LIGHTS-MAP-2.md](LIGHTS-MAP-2.md)) — the
map, tours, reactions, ratings and review queue already existed; this
mission changes **who may submit, how it is moderated, and how a household
gets a listing taken down**.

## The decision, and what it overturns

**Named conflict, resolved by the owner's explicit decision (not by us):**
Pin the Magic's rule 1 was _"a home is never shown without permission"_ — a
home needed its owner's consent or a public listing recorded before it was
published, and a neighbour's suggestion stayed private. The owner's brief
replaces that: **no homeowner submission, no door-to-door permission, no
ownership verification.** Anyone submits; nothing is public before the
administrator approves; a household's objection takes the listing down at
once with no proof. `model.ts` rule 1, the doctrine paragraph and the older
docs say so. `Pin.authorisation` / `consentClaim` remain in the type only for
documents written before this change; nothing reads or writes them any more.

## Where things are

| What                | Where                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| **Admin dashboard** | **`/christmas/lights/review`** (phone-first; sign in as an `ADMIN_EMAILS` account) |
| Submit (no account) | `/christmas/lights/pin` — 3 steps: where, photo, what                              |
| Public map          | `/christmas/lights` · a listing: `/christmas/lights/[id]`                          |
| Privacy notice      | `/christmas/lights/privacy` (linked from the form and every listing)               |
| API                 | `POST /christmas/api/lights/submit` · `POST /christmas/api/lights/[id] {action}`   |
| Email               | `src/app/christmas/_server/notify.ts`                                              |

## Behaviour

**Submitting.** No account. Location (tap the map, drag, search an address or
use the phone's position), a **required photo** (from the street — no people,
plates or private activity), what it is (a decorated home / a public
display), an optional description, and a required tick that the photo shows
no identifiable people, licence plates or private activity. The result page
says: _"We check every display before it appears on the public map."_ — this
replaces the confusing "Waiting for a reviewer — only you can see this"
(now "Pending review — we check every display before it joins the public
map", for a signed-in submitter's own pending pin; nobody else ever sees it).

**Pending.** Every submission is `pending`: not in the API, the map, the
photo URL or the page for anyone but the administrator (404 to everyone
else, tested). The administrator is emailed.

**Admin dashboard** (mobile-first, one column, 44 px+ buttons, sticky queue
chips): for each listing the **submitted photo, location (opens a map),
description, submission date and current status**, and the five actions —
**Approve, Reject** (with a reason: people, licence plate, private activity,
inappropriate, spam, duplicate, not a display), **Edit** (name, description,
hours, kind), **Hide** (take a published listing down, restorable),
**Delete** (permanent). Queues: Removal requests · Pending · Published ·
Hidden · Rejected. A banner says whether email is on. Reviewer is
**administrator only** (`ADMIN_EMAILS`, a verified account) — Pin the Magic
also let ambassadors review; with homes now public on approval alone that is
narrowed, in `viewer()`.

**Public map.** Approved displays: photos, location and directions,
community ratings and reactions (signed in), **Add to Christmas tour**,
**Report a problem**. No submitter or homeowner identity is published: the
public view carries no `submittedBy`, trail or contact (tested).

**Removal.** Every listing, and the map's selected-display card, carries
**"Is this your home? Request removal"** — no account, no proof. Sending it
**hides the listing from everybody immediately** (page, photo, API, map),
records the request and an optional private contact (email or phone) in the
audit trail, and **emails the administrator**. The dashboard lists it first,
under Removal requests, with the reason and contact. The administrator then
**Deletes** (photo, words, address, contact and ratings are erased; the place
and the audit trail stay) or **Restores** ("Dispute resolved — restore",
with a note). A never-approved submission that was hidden returns to the
queue when restored, never to the map.

**Safety.**

- _Photos:_ identifiable people, plates, private activity and inappropriate
  content are rejected **by the administrator** — the dashboard puts the
  photo first, with a one-tap reject reason — plus the submitter's required
  promise and the on-form warning. **There is no automatic image check**
  (nothing in the stack reads images and there is no vision key); see "What
  is not built".
- _Spam, harassment, repeats:_ same-origin check; per-address rate limits
  (4 a minute, 20 an hour); a hidden field only a script fills (looks
  accepted, stores nothing); a minimum time on the form; no web links in the
  words; a photo and the photo promise are required; **no daily cap**
  (removed 2026-11-23, owner brief _Universal Community Contributions_: the
  owner was refused their eleventh real display; a burst is now asked to
  pause for a minute (12 a minute and 60 an hour per person), and three spam declines
  pause a contributor for a day — `domain/contributions/guard.ts`); at most
  1000 waiting at once (was 150); an already-reported-and-removed place
  **cannot be submitted again** (within 60 m of a deleted listing; the
  tombstone keeps only the place).
- _Audit:_ every submit, approve, reject (with reason), edit, hide, restore,
  removal request, report and delete is an entry in the pin's `trail`
  (who — a reviewer's email, or a one-way key —, when, why), shown under
  "History" on each dashboard card and kept after deletion.

**Email.** One Resend call (`RESEND_API_KEY`) to `CHRISTMAS_NOTIFY_EMAIL`
(default: the first `ADMIN_EMAILS` address) on a new submission and on a
removal request. It carries the display's name, town and a dashboard link —
never the submitter, a photo or a requester's contact. A send that fails or
isn't configured never fails the person's submission or removal; the
dashboard banner says email is off.

## Storage

Unchanged: the `christmas-lights` document and photo documents in the
insiders store (`passport_insider_docs`, migration 20261111000000, already in
production). **No new migration, no new table, no new dependency.**

## Verification

- `npx vitest run src/domain/christmas` — 184 tests, including
  `moderation.test.ts` (anonymous caps, flood stop, links, public view leaks
  nothing, removal request hides at once, restore returns to origin, delete
  scrubs and blocks the place, audit trail).
- `e2e/christmas-community-launch.spec.ts` (phone, memory store, test
  identity, a local mail stand-in the spec runs itself): **submit photo →
  pending → admin email → approve → public map → request removal → hidden →
  admin email → delete → same place refused**, plus authorization (signed-out
  and non-admin cannot reach the queue or act; 401/403/404), privacy (public
  API/page/photo carry no submitter or admin identity), and abuse prevention
  (bot field, instant send, link, missing promise, bad photo, outside area,
  flood → 429). Screenshots: `screenshots/community-0*.png`.
- `e2e/christmas-lights.spec.ts` updated to the new flow.

## Field test: "Your lights" (2026-11-22)

The owner tested the live _Your lights_ section (the family's own displays on
the map page) and asked for eight fixes. Kept as they were: a submitter sees
their own pending displays; an administrator reviews pending displays; nobody
else sees them; a submitter can edit their own details.

**The rule this adds:** a display the public has seen never changes on the
submitter's word. Once a display has been published (or hidden after being
published, so a restore can't publish unreviewed words), a submitter's edit
to its name, special features, hours or features is kept **beside** it as a
proposal. The public keeps the last approved words. The submitter sees their
change and "Your changes are waiting for a reviewer". The administrator sees
each change beside the current words (`review-change`) and approves or
declines it. Approving publishes exactly what was asked; declining keeps the
public words and records the reason. A pending display is not public, so its
details still apply at once. An administrator's own edit applies at once and
retires any waiting words it now matches.

- **Materiality:** the owner asked for review of _material_ changes; the
  doctrine does not define material. The build treats **every change to what
  the public sees** as material, so nothing is a minor unreviewed edit. This
  is a choice to confirm with the owner.
- **Position:** no edit path moves a pin. The submitter's edit carries no
  location, and approving a change never alters the place (tested). A wrong
  location is still a reviewer's job (the "Incorrect location" report, or
  delete and resubmit). A submitter's own location correction is not built.
- **Clearing:** an emptied hours or special-features field now clears the
  published value (once approved). Before this change an empty field was
  silently ignored, so it could not be cleared.
- **Name:** the details form now has a Name field, so a display pinned without
  one can be named, and a mistake corrected.

On the page, the button reads **Edit details** when information already exists
(**+ Add details (optional)** otherwise). Saving collapses the form and shows
**Changes saved** briefly; when the change waits for a reviewer the message
says so. **Your lights** says each display's kind, town, address and the day
it was pinned, so same-named displays can be told apart.

Verified: `src/domain/christmas/lights/proposals.test.ts` (the rules above, and
that pending submissions are private from another account) and the full
vitest, tsc, eslint and prettier gates. The browser spec
`e2e/christmas-your-lights.spec.ts` is written but **not yet run**: the
Next.js security check stops `next build` and `next dev` on this machine
(see the lane report).

## What is not built, said plainly

- **No automatic photo screening** for faces, plates or private activity.
  Human review is the control. Adding a vision check needs a model key (and
  an owner decision on sending photos to a provider).
- **No CAPTCHA.** Abuse prevention is rate limits, a honeypot, timing, caps
  and the review queue. Rate limits are per server instance (see
  `src/lib/server/rateLimit.ts`); a determined attacker spreads across
  instances. A Cloudflare Turnstile / hCaptcha step is the next control if
  the queue is attacked.
- **A removal request is believed on its face** (as decided). Anyone can
  hide any listing by asking; the limits are 2 requests per person per
  listing and 10 reports an hour per address, and the administrator can
  restore. A hostile person could still hide several listings through
  several addresses; every request is in the audit trail and emailed.
- **Email delivery to a real inbox has not been proven from this lane**
  (no Resend key here). The path to the HTTP call is tested against a
  stand-in; delivery needs the three settings below.
- **Edit changes words, hours and kind, not the pin's position or photo.**
  A wrong location or photo is rejected or deleted.
- Ambassadors can no longer review lights (above).

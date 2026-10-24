# Conference demo: seed and screenshots

A realistic conference, entered through the public API as the people it
belongs to, and screenshots of it. Used by `e2e/conference-executive.spec.ts`
and for `docs/products/go-have-a-conference/executive/`.

```
# Atlas stand-in serving a saved production body (photos, Vancouver places)
node docs/product/hockey/verification/atlas-seats-stub.mjs <atlas-body.json> 54770 &

# A development server on the memory store. CONFERENCE_NOW pins the clock
# (ignored by production builds); ADS-B is pointed at a closed port so no
# provider is called.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9 NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder \
CONFERENCE_STORE=memory CONFERENCE_SECRET=<32+ chars> CONFERENCE_GUEST_ORGANISERS=1 \
ATLAS_API_URL=http://127.0.0.1:54770 \
ADSB_LOL_API_URL=http://127.0.0.1:9 ADSB_LOL_ROUTES_URL=http://127.0.0.1:9 \
CONFERENCE_NOW=2026-10-24T17:50:00Z npx next dev -p 3170

# Day one on 2026-10-24 to match that clock
SEED_DAY1=2026-10-24 node scripts/conference-demo/seed.mjs http://localhost:3170 full > seed.json
SEED_DAY1=2026-10-24 node scripts/conference-demo/seed.mjs http://localhost:3170 solo > solo.json

# Screenshots as one of the seeded people, desktop and phone
node scripts/conference-demo/shoot.mjs seed.json out priya 2026-10-24T17:50:00Z during "" schedule arrivals
```

`seed.mjs full`: Sycle Vancouver 2026 at Vancouver Convention Centre West,
three days; Maya (organiser), Daniel, Priya, Tom named, one more member who
stays unlisted; four flights typed from bookings (scheduled times only); a
16-line agenda with the staff hockey game featured; a team dinner whose
place is suggested, voted and chosen (so it becomes the meeting point); a
recurring morning walk; three messages.

`seed.mjs solo`: a conference called `test` with nothing but a town and a
day, and its organiser.

The memory store lives in the server process: restart the server and the
data is gone; seed again.

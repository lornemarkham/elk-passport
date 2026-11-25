# Christmas event cards and event page (M1117)

Owner brief: "P0 — Christmas customer experience polish".

- **One Save.** A card had Save (Atlas board) and Add to My Christmas List
  (device list). `toggleKeep` in `Picks.tsx` is now the one Save: it writes
  both, a find counts as saved if either holds it (nothing saved or added
  before is lost), tapping again removes it from both. Signed out, it is kept
  on the device and says so. The list page and tray read the same data.
  Light-display pins keep their own "Add to My Christmas List" (the lights
  stash); not changed here.
- **Whole card opens the event** (stretched title link; buttons sit above it).
  "Details & source" is now **View event** → `/christmas/event/[id]`.
- **Compact card**: smaller padding, one footer row (Save · Directions · View
  event), the evidence line moved to the page, repeated town/"In Vernon" lines
  dropped (`distinctWhere`).
- **`/christmas/event/[id]`** (under the Christmas bar): hero, date + how sure,
  place + distance, cost in the organiser's words, about, what to expect,
  Directions, event page link (only when Atlas says a source describes the
  subject), Save, more like it nearby, and a folded "Where this comes from".
  Lines with no Atlas support are left out. Atlas owns facts and pictures.
- Not changed: Advent door "Details & source" (still `/passport/[id]`).
- Tests: `e2e/christmas-event-page.spec.ts` (M1042 stand-in).
- Before/after: `screenshots/m1117-{before,after}-*`. "Before" detail is the
  live OGC Holiday Market page; "after" uses a stand-in event (Frostival),
  since the stand-in corpus has no OGC record.

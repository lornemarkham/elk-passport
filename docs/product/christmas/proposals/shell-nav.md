# Proposal (APPLIED by `passport` integration, M964): hide the generic bar's destinations inside `/christmas`

**For:** `passport-domain` / `passport` (the shell is a shared contract; this lane
does not edit it). **From:** Christmas QA repair, 2026-11-21, items 12–15.

## What is built (in the Christmas lane)

`src/app/christmas/layout.tsx` mounts `ChristmasNav` under the global header on
every Christmas page: **Discover · Lights Map · My Christmas List · Plan My
Route · ← Go Have a Day**. That is the whole of the brief's navigation, and it
works with the shell untouched.

## What still shows above it

The global bar's generic **Discover / My Stuff / Build a Day / Experiences**.
Items 12–13 ask for those to be replaced inside Christmas. That is one change
in `src/components/shell/PassportNav.tsx`:

```tsx
const inChristmas = pathname === "/christmas" || inside("/christmas");
// …
{inChristmas ? null : DESTINATIONS.map(…)}   // the three generic tabs
{inChristmas ? null : <button …>Experiences</button>}
```

keeping the wordmark (the way home), the account slot and the theme picker.
`PassportNav.test.tsx` needs one case: on `/christmas/discover` the three
generic tabs and Experiences are absent and the account slot is present.

Until then, a Christmas visitor sees two bars: the generic one, and Christmas's
own directly beneath it.

## Applied (M964, 2026-11-21)

`PassportNav` now hides the three generic destinations and the Experiences menu
inside `/christmas` (`inside("/christmas")`), keeping the wordmark, theme picker
and account slot. Cases added to `PassportNav.test.tsx`; `e2e/global-header.spec.ts`
now expects Christmas to have no Experiences menu.

**Named conflict, not resolved:** the 2026-11-10 brief ("every experience keeps
the Go Have a Day header") is narrowed here by the 2026-11-21 QA brief. From
Christmas the only way to another experience is "← Go Have a Day".

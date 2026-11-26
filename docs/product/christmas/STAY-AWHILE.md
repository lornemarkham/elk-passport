# Christmas — Stay Awhile (M1127)

Owner brief: _GoHaveADay Christmas — Stay Awhile_ (2026-11-25). The hero
created a Christmas atmosphere and then filled it with decisions. Now the
first screen asks nothing.

## What a visitor sees

A room at night, filling the first screen under the bars:

- the forest-green night, the gentle snow (the original experiment's
  `SnowLayer`, reused), a few faint stars;
- **the Star of Bethlehem** high on the right, four long points with the
  longest falling earthward, its light reaching down toward the hearth;
- **a fire** in a stone hearth with a garland of gold lights, two stockings
  and two candles on the mantel, a lit tree beside it with presents
  underneath. The firelight on the stone and the room breathes with the fire;
- _Go Have a Christmas_, **Your Christmas Starts Here**, then **one verse at
  a time**, fading every seven seconds: our own words, then a line of a
  public-domain carol with the carol named, all the way round
  (`src/domain/christmas/verses.ts`);
- the countdown (_29 sleeps till Christmas_), now a quiet gold line.

Two small round buttons sit in the corner: **Hear the fire** (off by default,
every visit, never remembered) and **Pause** (holds the fire and the verses, stops the
snow and the twinkle).

## Where the decisions went

Advent Adventure, New Year's Eve, _Explore Christmas lights_, _What's
happening tonight?_, _Plan a Christmas adventure_, the place and the distance
are unchanged, in the same order, in a band directly under the hero (`ready`),
under the fairy-light row that marks the hero's edge. Nothing else on the page
changed.

## How it is made, and why

- **Drawn, not filmed.** The fire is a canvas of a few hundred additive
  glowing particles (`hearth/fire.ts`); the hearth, tree and star are inline
  SVG. No video or photograph is fetched, so a phone opened from a business
  card QR code gets the room with the page's own HTML and a few kB of JS,
  and there is no stock licence to keep. The brief preferred a looping
  fireplace video: see _Decisions_.
- **The sound is synthesised** (`hearth/useHearthSound.ts`): brown noise for
  the draught and band-passed noise bursts for crackles, in clusters, the odd
  one a pop. Off until tapped; fades in and out.
- **No music.** No licensed instrumental recording exists in the repository;
  one can be added behind the same off-by-default button once licensed.
- **No layout shift.** The hero's height is set from the viewport, every
  piece of the scene is positioned by CSS from it, and all verses share one
  grid cell. The canvas fades in over a painted glow already in place.
- **Reduced motion:** no snow, no flicker, no twinkle, no rotation; the fire
  settles and holds one frame, and the first verse stays. The pause button is
  not shown (nothing moves). The fire sleeps off screen and in hidden tabs.
- **Accessibility:** the scene is one image with a description; the verses
  not showing are `aria-hidden`; the buttons have names and `aria-pressed`;
  the verse rotation can be paused (WCAG 2.2.2).

## Decisions

- **HYPOTHESIS — a drawn fire instead of a video.** No licensed fireplace
  footage was available in the lane, and a video costs phones on first load.
  Reverse by putting a licensed, compressed loop (WebM/MP4 with a poster
  frame, ≲1.5 MB, muted, `playsinline`) into `.fireplace` in place of the
  canvas; the layout and fallback already allow it.
- **HYPOTHESIS — the star in the night sky above the hearth,** not as the
  tree's topper: the tree has no topper so there is one star.
- **HYPOTHESIS — Fraunces italic for the verses.** GHAD headlines stay
  Archivo (the title is unchanged); the verses are quotations, not headlines.

## Verification

`e2e/christmas-hearth.spec.ts` (no links or fields in the hero, two buttons,
sound off, the choices below, verse rotation without layout shift, pause,
reduced motion). Screenshots in the M1127 report.

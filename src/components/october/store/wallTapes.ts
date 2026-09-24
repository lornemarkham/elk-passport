import { filmById, type Film } from "@/lib/movies/catalogue";
import type { Cover } from "./Sleeve";

/**
 * **What October put on this wall.**
 *
 * Thirteen tapes and one card, in forty-nine cavities. The emptiness is the
 * point — this is a section somebody picked over and then somebody else
 * curated — but the tapes themselves are not shy. They are opaque, coloured
 * sleeves you can read from where you are standing, which is what makes the
 * shelf browseable rather than decorative.
 *
 * Every position is a `(row, col)` index into the measured shelf tables, so a
 * tape cannot drift off its cavity; there is no eyeballed CSS in any
 * placement. On top of that, restrained variation: a degree or two of lean, a
 * few pixels off centre, a few pixels further back in the cavity, and a title
 * printed at the head or the foot.
 *
 * All artwork is original — see `Sleeve`.
 */
export interface Placement {
  readonly id: string;
  readonly film: Film;
  /** Into `ROWS` and `COLUMNS`. Never a pixel. */
  readonly row: number;
  readonly col: number;
  readonly cover: Cover;
  /** Degrees off vertical. Nothing on a picked-over shelf stands straight. */
  readonly lean: number;
  /** Plate pixels off the centre of its cavity, for the same reason. */
  readonly nudge: number;
  /** Extra plate pixels back in the cavity. Some were shoved in harder. */
  readonly seat: number;
  /** 0–1. Rental wear: a rubbed corner and a duller sleeve. */
  readonly wear: number;
}

/**
 * The one film on this wall the catalogue does not carry. October's
 * intervention needs a tape to offer instead, and offering something off the
 * same shelf is the point, so it lives here rather than being smuggled into
 * the production catalogue.
 */
const LOST_BOYS: Film = {
  id: "lost-boys",
  title: "The Lost Boys",
  year: 1987,
  runtimeMinutes: 97,
  certification: { system: "MPA", code: "R" },
  audience: "teens",
  fear: "spooky",
  mechanisms: ["delight"],
  line: "Vampires with excellent hair, a saxophone player nobody asked for, and the best-looking 1987 ever committed to film.",
};

interface Spec {
  id: string;
  row: number;
  col: number;
  cover: Cover;
  lean: number;
  nudge: number;
  seat: number;
  wear: number;
}

/**
 * Scattered deliberately, and checked rather than eyeballed: no column carries
 * two tapes in neighbouring rows, no two rows repeat a pair of columns, and
 * the only adjacent pair on the wall is the one October needs you to see — the
 * tape it refuses and the tape it offers, side by side under the card.
 *
 * Column 0 is left empty on purpose. The plate is a fixed 854 × 480 covering a
 * variable viewport, so at 4:3 and narrower the left of the cabinet crops out
 * of frame; the leftmost occupied cavity clears that crop with room to spare.
 */
const SPECS: readonly Spec[] = [
  {
    id: "hocus-pocus",
    row: 0,
    col: 1,
    lean: 1.6,
    nudge: -4,
    seat: 1,
    wear: 0.2,
    cover: {
      field: "linear-gradient(168deg,#2b0f3f 0%,#5b1b56 58%,#8c2f4a 100%)",
      accent: "#f2c65a",
      plate: null,
      motif: "moon",
      lines: ["HOCUS", "POCUS"],
    },
  },
  {
    id: "beetlejuice",
    row: 0,
    col: 4,
    lean: -1.2,
    nudge: 5,
    seat: 0,
    wear: 0.45,
    cover: {
      field: "linear-gradient(172deg,#141414 0%,#1d1d1d 100%)",
      accent: "#cfe04a",
      plate: "#ded0ad",
      motif: "stripes",
      lines: ["BEETLE", "JUICE"],
    },
  },
  {
    id: "corpse-bride",
    row: 1,
    col: 6,
    lean: 0.7,
    nudge: -5,
    seat: 3,
    wear: 0.15,
    cover: {
      field: "linear-gradient(160deg,#0f2233 0%,#123a44 60%,#1c5a52 100%)",
      accent: "#9fe3d0",
      plate: null,
      motif: "ring",
      lines: ["CORPSE", "BRIDE"],
    },
  },
  {
    id: "casper",
    row: 2,
    col: 2,
    lean: -2.1,
    nudge: 6,
    seat: 0,
    wear: 0.5,
    cover: {
      field: "linear-gradient(170deg,#1b3f6e 0%,#2f6ca8 62%,#63a7d6 100%)",
      accent: "#f4f6f2",
      plate: "#e6dcc0",
      motif: "blob",
      lines: ["CASPER"],
      titleHigh: true,
    },
  },
  {
    id: "coraline",
    row: 2,
    col: 4,
    lean: 1.1,
    nudge: -3,
    seat: 2,
    wear: 0.3,
    cover: {
      field: "linear-gradient(166deg,#0d1f17 0%,#1d4a33 58%,#3f7a3d 100%)",
      accent: "#e9d24a",
      plate: null,
      motif: "eye",
      lines: ["CORALINE"],
    },
  },
  {
    id: "sixth-sense",
    row: 2,
    col: 5,
    lean: -0.9,
    nudge: 4,
    seat: 1,
    wear: 0.35,
    cover: {
      field: "linear-gradient(174deg,#0b0d16 0%,#1a2136 66%,#3b4463 100%)",
      accent: "#d9463a",
      plate: null,
      motif: "door",
      lines: ["THE SIXTH", "SENSE"],
    },
  },
  {
    id: "arachnophobia",
    row: 3,
    col: 6,
    lean: 1.4,
    nudge: -2,
    seat: 2,
    wear: 0.55,
    cover: {
      field: "linear-gradient(168deg,#1a1408 0%,#3d2f10 60%,#6b551c 100%)",
      accent: "#efe3bd",
      plate: "#d8cba4",
      motif: "web",
      lines: ["ARACHNO", "PHOBIA"],
    },
  },
  // the pair the intervention plays out on, side by side under the card
  {
    id: "ghostbusters",
    row: 4,
    col: 2,
    lean: -1.3,
    nudge: 2,
    seat: 1,
    wear: 0.15,
    // The real thing: a US RCA/Columbia Pictures Home Video copy, cut fold to
    // fold. Panels are 0.542 against the case's 0.545, so it needs no crop at
    // all. The drawn fields below are never reached while `art` is set.
    cover: {
      art: {
        front: "/october/video-store/sleeves/ghostbusters/front.jpg",
        spine: "/october/video-store/sleeves/ghostbusters/spine.jpg",
        back: "/october/video-store/sleeves/ghostbusters/back.jpg",
      },
      field: "linear-gradient(170deg,#101318 0%,#1b222e 100%)",
      accent: "#e8e2d6",
      plate: "#d7413a",
      motif: "bolt",
      lines: ["GHOST", "BUSTERS"],
    },
  },
  {
    id: "lost-boys",
    row: 4,
    col: 3,
    lean: 0.4,
    nudge: -3,
    seat: 4,
    wear: 0.45,
    // The real thing: an Australian Warner Home Video rental copy, cut fold to
    // fold from one wrap so the printing runs continuously around the case.
    // The drawn fields below are never reached while `art` is set; they stay
    // only so this tape still has a sleeve if the scan is ever removed.
    cover: {
      art: {
        front: "/october/video-store/sleeves/lost-boys/front.jpg",
        spine: "/october/video-store/sleeves/lost-boys/spine.jpg",
        back: "/october/video-store/sleeves/lost-boys/back.jpg",
        frontBias: "100% 50%",
        backBias: "0% 50%",
      },
      field: "linear-gradient(164deg,#160a2b 0%,#3a1352 55%,#7a2160 100%)",
      accent: "#f0a93c",
      plate: null,
      motif: "moon",
      lines: ["THE LOST", "BOYS"],
    },
  },
  {
    id: "poltergeist",
    row: 5,
    col: 1,
    lean: -1.8,
    nudge: 5,
    seat: 0,
    wear: 0.3,
    // The real thing: a UK MGM/UA "Screen Classics" copy, cut fold to fold.
    // Its panels come out at 0.614 against the case's 0.545, so about a tenth
    // is cropped away. Taken evenly off both edges: this back uses its whole
    // width — synopsis on the left, credits on the right — so there is no
    // side that can afford to lose all of it.
    cover: {
      art: {
        front: "/october/video-store/sleeves/poltergeist/front.jpg",
        spine: "/october/video-store/sleeves/poltergeist/spine.jpg",
        back: "/october/video-store/sleeves/poltergeist/back.jpg",
      },
      field: "linear-gradient(176deg,#05070c 0%,#141c33 62%,#2d4a86 100%)",
      accent: "#f2f4ff",
      plate: null,
      motif: "house",
      lines: ["POLTER", "GEIST"],
    },
  },
  {
    id: "the-thing",
    row: 5,
    col: 5,
    lean: 0.6,
    nudge: 4,
    seat: 1,
    wear: 0.25,
    cover: {
      field: "linear-gradient(172deg,#04070b 0%,#0c2036 64%,#1d4e6b 100%)",
      accent: "#bfe9ff",
      plate: null,
      motif: "flare",
      lines: ["THE", "THING"],
    },
  },
  {
    id: "halloween-1978",
    row: 6,
    col: 3,
    lean: 1.9,
    nudge: 3,
    seat: 3,
    wear: 0.4,
    cover: {
      field: "linear-gradient(170deg,#100604 0%,#2a0d06 62%,#5e2308 100%)",
      accent: "#ffb648",
      plate: null,
      motif: "blade",
      lines: ["HALLOWEEN"],
    },
  },
  {
    id: "alien",
    row: 6,
    col: 6,
    lean: -1.1,
    nudge: -4,
    seat: 0,
    wear: 0.6,
    cover: {
      field: "linear-gradient(178deg,#020304 0%,#0a1114 70%,#16272a 100%)",
      accent: "#9fd8c8",
      plate: null,
      motif: "eye",
      lines: ["ALIEN"],
    },
  },
];

export const WALL_TAPES: readonly Placement[] = SPECS.map((spec) => {
  const film = spec.id === LOST_BOYS.id ? LOST_BOYS : filmById(spec.id);
  if (!film) throw new Error(`No film for wall tape "${spec.id}"`);
  return { ...spec, film };
});

/** Where the card stands: directly above the pair, in an empty cavity. */
export const SIGN = { row: 3, col: 3 } as const;

/**
 * The tape October refuses, and the one it offers instead.
 *
 * Ghostbusters because it is the most obvious thing on the wall, which is the
 * whole joke — and never The Lost Boys, which has to be free to push itself
 * forward afterwards.
 */
export const REFUSED_ID = "ghostbusters";
export const OFFERED_ID = "lost-boys";

import { labExperiments } from "@/app/labs/experiments";

/**
 * **The ELK Creative Archive: every original we made, where it lives, and
 * whether it still opens.**
 *
 * This is a preservation record, not a product surface. Each entry names an
 * original — an experiment, a prototype, a design round, a founding document —
 * and says where its source is, the route it was first served at, the commit
 * that first added it, and how it is doing now. Nothing here renders,
 * replaces or rewrites an original; the archive only points at them.
 *
 * ## How it relates to Labs
 *
 * `src/app/labs/experiments.ts` stays the one authority on what can be
 * *played* in this environment. An entry with a `labId` does not decide its
 * own link: it asks the Labs registry, and shows the Labs note when Labs says
 * it is closed. The archive adds what Labs deliberately leaves out — history,
 * October, the documents — and the test makes sure every Labs experiment has
 * an archive entry, so neither list can quietly lose one.
 *
 * ## The rules the test holds this to
 *
 * - Every source path of an entry that is not `missing` exists on disk. An
 *   original that is deleted fails the test; the fix is to mark the entry
 *   `missing` with the commit it can be recovered from, not to delete it.
 * - Every `missing` entry says where it can be recovered from: a commit, or
 *   (for things never committed) the recovery note.
 * - Every experiment page under `src/app/about/` and `src/app/labs/`, and
 *   every HTML original under `public/labs/`, has an entry.
 * - Dates are commit dates from `git log --diff-filter=A`, never guessed.
 *   `76dde5e` (2026-08-14) is a bulk baseline snapshot: it dates when a file
 *   entered this history, not when it was first made, and the entry says so.
 */

export const CATEGORIES = [
  "Experiences",
  "October",
  "Christmas",
  "Discovery",
  "Design Evolution",
  "Brainstorming",
  "Product Philosophy",
] as const;
export type CreativeCategory = (typeof CATEGORIES)[number];

/**
 * - `experimental` — runs, and is a prototype rather than the product.
 * - `active` — runs, and is (or became) part of what Passport is today.
 * - `archived` — the original is preserved and reachable, but superseded.
 * - `missing` — does not run from this tree: only in git history, or never
 *   committed at all. Needs restoration or recovery.
 */
export type CreativeStatus = "experimental" | "active" | "archived" | "missing";

export const STATUS_LABEL: Readonly<Record<CreativeStatus, string>> = {
  experimental: "Experimental",
  active: "Active",
  archived: "Archived",
  missing: "Missing / needs restoration",
};

/** The commit that first added the original, from `git log --diff-filter=A`. */
export interface CreativeCommit {
  readonly hash: string;
  readonly date: string;
  readonly subject: string;
}

export interface CreativeWork {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: CreativeCategory;
  readonly status: CreativeStatus;
  /** The route it was first served at, if it was ever served. */
  readonly originalRoute?: string;
  /**
   * Where it opens today, when that is not `originalRoute` (it moved, or the
   * original URL now redirects). Omitted when the original route still serves.
   */
  readonly route?: string;
  /** Repository paths of the original's source, at HEAD (or at `commit`). */
  readonly sources: readonly string[];
  readonly commit?: CreativeCommit;
  /** Things it needs to open, beyond the page itself. */
  readonly needs?: readonly ("atlas" | "account")[];
  /** The Labs registry entry that decides whether it can be played here. */
  readonly labId?: string;
  /**
   * Every source exists at `PUBLISHED_COMMIT`, so it can be read on GitHub.
   * The test checks this against git.
   */
  readonly onGitHub?: boolean;
  /** History, lineage, and anything a future reader should not have to rediscover. */
  readonly notes?: string;
}

/** The newest commit on GitHub `main`; source links point here so they resolve. */
export const PUBLISHED_COMMIT = "1d8974d";
export const GITHUB_REPO = "https://github.com/lornemarkham/elk-passport";

export function githubUrl(path: string): string {
  return `${GITHUB_REPO}/tree/${PUBLISHED_COMMIT}/${path}`;
}

const BASELINE: CreativeCommit = {
  hash: "76dde5e",
  date: "2026-08-14",
  subject: "Baseline Entity Template and the Research Missions workflow",
};
const BASELINE_NOTE =
  "Entered git in the 2026-08-14 baseline snapshot, which added many files at once; the original was made earlier, on a date git does not record.";

const FIRST_SNAPSHOT: CreativeCommit = {
  hash: "dd7cb9a",
  date: "2026-07-28",
  subject: "chore: initial snapshot of elk-passport before IMP-002",
};

const LAB_ROUND_1: CreativeCommit = {
  hash: "974e1d6",
  date: "2026-09-06",
  subject: "An experience is a group answering questions, not an itinerary",
};

const OCTOBER_MOVE =
  "Moved from /labs/october to /october on 2026-10-12 (6a65849 / 6016b19); the old Labs URL still forwards, query string and all (next.config.ts).";

const DESIGN_LAB_SOURCES = [
  "src/app/labs/design/page.tsx",
  "src/components/design-lab/",
  "src/lib/design-lab/",
];

export const CREATIVE_ARCHIVE: readonly CreativeWork[] = [
  // ─────────────────────────────────────────────────────────── Experiences
  {
    id: "hockey-night-original",
    name: "Sycle Hockey Night — the original",
    description:
      "Canucks vs Flames: call the game, argue about where to eat. The specimen the Experience Lab engine was built around — a group answering questions, not an itinerary.",
    category: "Experiences",
    status: "experimental",
    originalRoute: "/labs/experience/sycle-hockey-night",
    sources: [
      "src/experience-lab/fixtures/hockeyNight.ts",
      "src/experience-lab/README.md",
      "src/app/labs/experience/[slug]/page.tsx",
    ],
    commit: LAB_ROUND_1,
    labId: "hockey-night",
    onGitHub: true,
    notes:
      "The creative original. Round two (e960687, 2026-09-07) added the toy box, lineage and quiet mode. Since then the only change to the lab is touch-target CSS (812966d). It is NOT the shared /hockey night, which came later and adapted it; what the adaptation kept and lost is in docs/product/hockey/ORIGINAL-VISION.md.",
  },
  {
    id: "hockey-night-shared",
    name: "Hockey Night — shared with real friends",
    description:
      "A private occasion Lorne starts and invites a coworker into: members, votes, nearby food from Atlas, Run it back, and a Sycle Cup that lasts across nights.",
    category: "Experiences",
    status: "active",
    originalRoute: "/hockey",
    sources: [
      "src/app/hockey/",
      "src/components/hockey/",
      "src/domain/hockey/",
      "docs/product/hockey/README.md",
    ],
    commit: {
      hash: "aded7ff",
      date: "2026-10-11",
      subject:
        "Hockey Night: Lorne starts it, invites a coworker, and they share one private night",
    },
    needs: ["account"],
    labId: "hockey-shared",
    onGitHub: true,
    notes:
      "A later multiplayer build on the original's ideas, not the same experience. Needs sign-in and docs/product/hockey/migration.sql applied. Unresolved: the Labs registry still calls this 'not in this build', while /hockey ships and the Experiences menu links it — the archive follows Labs and reports the conflict rather than settling it.",
  },
  {
    id: "hockey-original-vision",
    name: "Hockey Night — the original vision, recovered",
    description:
      "Where Hockey Night's creative ideas came from, which the shared product kept, which it lost, and what was put back.",
    category: "Experiences",
    status: "active",
    sources: ["docs/product/hockey/ORIGINAL-VISION.md"],
    commit: {
      hash: "c3694b1",
      date: "2026-10-16",
      subject:
        "Hockey Night: more than one night, Run it back, and a Sycle Cup that lasts",
    },
  },
  {
    id: "experience-lab",
    name: "Experience Lab",
    description:
      "Five experiences, one engine. Open one, join it, answer something, then move through the night — before, during, the morning after, and the next one.",
    category: "Experiences",
    status: "experimental",
    originalRoute: "/labs/experience",
    sources: ["src/app/labs/experience/page.tsx", "src/experience-lab/"],
    commit: LAB_ROUND_1,
    labId: "experience-lab",
    onGitHub: true,
    notes:
      "Each fixture exists to find out whether the engine is really an engine or just hockey with the labels filed off.",
  },
  {
    id: "experience-date-night",
    name: "Thursday — date night",
    description: "Just the two of you. An Experience Lab fixture.",
    category: "Experiences",
    status: "experimental",
    originalRoute: "/labs/experience/date-night",
    sources: ["src/experience-lab/fixtures/dateNight.ts"],
    commit: LAB_ROUND_1,
    onGitHub: true,
  },
  {
    id: "experience-powder-day",
    name: "Powder Day",
    description: "Big White, 31cm overnight. An Experience Lab fixture.",
    category: "Experiences",
    status: "experimental",
    originalRoute: "/labs/experience/powder-day",
    sources: ["src/experience-lab/fixtures/powderDay.ts"],
    commit: LAB_ROUND_1,
    onGitHub: true,
  },
  {
    id: "experience-three-hours",
    name: "We have three hours",
    description:
      "Nothing planned. That's the point. An Experience Lab fixture.",
    category: "Experiences",
    status: "experimental",
    originalRoute: "/labs/experience/three-hours",
    sources: ["src/experience-lab/fixtures/threeHours.ts"],
    commit: LAB_ROUND_1,
    onGitHub: true,
  },
  {
    id: "conference",
    name: "Go have a conference",
    description:
      "Everyone's going to be in the same place. Create one, let people in privately, and leave room for everything else.",
    category: "Experiences",
    status: "active",
    originalRoute: "/labs/conference",
    route: "/conferences",
    sources: ["src/app/conferences/", "src/app/labs/conference/page.tsx"],
    commit: {
      hash: "f8b13ee",
      date: "2026-10-11",
      subject:
        "Go have a conference: create one, let people in privately, and leave room for everything else",
    },
    labId: "conference",
    onGitHub: true,
  },
  {
    id: "conference-vision",
    name: "GO HAVE A CONFERENCE — vision",
    description:
      "The conference pilot written down before it went back into conversation.",
    category: "Experiences",
    status: "active",
    sources: ["docs/products/go-have-a-conference/VISION.md"],
    commit: {
      hash: "2a7b73b",
      date: "2026-10-11",
      subject:
        "Write down GO HAVE A CONFERENCE before it goes back into conversation",
    },
    onGitHub: true,
  },
  {
    id: "arrivals",
    name: "Conference Arrivals",
    description:
      "Watch your colleagues' flights come in, and what kind of claim each arrival time is.",
    category: "Experiences",
    status: "experimental",
    originalRoute: "/labs/conference",
    sources: ["src/lib/conference-arrivals/"],
    commit: {
      hash: "e1abc3a",
      date: "2026-10-20",
      subject:
        "Conference Arrivals: when everyone lands, and what kind of claim each time is",
    },
    labId: "arrivals",
  },
  {
    id: "experiment-01-bachelor-party",
    name: "Experiment 01 — Bachelor Party",
    description:
      "An extreme sandbox testing joy as a design constraint: six loud friends planning a bachelor weekend.",
    category: "Experiences",
    status: "experimental",
    originalRoute: "/about/experiment-01-bachelor-party",
    sources: ["src/app/about/experiment-01-bachelor-party/"],
    commit: BASELINE,
    onGitHub: true,
    notes: `Shares the number 01 with Discovery Space. ${BASELINE_NOTE}`,
  },
  {
    id: "experiment-04-wonder",
    name: "Experiment 04 — Wonder",
    description:
      "Deliberately smaller than the sandboxes before it: a sketchbook of small interactions, and the open questions they raise.",
    category: "Experiences",
    status: "experimental",
    originalRoute: "/about/experiment-04-wonder",
    sources: ["src/app/about/experiment-04-wonder/"],
    commit: BASELINE,
    onGitHub: true,
    notes: BASELINE_NOTE,
  },
  {
    id: "experiment-06-analog-adventures",
    name: "Experiment 06 — Analog Adventures",
    description:
      "The quietest sandbox: one packing interaction for a Sugar Lake FSR Saturday, ending with the phone being put away.",
    category: "Experiences",
    status: "experimental",
    originalRoute: "/about/experiment-06-analog-adventures",
    sources: ["src/app/about/experiment-06-analog-adventures/"],
    commit: BASELINE,
    onGitHub: true,
    notes: BASELINE_NOTE,
  },
  {
    id: "experiment-07-fishing-with-emi",
    name: "Experiment 07 — Fishing With Emi",
    description:
      "A first fishing adventure from Vernon through Trinity Valley to Hidden Lake: a real outing used as a Passport prototype, and the Adventure Builder with 13 of 22 modules on.",
    category: "Experiences",
    status: "experimental",
    originalRoute: "/about/experiment-07-fishing-with-emi",
    sources: [
      "src/app/about/experiment-07-fishing-with-emi/",
      "docs/product/originals/fishing-with-emi.md",
    ],
    commit: {
      hash: "2819edb",
      date: "2026-08-15",
      subject: "feat(labs): experiment 07 — Fishing With Emi",
    },
    onGitHub: true,
    notes:
      "The flagship acceptance experience. The page is a later artifact than the original concept; the originals are recorded separately below as needing recovery.",
  },
  {
    id: "fishing-with-emi-originals",
    name: "Fishing With Emi — the original documents",
    description:
      "Fishing_with_Emi_First_Adventure.pdf and 001-fishing-with-emi-passport-adventure-page.md, the originals the Labs page came from.",
    category: "Experiences",
    status: "missing",
    sources: [
      "docs/history/originals/Fishing_with_Emi_First_Adventure.pdf",
      "docs/history/originals/001-fishing-with-emi-passport-adventure-page.md",
    ],
    notes:
      "Never committed. They live in the ChatGPT Library, which this machine cannot reach. Recovery: Lorne exports both, unedited, into docs/history/originals/ (see docs/history/concepts.md).",
  },
  {
    id: "sycle-prototype",
    name: "Sycle — the arrivals board prototype",
    description:
      "The /sycle prototype, preserved from uncommitted work before GO HAVE A DAY integration.",
    category: "Experiences",
    status: "missing",
    originalRoute: "/sycle",
    sources: ["src/app/sycle/page.tsx", "docs/sycle/"],
    commit: {
      hash: "6ae9ab2",
      date: "2026-10-11",
      subject:
        "Preserve the Sycle prototype (uncommitted work, snapshot before GO HAVE A DAY integration)",
    },
    notes:
      "Exists only in git history, on branch sycle-prototype (6ae9ab2, also m184/int-on-main). Not on this release; restoring it means merging that branch on purpose, not copying files in.",
  },

  // ─────────────────────────────────────────────────────────── October
  {
    id: "experiment-03-october-passport",
    name: "Experiment 03 — October Passport",
    description:
      "The first seasonal prototype: weather, persona and After Dark filters, a moon-phase ambient layer, two camera features, and sourced local history.",
    category: "October",
    status: "archived",
    originalRoute: "/about/experiment-03-october-passport",
    sources: ["src/app/about/experiment-03-october-passport/"],
    commit: BASELINE,
    onGitHub: true,
    notes: `Before October became its own product at /october. ${BASELINE_NOTE}`,
  },
  {
    id: "october-bible",
    name: "October — product & creative bible",
    description:
      "October is a director, not a page. The full product and creative bible for one Experience.",
    category: "October",
    status: "active",
    sources: ["docs/product/october-experience-bible.md"],
    commit: {
      hash: "f17285a",
      date: "2026-09-21",
      subject:
        "October is a director, not a page: the product & creative bible",
    },
    onGitHub: true,
    notes: "Evidence of one Experience — not the Experience contract.",
  },
  {
    id: "october-home",
    name: "October Home",
    description:
      "The room you come back to: what could I do tonight, what is on this weekend, what has October got for me, and what have I already gathered.",
    category: "October",
    status: "active",
    originalRoute: "/october",
    sources: ["src/app/october/page.tsx"],
    commit: {
      hash: "d9ceca1",
      date: "2026-09-22",
      subject: "My October v0: want to do, did this, and nothing in between",
    },
    needs: ["atlas"],
    onGitHub: true,
    notes:
      "First added as My October v0; that list now lives at /october/mine and this route became the control room.",
  },
  {
    id: "october-video-store",
    name: "The Video Store",
    description:
      "A wall of films with a secret, and the room the Secret Room's door opens onto.",
    category: "October",
    status: "active",
    originalRoute: "/labs/october/video-store",
    route: "/october/store",
    sources: ["src/app/october/store/page.tsx"],
    commit: {
      hash: "1093b5a",
      date: "2026-09-23",
      subject:
        "October Home, the Video Store, and a card that goes where it says",
    },
    onGitHub: true,
    notes:
      "There was always one Video Store: /labs/october/video-store rendered the same component, and now forwards to /october/store.",
  },
  {
    id: "october-witching-hour",
    name: "Witching Hour",
    description:
      "The first October scene: a night that can reach across the table. Reached from the end of Found You, once it is dark where the visitor is.",
    category: "October",
    status: "experimental",
    originalRoute: "/labs/october/witching-hour",
    route: "/october/witching-hour",
    sources: ["src/app/october/witching-hour/"],
    commit: {
      hash: "5f5b518",
      date: "2026-09-22",
      subject: "Witching Hour, v0: a night that can reach across the table",
    },
    onGitHub: true,
    notes: `${OCTOBER_MOVE} ?at=doorway jumps to the four choices.`,
  },
  {
    id: "october-found-you",
    name: "October Found You",
    description:
      "It begins mid-sentence, as though it had been waiting. She notices, and she keeps it.",
    category: "October",
    status: "experimental",
    originalRoute: "/labs/october/found-you",
    route: "/october/found-you",
    sources: ["src/app/october/found-you/page.tsx"],
    commit: {
      hash: "866a769",
      date: "2026-09-27",
      subject: "October Found You: she notices, and she keeps it",
    },
    onGitHub: true,
    notes: OCTOBER_MOVE,
  },
  {
    id: "october-sketchbook",
    name: "The Sketchbook",
    description:
      "The bench October is built on: who she is turning out to be, the things she says, the rules nobody explained, the sound, the unbuilt ideas, and every reading of each scene.",
    category: "October",
    status: "experimental",
    originalRoute: "/labs/october/sketchbook",
    route: "/october/sketchbook",
    sources: [
      "src/app/october/sketchbook/",
      "src/domain/october/sketchbook.ts",
    ],
    commit: {
      hash: "d78f17e",
      date: "2026-09-24",
      subject: "The sketchbook, and two rooms you can actually walk into",
    },
    onGitHub: true,
    notes: OCTOBER_MOVE,
  },
  {
    id: "october-scariest-room",
    name: "The Scariest Room in Your House — Has Been Here",
    description:
      "One reading of The Scariest Room in Your House, made playable.",
    category: "October",
    status: "experimental",
    originalRoute: "/labs/october/scariest-room/has-been-here",
    route: "/october/scariest-room/has-been-here",
    sources: ["src/app/october/scariest-room/"],
    commit: {
      hash: "d78f17e",
      date: "2026-09-24",
      subject: "The sketchbook, and two rooms you can actually walk into",
    },
    onGitHub: true,
    notes: OCTOBER_MOVE,
  },
  {
    id: "october-another-way-out",
    name: "Secret Room — Another Way Out",
    description:
      "One of the Secret Room's exits, built to find out whether it is fun. A room can have many ways out.",
    category: "October",
    status: "archived",
    originalRoute: "/labs/october/secret-room/another-way-out",
    route: "/october/secret-room/another-way-out",
    sources: ["src/app/october/secret-room/"],
    commit: {
      hash: "d78f17e",
      date: "2026-09-24",
      subject: "The sketchbook, and two rooms you can actually walk into",
    },
    onGitHub: true,
    notes: `Kept untouched; the playable Secret Room at /october/room was built on what it found out. ${OCTOBER_MOVE}`,
  },
  {
    id: "october-for-bryan",
    name: "For Bryan",
    description:
      "A walk through October's bench, made for one person. It opens on the most ordinary sentence in the project.",
    category: "October",
    status: "experimental",
    originalRoute: "/labs/october/for-bryan",
    route: "/october/for-bryan",
    sources: ["src/app/october/for-bryan/page.tsx"],
    commit: {
      hash: "0b02df2",
      date: "2026-09-25",
      subject: "October's bench, and a walk through it for Bryan",
    },
    onGitHub: true,
    notes: OCTOBER_MOVE,
  },
  {
    id: "october-discovery-experiments",
    name: "Three answers to one question",
    description:
      '"I have no freaking idea what to do tonight" — answered as an evening composed for you (A), what you feel like (B), cards dealt at you (C), and the calendar (D), all on one pool.',
    category: "October",
    status: "experimental",
    originalRoute: "/labs/october/discovery",
    route: "/october/discovery",
    sources: ["src/app/october/discovery/"],
    commit: {
      hash: "de770ff",
      date: "2026-10-01",
      subject: "October Discover becomes one possibility, found four ways",
    },
    needs: ["atlas"],
    onGitHub: true,
    notes: `A, B, C and D are kept because the shipped Discover is a reaction to them. ${OCTOBER_MOVE}`,
  },
  {
    id: "october-synthesis",
    name: "October Discover — the synthesis",
    description:
      "One possibility pool across Atlas, films and Doings: one search, one filter vocabulary, one ranking. What the four experiments produced, promoted.",
    category: "October",
    status: "active",
    originalRoute: "/labs/october/synthesis",
    route: "/october/discover",
    sources: [
      "src/app/labs/october/synthesis/page.tsx",
      "src/app/october/discover/page.tsx",
    ],
    commit: {
      hash: "de770ff",
      date: "2026-10-01",
      subject: "October Discover becomes one possibility, found four ways",
    },
    needs: ["atlas"],
    onGitHub: true,
    notes:
      "/labs/october/synthesis still serves and renders the same component as /october/discover, so it cannot drift from the shipped one.",
  },
  {
    id: "october-discover-legacy",
    name: "October Discover — the lane-based original",
    description:
      "October's Discover as it was until 2026-10-01: lanes built per content type.",
    category: "October",
    status: "archived",
    originalRoute: "/october/discover",
    route: "/october/discovery/legacy",
    sources: ["src/app/october/discovery/legacy/page.tsx"],
    commit: {
      hash: "1093b5a",
      date: "2026-09-23",
      subject:
        "October Home, the Video Store, and a card that goes where it says",
    },
    needs: ["atlas"],
    onGitHub: true,
    notes:
      "Kept unchanged and unlinked when the synthesis replaced it, because it is the thing the current product is a reaction to.",
  },
  {
    id: "october-doors",
    name: "From October — the doors, and the Secret Room",
    description:
      "What October keeps for itself: the doors, a Secret Room with a real puzzle and a real answer.",
    category: "October",
    status: "active",
    originalRoute: "/october/from",
    sources: ["src/app/october/from/page.tsx", "src/app/october/room/page.tsx"],
    commit: {
      hash: "abc1fa3",
      date: "2026-10-11",
      subject:
        "October: open the doors — From October, a Secret Room with a real puzzle, a Video Store with a secret",
    },
    onGitHub: true,
  },
  {
    id: "october-make",
    name: "What should we make this October?",
    description:
      "Doings as shelves with weight, not a well-written database of 26 records.",
    category: "October",
    status: "active",
    originalRoute: "/october/make",
    sources: ["src/app/october/make/"],
    commit: {
      hash: "de770ff",
      date: "2026-10-01",
      subject: "October Discover becomes one possibility, found four ways",
    },
    onGitHub: true,
  },
  {
    id: "october-movie-night",
    name: "Movie Night",
    description:
      "Who's here, how much, three films. The theatrical version of choosing a film, for the evening when choosing is the hard part.",
    category: "October",
    status: "active",
    originalRoute: "/october/movies",
    route: "/october/movies/night",
    sources: ["src/app/october/movies/"],
    commit: {
      hash: "56afa92",
      date: "2026-09-22",
      subject: "Movie Night v0: who's here, how much, three films",
    },
    onGitHub: true,
    notes:
      "Moved, unchanged, from /october/movies to /october/movies/night so the ordinary catalogue could have the plain URL.",
  },

  // ─────────────────────────────────────────────────────────── Christmas
  {
    id: "christmas-passport-html",
    name: "CHRISTMAS. — the original HTML",
    description:
      "Passport's emotional interpretation of Christmas. Not a Christmas website — a feeling. The standalone page, snow and fireplace in vanilla JS.",
    category: "Christmas",
    status: "archived",
    originalRoute: "/labs/discovery-space/christmas-passport.html",
    sources: ["public/labs/discovery-space/christmas-passport.html"],
    commit: BASELINE,
    onGitHub: true,
    notes: `Its own title calls it "Experiment 04"; it was later ported into React as Experiment 05. The only HTML original in the whole git history. ${BASELINE_NOTE}`,
  },
  {
    id: "experiment-05-christmas",
    name: "Experiment 05 — Christmas Passport",
    description:
      "The Christmas HTML prototype ported into a real page: the snow layer, the fireplace sound, the same feeling.",
    category: "Christmas",
    status: "experimental",
    originalRoute: "/about/experiment-05-christmas",
    sources: ["src/app/about/experiment-05-christmas/"],
    commit: BASELINE,
    onGitHub: true,
    notes: `The HTML original it came from is kept, unchanged, beside it. ${BASELINE_NOTE}`,
  },
  {
    id: "experience-christmas-light-up",
    name: "Light-Up",
    description:
      "Downtown, the whole family. The Christmas fixture in the Experience Lab.",
    category: "Christmas",
    status: "experimental",
    originalRoute: "/labs/experience/christmas-light-up",
    sources: ["src/experience-lab/fixtures/christmasLightUp.ts"],
    commit: LAB_ROUND_1,
    onGitHub: true,
  },

  // ─────────────────────────────────────────────────────────── Discovery
  {
    id: "experiment-01-discovery-space",
    name: "Experiment 01 — Discovery Space",
    description:
      "A scroll-snap sketch of the pacing of moving through invented places one at a time, full-bleed.",
    category: "Discovery",
    status: "experimental",
    originalRoute: "/about/experiment-01-discovery-space",
    sources: ["src/app/about/experiment-01-discovery-space/"],
    commit: BASELINE,
    onGitHub: true,
    notes: BASELINE_NOTE,
  },
  {
    id: "experiment-02-discovery-swipe",
    name: "Experiment 02 — Discovery Swipe",
    description:
      "A working swipe stack with a growing Mood Board, and what Passport notices while you swipe.",
    category: "Discovery",
    status: "experimental",
    originalRoute: "/about/experiment-02-discovery-swipe",
    sources: ["src/app/about/experiment-02-discovery-swipe/"],
    commit: BASELINE,
    onGitHub: true,
    notes: BASELINE_NOTE,
  },
  {
    id: "labs-discovery-space",
    name: "Discovery Space (Labs)",
    description:
      "Discovery Space over seed experiences — the oldest Labs page in the repository.",
    category: "Discovery",
    status: "experimental",
    originalRoute: "/labs/discovery-space",
    sources: ["src/app/labs/discovery-space/page.tsx"],
    commit: FIRST_SNAPSHOT,
    onGitHub: true,
    notes:
      "In the very first snapshot of the repository. Saving to a board needs an account; looking does not.",
  },
  {
    id: "vancouver-discovery",
    name: "Discovery — the generic one",
    description:
      "Possibilities near you, measured from where you actually are. On gohaveaday.com it is the homepage.",
    category: "Discovery",
    status: "active",
    originalRoute: "/discovery",
    sources: ["src/app/discovery/"],
    commit: BASELINE,
    needs: ["atlas"],
    labId: "vancouver-discovery",
    onGitHub: true,
    notes:
      "Has been rebuilt many times since (ADRs 005–007: a sentence first, one search box, every activity findable). The earlier versions live only in git history.",
  },
  {
    id: "go-have-a-day",
    name: "Go have a day",
    description:
      "Say what you want. Get a day you can print, and leave the phone.",
    category: "Discovery",
    status: "active",
    originalRoute: "/go",
    sources: ["src/app/go/", "src/components/go/"],
    commit: {
      hash: "016854a",
      date: "2026-10-11",
      subject: "Go have a day: say it, build it, print it, leave the phone",
    },
    needs: ["atlas"],
    labId: "go-have-a-day",
    onGitHub: true,
  },

  // ─────────────────────────────────────────────────────────── Design Evolution
  {
    id: "design-lab",
    name: "Design lab — twelve directions",
    description:
      "Four rounds of what Discovery could look like, every one rendering the same real places from Atlas, so what is compared is design and not copywriting.",
    category: "Design Evolution",
    status: "experimental",
    originalRoute: "/labs/design",
    sources: DESIGN_LAB_SOURCES,
    commit: {
      hash: "27ca52d",
      date: "2026-10-10",
      subject:
        "Three ways Discovery could look, all rendering the same real places",
    },
    needs: ["atlas"],
    onGitHub: true,
  },
  ...designRound(
    1,
    {
      hash: "27ca52d",
      date: "2026-10-10",
      subject:
        "Three ways Discovery could look, all rendering the same real places",
    },
    [
      [
        "cinematic",
        "Cinematic",
        "Atmospheric and image-led. Full-bleed frames on a near-black ground, type living inside the picture.",
      ],
      [
        "editorial",
        "Editorial",
        "A premium travel magazine. Paper ground, display serif, asymmetric features, an index for everything without a photograph.",
      ],
      [
        "playful",
        "Playful",
        "Warm and colour-blocked. Chunky geometry, hard shadows, a grotesk throughout — no serif, no cartoons.",
      ],
    ],
  ),
  ...designRound(
    2,
    {
      hash: "5adda07",
      date: "2026-10-10",
      subject: "Three more directions, built from what round one got wrong",
    },
    [
      [
        "v2/editorial-cinematic",
        "Editorial Cinematic",
        "Cinematic's photographs on Editorial's bones, over a warm sandstone ground. Headlines lift over the lower edge of the picture.",
      ],
      [
        "v2/immersive-explorer",
        "Immersive Explorer",
        "Photography leads and the page moves sideways. Each activity is a horizontal rail of deliberately unequal tiles on ink-teal.",
      ],
      [
        "v2/travel-journal",
        "Modern Travel Journal",
        "Someone's beautifully designed notebook. Numbered entries, a margin that carries the town and the verbs, photographs set as inset plates.",
      ],
    ],
  ),
  ...designRound(
    3,
    {
      hash: "45e8ca8",
      date: "2026-10-10",
      subject:
        "Three on white, where the places do the work the interface was doing",
    },
    [
      [
        "v3/open-canvas",
        "Open Canvas",
        "White, and almost nothing on it but photographs. A near-full-width opener, then a tall pair, a wide one, a trio — size is the only rhythm.",
      ],
      [
        "v3/swipe",
        "Swipe & Discover",
        "The whole page is shelves. Cards nearly fill the viewport with the next one peeking, and each row states what makes its contents belong together.",
      ],
      [
        "v3/engine",
        "The Discovery Engine",
        "Finding is the hero. One enormous question, four plain answers, then photographs that each say why they are there.",
      ],
    ],
  ),
  ...designRound(
    4,
    {
      hash: "b32b87d",
      date: "2026-10-10",
      subject:
        "ONE HELL OF A DAY — brand confidence on top of the two ideas that worked",
    },
    [
      [
        "v4/adventure",
        "The Adventure Brand",
        "GO HAVE A DAY at 112px, then Atlas's verbs as links. The brand gets the first screen and gets out of the way.",
      ],
      [
        "v4/explorer",
        "The Everyday Explorer",
        "Discovery as a tool: four compact rows of pills, always optional, galleries that answer immediately.",
      ],
      [
        "v4/one-hell-of-a-day",
        "One Hell of a Day",
        "The product candidate: a sentence you edit rather than a panel you fill in. Its ideas became GO HAVE A DAY.",
      ],
    ],
  ),
  {
    id: "campfire-card",
    name: "Campfire card",
    description:
      "One Passport video card — Campfire — on its own, the living card idea in a single specimen.",
    category: "Design Evolution",
    status: "experimental",
    originalRoute: "/labs/campfire-card",
    sources: ["src/app/labs/campfire-card/page.tsx"],
    commit: FIRST_SNAPSHOT,
    onGitHub: true,
    notes:
      "In the very first snapshot of the repository. The idea behind it is written up in docs/old-might-be-garbage/compass/discovery-living-cards.md.",
  },
  {
    id: "physics-of-passport",
    name: "The Physics of Passport",
    description:
      "Motion and interaction doctrine: experiences as living things, not static cards.",
    category: "Design Evolution",
    status: "active",
    sources: ["docs/passport/the-physics-of-passport.md"],
    commit: BASELINE,
    onGitHub: true,
  },

  // ─────────────────────────────────────────────────────────── Brainstorming
  {
    id: "idea-atlas",
    name: "Idea Atlas",
    description:
      "The master creative wall: everything the ELK Labs family has made or imagined — personalities, moments, seasons, principles, dreams — meant to be grown for years.",
    category: "Brainstorming",
    status: "experimental",
    originalRoute: "/about/idea-atlas",
    sources: ["src/app/about/idea-atlas/"],
    commit: BASELINE,
    onGitHub: true,
    notes: `Its principles index points at brand-principles.md, which is not in this repository (see below). ${BASELINE_NOTE}`,
  },
  {
    id: "ideas-to-make-pages",
    name: "Ideas to make pages",
    description:
      "The studio's project wall: ten concept cards, each closed by default, each an experiment in what Passport could feel like rather than a commitment to build it.",
    category: "Brainstorming",
    status: "experimental",
    originalRoute: "/about/ideas-to-make-pages",
    sources: ["src/app/about/ideas-to-make-pages/"],
    commit: BASELINE,
    onGitHub: true,
    notes: BASELINE_NOTE,
  },
  {
    id: "vision-studio",
    name: "The Secret Passport Creative Studio",
    description:
      "A mood board that runs in production: music cuts and the raw idea vault. Findable only by URL, on purpose.",
    category: "Brainstorming",
    status: "experimental",
    originalRoute: "/about/vision",
    sources: ["src/app/about/vision/"],
    commit: BASELINE,
    onGitHub: true,
    notes: BASELINE_NOTE,
  },
  {
    id: "originals",
    name: "Passport's original product ideas",
    description:
      "GO HAVE A DAY and NOW GO HAVE ANOTHER, Moments, Days, the builder, Go Offline, paper, Boards — and an inventory of every original idea and how far it got.",
    category: "Brainstorming",
    status: "active",
    sources: [
      "docs/product/originals/README.md",
      "docs/product/originals/go-have-a-day.md",
      "docs/product/originals/idea-inventory.md",
    ],
    commit: {
      hash: "76b564e",
      date: "2026-10-11",
      subject: "Write down GO HAVE A DAY before it goes back into conversation",
    },
    onGitHub: true,
  },
  {
    id: "treasure-chest",
    name: "Treasure Chest",
    description: "The early idea stash. Life is measured in moments.",
    category: "Brainstorming",
    status: "archived",
    sources: ["archive/03-treasure-chest.md"],
    commit: BASELINE,
    onGitHub: true,
  },
  {
    id: "concept-history",
    name: "Concept history — inventory",
    description:
      "Where Fishing With Emi, Wonder, analog maps, Moments, the Adventure Builder, Boards and Go Have a Day can be found, and which originals are missing.",
    category: "Brainstorming",
    status: "active",
    sources: ["docs/history/concepts.md"],
    commit: {
      hash: "bf8bcc7",
      date: "2026-10-11",
      subject: "Inventory where Passport's original concepts live today",
    },
    onGitHub: true,
  },

  // ─────────────────────────────────────────────────────────── Product Philosophy
  {
    id: "doctrine",
    name: "Passport Product Doctrine",
    description:
      "Product authority. Passport helps you discover a day worth getting excited about — and then helps you actually live it.",
    category: "Product Philosophy",
    status: "active",
    sources: ["docs/PASSPORT-PRODUCT-DOCTRINE.md"],
    commit: {
      hash: "41d1a6a",
      date: "2026-10-10",
      subject: "Document the Passport product doctrine",
    },
    onGitHub: true,
  },
  {
    id: "about-this-is-why",
    name: "This Is Why — Phase Forever",
    description:
      "Not a conventional About page. A living mood board for what Passport is supposed to make people feel. LIVE.",
    category: "Product Philosophy",
    status: "experimental",
    originalRoute: "/about",
    sources: ["src/app/about/page.tsx", "src/app/about/content.ts"],
    commit: BASELINE,
    onGitHub: true,
    notes: BASELINE_NOTE,
  },
  {
    id: "philosophy",
    name: "Why Passport Exists",
    description:
      'Where "one hell of a day" was first written down, in the original Product Brain.',
    category: "Product Philosophy",
    status: "archived",
    sources: ["archive/13-philosophy.md"],
    commit: BASELINE,
    onGitHub: true,
  },
  {
    id: "science-of-meaningful-experiences",
    name: "The Science of Meaningful Experiences",
    description: "The longest of the original Product Brain documents.",
    category: "Product Philosophy",
    status: "archived",
    sources: ["archive/14-science-of-meaningful-experiences.md"],
    commit: BASELINE,
    onGitHub: true,
  },
  {
    id: "product-brain",
    name: "The Product Brain",
    description:
      "The original numbered set: mission, principles, problem, heroes, success, curation, core experience, capabilities, the MVP visual contract — and the foundation prompts.",
    category: "Product Philosophy",
    status: "archived",
    sources: ["archive/", "archive/prompts/00-foundation/"],
    commit: BASELINE,
    onGitHub: true,
  },
  {
    id: "passport-vision-2026-07",
    name: "Passport — Product Vision (July)",
    description:
      "Passport is not a tourism website, an itinerary builder, or a recommendation engine. With the Compass Discovery Engine and Living Cards notes beside it.",
    category: "Product Philosophy",
    status: "archived",
    sources: [
      "docs/old-might-be-garbage/passport-vision.md",
      "docs/old-might-be-garbage/compass/",
    ],
    commit: BASELINE,
    onGitHub: true,
    notes:
      "Kept in a folder named old-might-be-garbage, which is a fair warning: history, not authority. Its core claim survives in the doctrine.",
  },
  {
    id: "future-passport-experience",
    name: "future-passport-experience.md",
    description:
      "The fullest prior vision (2026-08-11): the Atlas → Passport → memory → Atlas loop, serendipity, anticipation, traveller language.",
    category: "Product Philosophy",
    status: "missing",
    sources: ["docs/future/future-passport-experience.md"],
    notes:
      "Never committed to any branch of this repository. Last known at Businesses/Websites/elk-passport/docs/future/ on the Mac, in a workspace root that is not version controlled. Recovery: copy the original, unedited, into docs/history/originals/ and commit it. Four files in this repository still point at it (the doctrine §17, ideas-to-make-pages, place-detail content).",
  },
  {
    id: "brand-principles",
    name: "brand-principles.md",
    description:
      'ELK-wide brand. "Help people feel more alive." "Atlas understands. Passport inspires."',
    category: "Product Philosophy",
    status: "missing",
    sources: ["project-management/brand-principles.md"],
    notes:
      "Never committed to any branch of this repository; project-management/README.md here says the folder moved to the workspace root on 2026-07-29. Last known at Businesses/Websites/elk-passport/project-management/ on the Mac. Recovery: copy the original, unedited, into docs/history/originals/ and commit it. The doctrine §1, the Idea Atlas and passportUsage.ts still cite it.",
  },
];

/**
 * A design round's three directions. Each opens on the same real places from
 * Atlas, and each has a place page at `<route>/<id>` beside it.
 */
function designRound(
  round: number,
  commit: CreativeCommit,
  directions: readonly (readonly [string, string, string])[],
): CreativeWork[] {
  return directions.map(([path, name, description]) => ({
    id: `design-${path.replace("/", "-")}`,
    name: `Round ${round} — ${name}`,
    description,
    category: "Design Evolution",
    status: "experimental",
    originalRoute: `/labs/design/${path}`,
    sources: [`src/app/labs/design/${path}/`],
    commit,
    needs: ["atlas"],
    onGitHub: true,
  }));
}

type Env = Readonly<Record<string, string | undefined>>;

/** Whether, and where, an original can be opened from this environment. */
export interface Availability {
  readonly href?: string;
  /** Why there is no link, or what opening it requires. */
  readonly note?: string;
}

/**
 * Decided per environment, like Labs. A `missing` original has no link. One
 * with a `labId` defers to the Labs registry. One that needs Atlas has no
 * link where Atlas is not configured, because it would open onto an empty
 * page. Anything else opens at its current route.
 */
export function availability(
  work: CreativeWork,
  env: Env = process.env,
  isDev: boolean = process.env.NODE_ENV !== "production",
): Availability {
  if (work.status === "missing") {
    return { note: "Does not run from this release." };
  }
  if (work.labId) {
    const lab = labExperiments(env, isDev).find((e) => e.id === work.labId);
    if (!lab) throw new Error(`No Labs experiment "${work.labId}"`);
    if (lab.status !== "playable") return { note: lab.note };
  }
  const href = work.route ?? work.originalRoute;
  if (!href) return {};
  if (work.needs?.includes("atlas") && !env.ATLAS_API_URL) {
    return {
      note: "Needs Atlas, which is not configured in this environment.",
    };
  }
  if (work.needs?.includes("account")) {
    return { href, note: "Needs a Passport account." };
  }
  return { href };
}

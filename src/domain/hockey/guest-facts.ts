/**
 * **What the arena's own pages say about the things a group actually hunts
 * for mid-game** — family washrooms, a quiet room, first aid, the team store,
 * no-alcohol seats. Each line with its page and date. Where a page and the
 * 2026-09-29 map disagree, both are shown (`concourse.ts` is the map's
 * reading; this is the pages').
 *
 * Read 2026-10-22; copies in `~/passport/scratch/arena-mode-research/`.
 */

export interface GuestFact {
  readonly topic:
    "washrooms" | "family" | "help" | "store" | "noAlcohol" | "water";
  readonly text: string;
  readonly source: string;
  readonly url: string;
}

const FAMILY = {
  source: "Children and Family Guide, 2026-01-06",
  url: "https://rogersarena.com/children-and-family-guide/",
};
const ACCESS = {
  source: "Fans with Disabilities and Accessible Needs, 2025-12-16",
  url: "https://rogersarena.com/disabilities/",
};
const FAQ = {
  source: "Rogers Arena FAQ",
  url: "https://rogersarena.com/frequently-asked-questions/",
};
const STORE = {
  source: "Rogers Arena — Team Store, 2025-01-24",
  url: "https://rogersarena.com/team-store/",
};

export const GUEST_FACTS: readonly GuestFact[] = [
  {
    topic: "washrooms",
    text: "Every restroom is wheelchair accessible. Universal washrooms: sections 103, 109 and 319.",
    ...ACCESS,
  },
  {
    topic: "family",
    text: "Extra-large single family washrooms: sections 103, 109 and 309. Baby change tables in all washrooms.",
    ...FAMILY,
  },
  {
    topic: "family",
    text: "A quiet room at section 108, for nursing parents or anyone who needs a break — by request.",
    ...FAMILY,
  },
  {
    topic: "family",
    text: "Free noise-cancelling headphones (child and adult) at Guest Services, for a licence or card as deposit. Blankets too — it's an ice rink.",
    ...FAMILY,
  },
  {
    topic: "help",
    text: "Guest Services: sections 114 and 311, and 104 at hockey games for club-section ticket holders.",
    ...ACCESS,
  },
  {
    topic: "help",
    text: "First aid staff near sections 104 and 306.",
    ...FAQ,
  },
  {
    topic: "water",
    text: "Drinking fountains at sections 102, 110, 113 and 306 (the 2026 map draws some elsewhere).",
    ...ACCESS,
  },
  {
    topic: "store",
    text: "Canucks Team Store: street entrance at Gate 6, section 113, with pop-ups around the arena on game days. Game-day hours aren't published.",
    ...STORE,
  },
  {
    topic: "store",
    text: "Shop online at Vanbase.ca.",
    source: "Rogers Arena — Team Store",
    url: "https://vanbase.ca",
  },
  {
    topic: "noAlcohol",
    text: "Non-alcohol seats exist in parts of sections 102, 311, 312, 317 and 318 — ask when buying tickets.",
    ...FAQ,
  },
];

/** Where the arena's pages and the map disagree about these things. */
export const GUEST_CONFLICTS: readonly string[] = [
  "Team Store: the store page says section 113; the accessibility page says 114; the 2026 map draws it between 114 and 115.",
  "Third-level washroom: a family washroom at 309 (family guide) and a universal washroom at 319 (accessibility page). These may be two different rooms.",
  "Fins Family Zone: the family guide says section 102; the 2026 map draws it by 103 on Level 100 and by 319–320 on Level 300.",
  "Legends Locker Room: the only page describing it (2020) says section 317; the 2026 map draws it by 315.",
  "Drinking fountains: the accessibility page says 102, 110, 113 and 306; the 2026 map draws them by 104–106, 120 and 306.",
  "Stand sections: the food page (2026-02-25) and the map (2026-09-29) often differ by one section, and the food page names stands the map no longer shows (Inniskillin Wine Bar, Uno Gelato carts).",
];

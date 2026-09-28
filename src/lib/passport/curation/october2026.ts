/**
 * **October 2026 — the curated launch collection.**
 *
 * ## What this register is
 *
 * A finite list of subjects a human explicitly selected for launch, and the
 * presentation decisions made for each of them. It is the smallest durable
 * marker that answers *"is this entity part of October 2026?"* — a set of ids
 * in version control, changed only by a commit, reviewable in a diff.
 *
 * It lives in Passport rather than in Atlas on purpose. Nothing here is a fact
 * about the world: which photograph leads, which order the cards sit in, which
 * of five true statements about a date the page should print. Atlas may know
 * five representations; Passport picks the best human one. Keeping that
 * judgement out of the corpus is what stops layout warping the ontology.
 *
 * ## What curation may and may not do
 *
 * ```
 * SELECT     choose the hero from media that exists
 * ORGANIZE   group, order, name a section
 * PRESENT    suppress a fact the page already says better elsewhere
 * ADD        verified material, with its provenance
 *
 * never      invent, fake, guess, or hide a real conflict
 * ```
 *
 * **Every asset below carries the page it was found on.** Each was opened and
 * looked at before being listed — the same site's media also includes ticket
 * buttons, four radio-station logos and a septic-pumping company, none of
 * which are photographs of anything. `suppressFacts` removes nothing from
 * Atlas; it is a statement about this page only.
 */

export const OCTOBER_2026 = "october-2026-launch" as const;

export interface CuratedAsset {
  readonly url: string;
  /** What it is, in a caption a traveller could read. */
  readonly caption: string;
  /** The page this asset was found on. Required: an asset with no source is not verified. */
  readonly provenance: string;
}

export interface CuratedVideo extends CuratedAsset {
  readonly width: number;
  readonly height: number;
  /** Seconds. Stated so a reader knows what they are committing to. */
  readonly durationSeconds: number;
}

/** One card in a named group — a maze, a lane, a session. */
export interface CuratedCard {
  /** The Atlas key-fact label this card is built from. Its value is the body. */
  readonly factLabel: string;
  /** The card's own title, when the fact's label is not what a traveller should read. */
  readonly title?: string;
  readonly eyebrow?: string;
  readonly image?: CuratedAsset;
  readonly mark?: CuratedAsset;
}

export interface CuratedPrice {
  /** The Atlas key-fact label holding the amount. */
  readonly factLabel: string;
  readonly name: string;
  readonly detail?: string;
  readonly featured?: boolean;
}

export interface CuratedGroup {
  readonly id: string;
  readonly title: string;
  /** Atlas key-fact labels, in the order a traveller should read them. */
  readonly factLabels: readonly string[];
}

export interface Curation {
  readonly collection: typeof OCTOBER_2026;
  readonly entityId: string;
  /**
   * A one-line lead, written by a human from what Atlas holds — never a new
   * claim. Absent means the subject's own description leads.
   */
  readonly editorialSummary?: string;
  /** Shown above the title. The publisher's own name for this edition. */
  readonly eyebrow?: string;
  readonly heroVideo?: CuratedVideo;
  readonly heroImage?: CuratedAsset;
  /** Overlaid on the hero. */
  readonly logo?: CuratedAsset;
  /** A repeating texture behind a section. Decoration, never information. */
  readonly texture?: CuratedAsset;
  readonly featuredCta?: { readonly label: string; readonly factLabel: string };
  readonly cards?: {
    readonly title: string;
    readonly introFactLabel?: string;
    readonly items: readonly CuratedCard[];
  };
  readonly pricing?: {
    readonly title: string;
    readonly tiers: readonly CuratedPrice[];
    /**
     * Lines under the tiers. `prefix` is there because a bare value can be
     * unreadable on its own: `$46.71 / PERSON` says nothing without "Business
     * groups" in front of it, while `TICKETS COST UP TO $5 MORE AT THE DOOR`
     * needs no help. The value itself is always Atlas's, verbatim.
     */
    readonly notes: readonly {
      readonly factLabel: string;
      readonly prefix?: string;
    }[];
  };
  readonly groups?: readonly CuratedGroup[];
  /**
   * Fact labels this page does not print, each with the reason. Nothing is
   * removed from Atlas — see `factVisibility.ts` for the rules that catch the
   * general cases without a list.
   */
  readonly suppressFacts?: readonly {
    readonly label: string;
    readonly because: string;
  }[];
}

const FOS = "https://fosokanagan.com/";
const maze = (slug: string) => `https://fosokanagan.com/mazes/${slug}/`;

const FIELD_OF_SCREAMS: Curation = {
  collection: OCTOBER_2026,
  entityId: "exp-field-of-screams-okeefe-ranch",
  eyebrow: "Field of Screams 13: The Unlucky",
  editorialSummary:
    "Four new mazes across a working heritage ranch after dark. Choose one, enter two, or attempt to survive all four.",
  heroVideo: {
    url: "https://fosokanagan.com/wp-content/uploads/2026/07/file.webm",
    caption: "The midway and maze entrances on an open night, 2026 season",
    provenance: FOS,
    width: 1920,
    height: 1080,
    durationSeconds: 27,
  },
  logo: {
    url: "https://fosokanagan.com/wp-content/uploads/2026/05/FOS-2026-Logo.png",
    caption: "Field of Screams",
    provenance: FOS,
  },
  texture: {
    url: "https://fosokanagan.com/wp-content/uploads/2026/07/FOS-Footer-Desktop.png",
    caption: "Maze pattern",
    provenance: FOS,
  },
  featuredCta: { label: "Get tickets", factLabel: "Tickets" },
  cards: {
    title: "The mazes",
    introFactLabel: "Mazes",
    items: [
      {
        factLabel: "The Village",
        eyebrow: "Maze 1",
        image: {
          url: "https://fosokanagan.com/wp-content/uploads/2026/07/EV_FOS_Village_poster.png",
          caption: "The Village — you took the wrong road",
          provenance: maze("the-village"),
        },
        mark: {
          url: "https://fosokanagan.com/wp-content/uploads/2026/08/Village-Icon.png",
          caption: "The Village maze mark",
          provenance: maze("the-village"),
        },
      },
      {
        factLabel: "Distortion",
        eyebrow: "Maze 2",
        image: {
          url: "https://fosokanagan.com/wp-content/uploads/2026/07/EV_FOS_Distortion_Poster.png",
          caption: "Distortion — nothing is what it seems",
          provenance: maze("distortion"),
        },
        mark: {
          url: "https://fosokanagan.com/wp-content/uploads/2026/08/Distortion-Icon.png",
          caption: "Distortion maze mark",
          provenance: maze("distortion"),
        },
      },
      {
        factLabel: "Chocolate Factory",
        eyebrow: "Maze 3",
        image: {
          url: "https://fosokanagan.com/wp-content/uploads/2026/07/EV_FOS_Chocolate_Poster.png",
          caption: "Chocolate Factory — every treat has a price",
          provenance: maze("chocolate-factory"),
        },
        mark: {
          url: "https://fosokanagan.com/wp-content/uploads/2026/08/Chocolate-Icon.png",
          caption: "Chocolate Factory maze mark",
          provenance: maze("chocolate-factory"),
        },
      },
      {
        factLabel: "Vintage Hotel",
        eyebrow: "Maze 4",
        image: {
          url: "https://fosokanagan.com/wp-content/uploads/2026/07/EV_FOS_Hotel_Poster.png",
          caption: "Vintage Hotel — vacancy is only an illusion",
          provenance: maze("vintage-hotel"),
        },
        mark: {
          url: "https://fosokanagan.com/wp-content/uploads/2026/08/Hotel-Icon.png",
          caption: "Vintage Hotel maze mark",
          provenance: maze("vintage-hotel"),
        },
      },
    ],
  },
  pricing: {
    title: "Tickets",
    tiers: [
      {
        factLabel: "Single Maze Price",
        name: "Single maze",
        detail: "One maze, your choice",
      },
      {
        factLabel: "Double Maze Price",
        name: "Double maze",
        detail: "Enter two",
      },
      {
        factLabel: "All Mazes Price",
        name: "All four mazes",
        detail: "Attempt to survive all four",
        featured: true,
      },
      {
        factLabel: "VIP Pass Price",
        name: "VIP pass",
        detail: "All four, with shorter waits",
      },
    ],
    notes: [
      { factLabel: "Tickets Cost Increase" },
      { factLabel: "Business Group Pricing", prefix: "Business groups" },
    ],
  },
  groups: [
    {
      id: "arrive",
      title: "Getting there",
      factLabels: ["Arrival and opening", "Parking"],
    },
    {
      id: "wear",
      title: "What it's like, and what to wear",
      factLabels: ["Weather", "What to wear"],
    },
    { id: "who", title: "Who it's for", factLabels: ["Suitability", "Safety"] },
    { id: "rules", title: "Rules", factLabels: ["Rules", "Prohibited items"] },
    {
      id: "tickets",
      title: "Ticket conditions",
      factLabels: ["Refunds", "Re-entry", "Ticket transfers", "Cancellations"],
    },
    { id: "season", title: "This season", factLabels: ["Final night"] },
  ],
  suppressFacts: [
    {
      label: "Season",
      because: "WHEN already renders the interval, formatted for a reader",
    },
    {
      label: "Venue",
      because:
        "its value is a sentence repeating the description, and WHERE already names the ranch",
    },
    { label: "Edition", because: "printed above the title as the eyebrow" },
    {
      label: "Tickets",
      because:
        "it is a URL, and the page's primary call to action is built from it",
    },
    {
      label: "Mazes",
      because: "it introduces the maze section and is printed there",
    },
    {
      label: "VIP Pass Benefit",
      because: "printed as the VIP tier's own detail line",
    },
    {
      label: "Food on site",
      because:
        "Atlas holds the label with an empty list — the page would print a promise with nothing behind it",
    },
  ],
};

const REGISTER: readonly Curation[] = [FIELD_OF_SCREAMS];

/** Whether this exact entity is part of the curated launch collection. */
export const isCurated = (entityId: string): boolean =>
  REGISTER.some((c) => c.entityId === entityId);

/** The curation for this entity, or `undefined` — which means the ordinary page. */
export const curationFor = (entityId: string): Curation | undefined =>
  REGISTER.find((c) => c.entityId === entityId);

/** Every fact label this curation places somewhere of its own. */
export function placedFactLabels(curation: Curation): ReadonlySet<string> {
  const placed = new Set<string>();
  for (const s of curation.suppressFacts ?? []) placed.add(s.label);
  for (const c of curation.cards?.items ?? []) placed.add(c.factLabel);
  if (curation.cards?.introFactLabel) placed.add(curation.cards.introFactLabel);
  for (const t of curation.pricing?.tiers ?? []) placed.add(t.factLabel);
  for (const n of curation.pricing?.notes ?? []) placed.add(n.factLabel);
  for (const g of curation.groups ?? [])
    for (const l of g.factLabels) placed.add(l);
  if (curation.featuredCta) placed.add(curation.featuredCta.factLabel);
  return placed;
}

/** Every asset a curation references, for an audit of what was added and from where. */
export function curatedAssets(curation: Curation): readonly CuratedAsset[] {
  const out: CuratedAsset[] = [];
  for (const a of [
    curation.heroVideo,
    curation.heroImage,
    curation.logo,
    curation.texture,
  ])
    if (a) out.push(a);
  for (const c of curation.cards?.items ?? []) {
    if (c.image) out.push(c.image);
    if (c.mark) out.push(c.mark);
  }
  return out;
}

/**
 * **Sesh Wars — the words of the game.**
 *
 * One mountain has features; a rider posts a clip of themselves on one; a
 * second rider answers with their own clip on the same feature, and that is a
 * challenge; people vote; the votes decide winners, and winners decide
 * champions. Nothing here talks to a database: the same types carry the real
 * product (rows read as the caller, `src/app/snow/_server/sesh.ts`) and the
 * demo (a fictional world on the visitor's phone, `./demo.ts`).
 *
 * Owner brief "SESH WARS — BRING THE MOUNTAIN TO LIFE" (2026-11-10).
 * Record: docs/product/snow/SESH-WARS.md.
 */

export const SPORTS = ["ski", "snowboard"] as const;
export type Sport = (typeof SPORTS)[number];
export const SPORT_LABEL: Record<Sport, string> = {
  ski: "Ski",
  snowboard: "Snowboard",
};

export const DIVISIONS = ["beginner", "intermediate", "advanced"] as const;
export type Division = (typeof DIVISIONS)[number];
export const DIVISION_LABEL: Record<Division, string> = {
  beginner: "Rookie",
  intermediate: "Wingman",
  advanced: "Ace",
};
export const DIVISION_WORDS: Record<Division, string> = {
  beginner: "Beginner — first park laps, small features",
  intermediate: "Intermediate — comfortable on smalls and mediums",
  advanced: "Advanced — confident on the bigger lines",
};

/**
 * Who a rider is, for the safety rules. `youth` is 13 to 17. Under 13 has no
 * profile of their own: a parent or guardian posts from theirs (the clip says
 * so), which keeps a child's name and face off a public profile.
 */
export const AGE_GROUPS = ["youth", "adult"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const CATEGORIES = [
  "king-queen",
  "best-trick",
  "best-style",
  "cleanest-landing",
  "most-creative",
  "best-progression",
  "harmless-bail",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  "king-queen": "King / Queen of the Feature",
  "best-trick": "Best Trick",
  "best-style": "Best Style",
  "cleanest-landing": "Cleanest Landing",
  "most-creative": "Most Creative",
  "best-progression": "Best Progression",
  "harmless-bail": "Funniest Harmless Bail",
};

/** What a voter is asked to judge. None of these is size, speed or risk. */
export const CATEGORY_JUDGE: Record<Category, string> = {
  "king-queen": "Who owned this feature? Style, control, the whole run.",
  "best-trick": "Best trick done well — clean beats big.",
  "best-style": "Who made it look the best?",
  "cleanest-landing": "Who stuck it cleanest?",
  "most-creative": "Who saw the feature differently?",
  "best-progression": "Who learned the most since their last clip?",
  "harmless-bail":
    "Funniest bail where the rider got up laughing. Nobody hurt, or it isn't eligible.",
};

export const FEATURE_KINDS = [
  "park-lane",
  "jump",
  "rail",
  "box",
  "roller",
  "halfpipe",
  "side-hit",
  "jib",
] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];
export const FEATURE_KIND_LABEL: Record<FeatureKind, string> = {
  "park-lane": "Park lane",
  jump: "Jump",
  rail: "Rail",
  box: "Box",
  roller: "Rollers",
  halfpipe: "Halfpipe",
  "side-hit": "Side hit",
  jib: "Jib zone",
};

/** The resort's own size words (S/M/L/XL signage), never a steepness claim. */
export const SIZES = ["small", "medium", "large", "xl"] as const;
export type Size = (typeof SIZES)[number];
export const SIZE_LABEL: Record<Size, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  xl: "XL",
};

export type FeatureStatus = "approved" | "proposed" | "closed" | "removed";

export interface FeatureSource {
  readonly url: string;
  /** The resort's words, verbatim or as close as the page allowed. */
  readonly quote: string;
  /** `YYYY-MM-DD` — the day Passport read it. */
  readonly checked: string;
}

export interface Feature {
  readonly id: string;
  readonly mountainId: string;
  readonly name: string;
  readonly kind: FeatureKind;
  /** The size words the resort uses for it, smallest first. */
  readonly sizes: readonly Size[];
  /** Where it is, in the resort's words ("TELUS Park"). Never coordinates. */
  readonly where: string;
  readonly description: string;
  readonly status: FeatureStatus;
  /** Present on every real feature: where the resort says it exists. */
  readonly source?: FeatureSource;
  /** Fictional, for the demo only. Shown as such everywhere. */
  readonly demo?: boolean;
  /** When the park opens, if the resort has published it. */
  readonly opens?: string;
  /** Rules the resort publishes for it ("Helmets are mandatory"). */
  readonly note?: string;
}

export interface Rider {
  readonly id: string;
  readonly name: string;
  readonly homeMountain: string;
  readonly sport: Sport;
  readonly division?: Division;
  readonly ageGroup: AgeGroup;
  /** ISO time the profile was made. */
  readonly since: string;
  readonly crew?: string;
  readonly demo?: boolean;
  /** Favourite features, by id, in the rider's order. */
  readonly favourites?: readonly string[];
}

export type ClipMedia =
  /** A real upload, played from storage through a short-lived link. */
  | { readonly kind: "video"; readonly url: string; readonly poster?: string }
  /** A demo illustration — drawn, never presented as footage. */
  | { readonly kind: "illustration"; readonly seed: number }
  /** A file the visitor picked in the demo: on their phone only. */
  | { readonly kind: "local"; readonly url: string };

export type ClipStatus = "published" | "hidden" | "removed";

export interface Clip {
  readonly id: string;
  readonly featureId: string;
  readonly riderId: string;
  readonly sport: Sport;
  readonly division: Division;
  readonly category: Category;
  readonly caption: string;
  /** ISO time it was posted. */
  readonly at: string;
  readonly media: ClipMedia;
  readonly status: ClipStatus;
  /** Posted by a parent or guardian for a rider under 13. */
  readonly byGuardian?: boolean;
}

export interface Challenge {
  readonly id: string;
  readonly featureId: string;
  readonly category: Category;
  readonly division: Division;
  /** The clip that was challenged. */
  readonly defenderClipId: string;
  /** The answer. */
  readonly challengerClipId: string;
  readonly at: string;
  readonly closesAt: string;
}

export type Side = "defender" | "challenger";

export interface Vote {
  readonly challengeId: string;
  readonly voterId: string;
  readonly side: Side;
  readonly at: string;
}

export type ThreadKind = "feature" | "challenge" | "clip";

export interface Chirp {
  readonly id: string;
  readonly thread: { readonly kind: ThreadKind; readonly id: string };
  readonly authorId: string;
  readonly body: string;
  readonly at: string;
  readonly status: "published" | "hidden" | "removed";
}

export const REACTIONS = [
  "sick",
  "stomped",
  "nice-try",
  "your-move",
  "send-it",
] as const;
export type ReactionKind = (typeof REACTIONS)[number];
export const REACTION_LABEL: Record<
  ReactionKind,
  { emoji: string; words: string }
> = {
  sick: { emoji: "🔥", words: "SICK!" },
  stomped: { emoji: "👑", words: "STOMPED!" },
  "nice-try": { emoji: "😂", words: "NICE TRY!" },
  "your-move": { emoji: "⚔️", words: "YOUR MOVE!" },
  "send-it": { emoji: "🚀", words: "SEND IT!" },
};

export interface Reaction {
  readonly clipId: string;
  readonly riderId: string;
  readonly kind: ReactionKind;
}

export interface Block {
  readonly blockerId: string;
  readonly blockedId: string;
}

/** Everything a page needs, already filtered to what the viewer may see. */
export interface World {
  readonly features: readonly Feature[];
  readonly riders: readonly Rider[];
  readonly clips: readonly Clip[];
  readonly challenges: readonly Challenge[];
  readonly votes: readonly Vote[];
  readonly chirps: readonly Chirp[];
  readonly reactions: readonly Reaction[];
  readonly blocks: readonly Block[];
  /** Past-season champions, kept because a season's rows may be archived. */
  readonly legends?: readonly Legend[];
}

export interface Legend {
  readonly featureId: string;
  readonly season: string;
  readonly riderId: string;
}

/** Who is looking: nobody, or a rider (a signed-in person with a profile). */
export interface Viewer {
  readonly riderId?: string;
  /** Signed in, with or without a rider profile yet. */
  readonly signedIn: boolean;
  readonly ageGroup?: AgeGroup;
  readonly moderator?: boolean;
}

export const EMPTY_WORLD: World = {
  features: [],
  riders: [],
  clips: [],
  challenges: [],
  votes: [],
  chirps: [],
  reactions: [],
  blocks: [],
};

export const SESH_MOUNTAINS = [
  "silverstar",
  "big-white",
  "whistler-blackcomb",
] as const;
export type SeshMountain = (typeof SESH_MOUNTAINS)[number];
export const isSeshMountain = (v: unknown): v is SeshMountain =>
  typeof v === "string" && (SESH_MOUNTAINS as readonly string[]).includes(v);

export const isOne = <T extends string>(
  list: readonly T[],
  v: unknown,
): v is T => typeof v === "string" && (list as readonly string[]).includes(v);

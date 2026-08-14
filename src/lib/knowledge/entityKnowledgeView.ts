import "server-only";
import type { SectionType } from "@/lib/passport/composition";

/**
 * What Atlas knows about one entity, arranged as **knowledge a curator
 * reads** — not as metadata about how it was ingested.
 *
 * ## The correction this represents
 *
 * The previous Entity Workspace opened with Knowledge Score, Source
 * Categories 1/10, and "2 pieces extracted". Every one of those answers
 * *"how did ingestion go?"* — a debugging question with a finite answer —
 * when the curator arrived asking *"what does Atlas know?"*.
 *
 * So this module produces **knowledge sections**, each holding real values,
 * with ingestion metadata pushed to a `provenance` field that the UI shows
 * only on demand.
 *
 * ## Three states, and the third is the point
 *
 * - `shown` — Atlas knows it and Passport displays it
 * - `hidden` — Atlas knows it, Passport does not display it
 * - `unknown` — Atlas does not know it yet
 *
 * A section with nothing behind it is **not omitted**. It renders as a
 * named absence with a research action, because *"Atlas does not currently
 * know the menu"* is itself knowledge — it tells a curator exactly what to
 * do next, where an omitted section tells them nothing.
 *
 * ## Nothing is invented
 *
 * Every value here is read from Atlas. Where Atlas holds nothing, the
 * section says so plainly. This module never generates prose, never infers
 * a value from a neighbouring one, and never fills a gap to make the page
 * look complete.
 *
 * ## Not restaurant-specific
 *
 * The section catalogue below is declarative and keyed by entity kind.
 * Adding a template for Events or Trails is adding entries to a list, not
 * writing a new page.
 */

export type KnowledgeState = "shown" | "hidden" | "unknown";

/**
 * The Baseline Entity Template's top-level regions, in render order.
 *
 * Every entity kind gets these same regions. That is the entire point: a
 * trail, a festival, a restaurant and a resort are wildly different things
 * to *read*, but they are the same thing to *hold* — a name, some prose,
 * some facts, a place, a way to make contact, pictures, and connections to
 * other entities. Specialised templates will later reorder or restyle these
 * regions; none of them should need to invent a new one.
 *
 * `facts` is deliberately the widest. It is where every fine-grained
 * section that isn't one of the named regions lands, which is what stops
 * the catalogue's growth from turning into a growth in page structure.
 */
export type TemplateGroup =
  | "overview"
  | "facts"
  | "hours"
  | "location"
  | "contact"
  | "media"
  | "relationships"
  | "seasonal"
  | "other";

/**
 * What a *kind* of thing is expected to know about itself.
 *
 * Not the same as `entity.kind`, and the difference is load-bearing. Big
 * White is stored as an `Organization` with `organizationType: "resort"` —
 * so a rule keyed on `kind` alone would decide a ski resort owes nobody a
 * winter section, which is exactly backwards. What matters is not the
 * storage class but whether the thing is *somewhere you go* or *someone who
 * serves you*.
 *
 * - `destination` — ground, or an operator of ground. Owes: seasons,
 *   things to do, facilities, somewhere to stay, events.
 * - `venue` — an operator at a destination. A café owes none of those.
 * - `activity` / `event` — thin by nature; they borrow context from what
 *   contains them.
 */
export type EntityProfile = "destination" | "venue" | "activity" | "event";

/** Organization types that are really destinations. Matched on the source's own word, never normalized. */
const DESTINATION_ORGANIZATION =
  /resort|ski area|mountain|park|village|campground|marina|golf/i;

export function entityProfile(entity: Record<string, unknown>): EntityProfile {
  const kind = String(entity.kind);
  if (kind === "Activity") return "activity";
  if (kind === "Event") return "event";
  if (kind === "Place") return "destination";
  const type =
    typeof entity.organizationType === "string" ? entity.organizationType : "";
  return DESTINATION_ORGANIZATION.test(type) ? "destination" : "venue";
}

/** One readable piece of knowledge. The label is the curator's word for it, never a field name. */
export interface KnowledgeItem {
  readonly label: string;
  readonly value: string;
  /** Where this came from, for the provenance drawer. Never shown in the primary view. */
  readonly sourceLabel?: string;
  /** The source's own heading, when it gave one. Preserved verbatim (ADR 017). */
  readonly category?: string;
}

/**
 * One asset, ready to render. Mirrors Atlas's `MediaAsset` rather than
 * flattening it to a URL string: the caption, the thumbnail and the
 * curator's decision are the entire reason the media model exists, and a
 * `string[]` would drop all three on the way to the screen.
 */
export interface MediaItem {
  readonly url: string;
  readonly kind: "image" | "video" | "document";
  readonly thumbnailUrl?: string;
  readonly caption?: string;
  readonly state?: "approved" | "rejected";
  /** True for the asset currently leading the page. Derived, never stored twice. */
  readonly isHero: boolean;
}

export interface KnowledgeSection {
  readonly id: string;
  /** Which Baseline Template region renders this. */
  readonly group: TemplateGroup;
  readonly title: string;
  readonly state: KnowledgeState;
  readonly items: readonly KnowledgeItem[];
  /** Media belongs to a section rather than a separate concept, so a gallery can grow anywhere. */
  readonly media?: readonly MediaItem[];
  /** Shown when `unknown` — what is absent, and the action that would fix it. */
  readonly absence?: { readonly explanation: string; readonly action: string };
  /** Which Passport section surfaces this, when one does. */
  readonly passportSection?: SectionType;
}

/** One rendered region of the Baseline Template. Empty groups are never emitted. */
export interface TemplateRegion {
  readonly id: TemplateGroup;
  readonly title: string;
  readonly sections: readonly KnowledgeSection[];
}

/**
 * What the page leads with. Assembled here rather than in the component so
 * that a specialised template can restyle the hero without re-deriving it.
 */
export interface EntityHero {
  readonly name: string;
  readonly kindLabel: string;
  /** Draft / ready / published, from the Passport composition. */
  readonly status: string;
  readonly image?: MediaItem;
  /** "Part of Big White Ski Resort" — only what contains this, never what it contains. */
  readonly parent?: { readonly id: string; readonly name: string };
}

export interface EntityKnowledgeView {
  readonly id: string;
  readonly name: string;
  readonly kindLabel: string;
  readonly profile: EntityProfile;
  readonly hero: EntityHero;
  /** The Baseline Template's regions, in render order, with empties dropped. */
  readonly regions: readonly TemplateRegion[];
  readonly sections: readonly KnowledgeSection[];
  readonly media: readonly MediaItem[];
  /** How many facts Atlas holds in total — the honest measure of how rich this page is. */
  readonly factCount: number;
  readonly known: number;
  readonly hidden: number;
  readonly unknown: number;
  /** Derived from real absence, never hardcoded. */
  readonly recommendations: readonly {
    readonly title: string;
    readonly why: string;
  }[];
  /** Ingestion metadata — kept, but demoted to a drawer. */
  readonly provenance: readonly {
    readonly sourceType: string;
    readonly url: string;
    readonly retrievedAt: string;
    readonly taughtCount: number;
  }[];
}

/**
 * A connection to another entity, **with the direction it points**.
 *
 * Direction was previously dropped, and the result was a page that read
 * `contains` as "Part of" no matter which end you were standing on — so
 * Big White would have been described as *part of* the restaurant inside
 * it. A relationship without its direction is not a simplification; it is a
 * different, wrong fact.
 */
export interface RelatedEntity {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly relationship: string;
  /** `outgoing` — this entity is the subject. `incoming` — it is the object. */
  readonly direction: "outgoing" | "incoming";
}

export interface KnowledgeInput {
  readonly entity: Record<string, unknown>;
  readonly related: readonly RelatedEntity[];
  readonly sources: readonly {
    id: string;
    sourceType: string;
    url: string;
    retrievedAt: string;
  }[];
  /** Passport section types currently visible, so each row can be marked shown or hidden. */
  readonly visibleSections: readonly SectionType[];
  /** Draft / ready / published, shown in the hero. */
  readonly status?: string;
}

interface KeyFactLike {
  readonly label: string;
  readonly value: string;
  readonly category?: string;
  readonly sourceRecordId?: string;
}

/**
 * The section catalogue.
 *
 * Declarative on purpose: a section is a title, the Passport section it
 * feeds, how to read its values out of Atlas, and what to say when Atlas
 * has nothing. Adding "Winter" or "Trail conditions" later is one entry.
 */
interface SectionSpec {
  readonly id: string;
  readonly title: string;
  /**
   * Which region of the Baseline Template this belongs to.
   *
   * The indirection is what keeps the page stable while the catalogue
   * grows. Adding "Lift tickets" or "Trail conditions" later adds a row
   * inside Key Facts; it does not add a twenty-third heading to the page.
   */
  readonly group: TemplateGroup;
  readonly passportSection?: SectionType;
  readonly absence: { explanation: string; action: string };
  /** Any key fact whose label or category matches is pulled into this section. */
  readonly factPattern?: RegExp;
  readonly read?: (input: KnowledgeInput) => KnowledgeItem[];
  /**
   * Which profiles are *expected* to have this, and therefore where its
   * absence is worth reporting as a gap.
   *
   * Absent means every profile. This exists because widening the catalogue
   * to cover a resort — winter, summer, terrain, lodging, events — would
   * otherwise bury a single café under a dozen gaps that are not really
   * gaps. A restaurant that lists no ski runs is not incomplete.
   *
   * Keyed on `EntityProfile`, not on `entity.kind`, because Big White is
   * stored as an Organization and a kind-keyed rule would decide a ski
   * resort owes nobody a winter section.
   *
   * The rule is one-directional and that matters: a section outside its
   * expected profiles is hidden **only when empty**. If Atlas ever does
   * learn something that lands there, it appears. Nothing Atlas holds is
   * ever unreachable because of this list.
   */
  readonly expectedFor?: readonly EntityProfile[];
}

const SHARED_SECTIONS: readonly SectionSpec[] = [
  {
    id: "overview",
    title: "Overview",
    group: "overview",
    passportSection: "overview",
    absence: {
      explanation:
        "Atlas does not have a description in the source's own words.",
      action: "Learn from the official site",
    },
    read: ({ entity }) => textItem("Description", entity.description),
  },
  {
    id: "hours",
    title: "Hours",
    group: "hours",
    passportSection: "hours",
    absence: {
      explanation: "Atlas does not currently know the opening hours.",
      action: "Research hours",
    },
    read: ({ entity }) => textItem("Open", entity.hours),
    factPattern: /hour|open|season of operation/i,
  },
  {
    id: "contact",
    title: "Contact",
    group: "contact",
    passportSection: "contact",
    absence: {
      explanation: "Atlas has no phone number or official website.",
      action: "Find contact details",
    },
    read: ({ entity }) => [
      ...externalIds(entity)
        .filter((e) => e.system === "first-party-url")
        .map((e) => ({ label: "Official website", value: e.id })),
    ],
    factPattern: /phone|call|email|contact|reservation/i,
  },
  {
    id: "location",
    title: "Location",
    group: "location",
    passportSection: "location",
    absence: {
      explanation: "Atlas does not know where this is.",
      action: "Add a mappable location",
    },
    read: ({ entity }) => [
      ...textItem("Address", entity.address),
      ...(isPoint(entity.geometry)
        ? [
            {
              label: "Coordinates",
              value: formatPoint(entity.geometry as GeometryLike),
            },
          ]
        : []),
    ],
    factPattern: /location|where|address|find/i,
  },
  {
    id: "food",
    title: "Food & drink",
    group: "facts",
    passportSection: "dining",
    absence: {
      explanation: "Atlas does not know what is served here.",
      action: "Research the menu",
    },
    factPattern:
      /breakfast|lunch|dinner|supper|brunch|apr[eé]s|happy hour|menu|dish|food|dining|eat|coffee|caf[eé]|drink|beer|wine|cocktail|bar\b|pub|cuisine|serve/i,
  },
  {
    id: "menus",
    title: "Menus & documents",
    group: "media",
    passportSection: "menu",
    absence: {
      explanation:
        "Atlas holds no menu, brochure or map published by this source.",
      action: "Find published documents",
    },
    // Populated from harvested media of kind `document`, not from facts —
    // a menu PDF is an asset the source published, not a claim it made.
  },
  {
    id: "prices",
    title: "Prices & passes",
    group: "facts",
    absence: {
      explanation: "Atlas does not know what anything here costs.",
      action: "Research prices",
    },
    factPattern:
      /price|cost|\$|fee|rate|pass\b|ticket|admission|rental rate|per (?:day|night|person|hour)/i,
  },
  {
    id: "policies",
    title: "Booking & policies",
    group: "facts",
    absence: {
      explanation: "Atlas does not know how to book, or what the rules are.",
      action: "Research booking and policies",
    },
    factPattern:
      /reservation|booking|book\b|walk-?in|policy|policies|deposit|cancel|dress|pets?\b|age limit|minimum|required/i,
  },
  {
    id: "activities",
    title: "Things to do",
    group: "facts",
    // No Passport section surfaces this yet, so it renders as "held, not
    // shown" — which is the accurate statement. Inventing a section type to
    // make the mark look better would make the page lie about the product.
    absence: {
      explanation: "Atlas does not know what you can do here.",
      action: "Research activities",
    },
    expectedFor: ["destination"],
    read: ({ entity }) => listItems("Activity", entity.activities),
    factPattern:
      /activit|trail|run\b|runs\b|lift|gondola|chair\b|terrain|slope|piste|bike|hike|climb|tour|lesson|rental|park\b/i,
  },
  {
    id: "facilities",
    title: "Facilities",
    group: "facts",
    absence: {
      explanation: "Atlas does not know what facilities are here.",
      action: "Research facilities",
    },
    expectedFor: ["destination"],
    read: ({ entity }) => listItems("Facility", entity.facilities),
    factPattern:
      /facilit|washroom|toilet|shower|locker|wifi|amenity|amenities/i,
  },
  {
    id: "accommodation",
    title: "Staying here",
    group: "facts",
    absence: {
      explanation: "Atlas does not know where you can stay.",
      action: "Research accommodation",
    },
    expectedFor: ["destination"],
    factPattern:
      /accommodat|lodging|hotel|condo|chalet|cabin|suite|room\b|rooms\b|stay\b|rental home|vacation rental|hostel|lodge/i,
  },
  {
    id: "events",
    title: "Events",
    group: "facts",
    absence: {
      explanation: "Atlas knows of no events here.",
      action: "Research events",
    },
    expectedFor: ["destination"],
    factPattern:
      /event|festival|concert|race|competition|celebration|fireworks|weekly|annual/i,
  },
  {
    id: "relationships",
    title: "Connections",
    group: "relationships",
    passportSection: "nearby",
    absence: {
      explanation: "Atlas has not connected this to anything yet.",
      action: "Discover what's nearby",
    },
    read: ({ related }) =>
      related.map((r) => ({
        label: relationshipLabel(r.relationship, r.direction),
        value: r.name,
      })),
  },
  {
    id: "media",
    title: "Images",
    group: "media",
    passportSection: "gallery",
    absence: {
      explanation: "Atlas has no photograph of this.",
      action: "Find images",
    },
  },
  {
    id: "accessibility",
    title: "Accessibility",
    group: "facts",
    passportSection: "accessibility",
    absence: {
      explanation: "Atlas knows nothing about accessibility here.",
      action: "Research accessibility",
    },
    // Widened to match what the Accessibility research profile actually
    // asks a source for. The two are the same vocabulary and drifting
    // apart has a specific, visible cost: a mission could learn "Ramp at
    // the main entrance", merge it correctly, and the gap it was sent to
    // close would still read as unknown — the fact would land in "Other
    // knowledge" instead. Nothing would be lost, but the loop would not
    // visibly close, which is the whole point of the feature.
    //
    // `lift` is deliberately absent: at a ski resort it means a chairlift.
    // `elevator` says the thing without the collision.
    factPattern:
      /accessib|wheelchair|step-free|step free|barrier-free|mobility|ramp|elevator|handrail|service animal|guide dog|braille|hearing loop|audio description|sensory|adaptive|companion/i,
  },
  {
    id: "getting-there",
    title: "Getting there & parking",
    group: "facts",
    absence: {
      explanation: "Atlas does not know how to get here or where to park.",
      action: "Research access",
    },
    factPattern:
      /parking|park your|shuttle|transit|bus\b|drive|driving|transport|airport|highway|road\b|turn (?:right|left)|reach/i,
  },
  {
    id: "family",
    title: "Family",
    group: "facts",
    absence: {
      explanation: "Atlas does not know whether this suits families.",
      action: "Research family suitability",
    },
    factPattern: /family|families|kid|child|children|young|all ages/i,
  },
  // Winter and summer are separate on purpose. A destination that operates
  // in both is really two products a traveller chooses between, and
  // collapsing them into one "Seasonal" row is what made Big White read as
  // a single flat record. Expected only for Places: a café does not owe
  // anyone a winter programme.
  {
    id: "winter",
    title: "Winter",
    group: "seasonal",
    absence: {
      explanation: "Atlas does not know what happens here in winter.",
      action: "Research winter",
    },
    expectedFor: ["destination"],
    factPattern:
      /winter|ski|skiing|snowboard|snow\b|powder|nordic|snowshoe|tubing|night skiing|alpine|vertical|glade/i,
  },
  {
    id: "summer",
    title: "Summer",
    group: "seasonal",
    absence: {
      explanation: "Atlas does not know what happens here in summer.",
      action: "Research summer",
    },
    expectedFor: ["destination"],
    factPattern:
      /summer|mountain bik|downhill bik|hiking|hike|patio|scenic (?:lift|chair)|disc golf|golf\b/i,
  },
  {
    id: "seasonal",
    title: "Other seasonal knowledge",
    group: "seasonal",
    absence: {
      explanation: "Atlas does not know how this changes through the year.",
      action: "Research seasonal operation",
    },
    factPattern:
      /season|spring|fall|autumn|shoulder|year-round|open from|closed from/i,
  },
  {
    id: "history",
    title: "History & story",
    group: "facts",
    absence: {
      explanation: "Atlas knows nothing of the story behind this.",
      action: "Research history",
    },
    factPattern: /histor|founded|since|origin|story|heritage/i,
  },
  {
    id: "local-tips",
    title: "Local tips",
    group: "facts",
    absence: {
      explanation:
        "Atlas has no local knowledge here — this needs repeated independent observation, not one source.",
      action: "Not yet possible (needs Signals)",
    },
    factPattern: /tip|local|secret|best time|insider/i,
  },
];

export function buildEntityKnowledgeView(
  input: KnowledgeInput,
): EntityKnowledgeView {
  const { entity, sources, visibleSections } = input;
  const facts = (entity.keyFacts as KeyFactLike[] | undefined) ?? [];
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  // Facts land in the first section whose pattern matches. Anything matching
  // nothing becomes "Other knowledge" rather than disappearing — a fact Atlas
  // holds must always be reachable, even when no template anticipated it.
  const claimed = new Set<KeyFactLike>();

  const media = collectMedia(entity);
  const pictures = media.filter((m) => m.kind !== "document");
  const documents = media.filter((m) => m.kind === "document");
  const profile = entityProfile(entity);

  const built: (KnowledgeSection | null)[] = SHARED_SECTIONS.map((spec) => {
    const read = spec.read?.(input) ?? [];
    const matched = spec.factPattern
      ? facts.filter(
          (f) =>
            !claimed.has(f) &&
            spec.factPattern!.test(`${f.label} ${f.category ?? ""} ${f.value}`),
        )
      : [];
    matched.forEach((f) => claimed.add(f));

    const items: KnowledgeItem[] = [
      ...read,
      ...matched.map((f) => ({
        label: f.label,
        value: f.value,
        category: f.category,
        sourceLabel: f.sourceRecordId
          ? sourceById.get(f.sourceRecordId)?.sourceType
          : undefined,
      })),
    ];

    // Media is routed by what it *is*, not by what a fact says. Photographs
    // fill the gallery; menus, maps and brochures are documents and belong
    // with the things a traveller opens rather than looks at.
    const sectionMedia =
      spec.id === "media"
        ? pictures
        : spec.id === "menus"
          ? documents
          : undefined;
    const hasContent = items.length > 0 || (sectionMedia?.length ?? 0) > 0;

    // A gap only counts as a gap where it is expected. See `expectedFor` —
    // and note the asymmetry: content always shows, absence is filtered.
    if (!hasContent && spec.expectedFor && !spec.expectedFor.includes(profile))
      return null;

    return {
      id: spec.id,
      group: spec.group,
      title: spec.title,
      state: !hasContent
        ? "unknown"
        : spec.passportSection && visibleSections.includes(spec.passportSection)
          ? "shown"
          : "hidden",
      items,
      media: sectionMedia,
      absence: hasContent ? undefined : spec.absence,
      passportSection: spec.passportSection,
    };
  });

  const sections: KnowledgeSection[] = built.filter(
    (s): s is KnowledgeSection => s !== null,
  );

  // Everything Atlas holds that no template expected. Never dropped.
  //
  // This is the rule the whole Baseline Template is built around: no
  // knowledge Atlas holds may become invisible because we have not yet
  // invented a content type for it. A section can be hidden from Passport;
  // it can never be hidden from the curator.
  const leftovers = facts.filter((f) => !claimed.has(f));
  if (leftovers.length > 0) {
    sections.push({
      id: "other",
      group: "other",
      title: "Other knowledge",
      state: "hidden",
      items: leftovers.map((f) => ({
        label: f.label,
        value: f.value,
        category: f.category,
        sourceLabel: f.sourceRecordId
          ? sourceById.get(f.sourceRecordId)?.sourceType
          : undefined,
      })),
    });
  }

  const unknownSections = sections.filter((s) => s.state === "unknown");

  // --- Assemble the template's regions -------------------------------------
  //
  // Only sections that actually hold something. Absences are collected once,
  // into Missing Knowledge, rather than scattered through every region —
  // otherwise a thin entity renders as nine headings of "nothing here",
  // which is noise pretending to be structure.
  const regions: TemplateRegion[] = REGION_ORDER.map(([id, title]) => ({
    id,
    title,
    sections: sections.filter((s) => s.group === id && s.state !== "unknown"),
  })).filter((region) => region.sections.length > 0);

  const parent = input.related.find(
    (r) => r.relationship === "contains" && r.direction === "incoming",
  );

  return {
    id: String(entity.id),
    name: String(entity.name),
    kindLabel: kindLabel(entity),
    profile,
    hero: {
      name: String(entity.name),
      kindLabel: kindLabel(entity),
      status: input.status ?? "draft",
      image:
        media.find((m) => m.isHero && m.kind === "image") ??
        media.find((m) => m.kind === "image"),
      parent: parent ? { id: parent.id, name: parent.name } : undefined,
    },
    regions,
    sections,
    media,
    factCount: facts.length,
    known: sections.filter((s) => s.state !== "unknown").length,
    hidden: sections.filter((s) => s.state === "hidden").length,
    unknown: unknownSections.length,
    // Derived from real absence — never a hardcoded list.
    recommendations: unknownSections.map((s) => ({
      title: s.absence!.action,
      why: s.absence!.explanation,
    })),
    provenance: sources.map((s) => ({
      sourceType: s.sourceType,
      url: s.url,
      retrievedAt: s.retrievedAt,
      taughtCount: facts.filter((f) => f.sourceRecordId === s.id).length,
    })),
  };
}

interface MediaAssetLike {
  readonly url?: unknown;
  readonly kind?: unknown;
  readonly thumbnailUrl?: unknown;
  readonly caption?: unknown;
  readonly state?: unknown;
}

/**
 * Everything Atlas holds, in the order the source published it.
 *
 * Reads `entity.media` — the real list — and falls back to the legacy
 * `imageUrl` scalar for entities ingested before the media model existed,
 * so a page never goes blank while the corpus catches up. That fallback is
 * temporary by design and will simply stop firing as entities are
 * re-ingested; it is not a second source of truth.
 *
 * A rejected asset is **kept and marked**, not filtered. The curator needs
 * to see that a decision was made — an asset that silently vanishes looks
 * identical to one that was never found, and those mean opposite things.
 */
function collectMedia(entity: Record<string, unknown>): MediaItem[] {
  const raw = Array.isArray(entity.media)
    ? (entity.media as MediaAssetLike[])
    : [];
  const heroUrl =
    typeof entity.imageUrl === "string" ? entity.imageUrl : undefined;

  const items: MediaItem[] = raw
    .filter(
      (m): m is MediaAssetLike & { url: string } =>
        typeof m?.url === "string" && m.url.length > 0,
    )
    .map((m) => ({
      url: m.url,
      kind: m.kind === "video" || m.kind === "document" ? m.kind : "image",
      thumbnailUrl:
        typeof m.thumbnailUrl === "string" ? m.thumbnailUrl : undefined,
      caption:
        typeof m.caption === "string" && m.caption.trim()
          ? m.caption.trim()
          : undefined,
      state:
        m.state === "approved" || m.state === "rejected" ? m.state : undefined,
      isHero: m.url === heroUrl,
    }));

  // Pre-media entities: the scalar is all there is, and one image is still
  // better than an empty gallery.
  if (items.length === 0 && heroUrl) {
    return [{ url: heroUrl, kind: "image", isHero: true }];
  }
  return items;
}

type GeometryLike = { type?: string; coordinates?: unknown };

function isPoint(geometry: unknown): boolean {
  const g = geometry as GeometryLike | undefined;
  return (
    g?.type === "Point" &&
    Array.isArray(g.coordinates) &&
    g.coordinates.length === 2
  );
}

function formatPoint(geometry: GeometryLike): string {
  const [lon, lat] = geometry.coordinates as [number, number];
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/** A string list Atlas holds — activities, facilities — as one row each. */
function listItems(label: string, value: unknown): KnowledgeItem[] {
  return Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === "string")
        .map((v) => ({ label, value: v }))
    : [];
}

function textItem(label: string, value: unknown): KnowledgeItem[] {
  return typeof value === "string" && value.trim().length > 0
    ? [{ label, value }]
    : [];
}

function externalIds(
  entity: Record<string, unknown>,
): { system: string; id: string }[] {
  return (
    (entity.externalIds as { system: string; id: string }[] | undefined) ?? []
  );
}

function kindLabel(entity: Record<string, unknown>): string {
  const org = entity.organizationType;
  if (typeof org === "string" && org && org !== "unknown") return org;
  const place = entity.placeType;
  if (typeof place === "string" && place) return place;
  return String(entity.kind);
}

/**
 * Relationships read as sentences, not as edge types — and **the sentence
 * depends on which end you are standing on**.
 *
 * `contains` used to render as "Part of" unconditionally. On The
 * BullWheel's page that is right; on Big White's page it would have
 * announced that the resort is part of the restaurant inside it. Dropping
 * direction does not simplify a relationship, it inverts half of them.
 */
function relationshipLabel(
  type: string,
  direction: "outgoing" | "incoming",
): string {
  const labels: Record<string, readonly [outgoing: string, incoming: string]> =
    {
      contains: ["Contains", "Part of"],
      operates: ["Operates", "Operated by"],
      near: ["Nearby", "Nearby"],
      describes: ["Describes", "Described by"],
    };
  const pair = labels[type];
  return pair ? pair[direction === "outgoing" ? 0 : 1] : type;
}

/**
 * The Baseline Template's regions, in the order every entity renders them.
 *
 * Ordered the way a curator reads an entity: what it is, what it's like,
 * what's true about it, when and where, how to reach it, what it looks
 * like, what it connects to, how it changes — then everything that fits
 * nowhere yet. `other` is last on purpose and is never dropped.
 */
const REGION_ORDER: readonly (readonly [TemplateGroup, string])[] = [
  ["overview", "Overview"],
  ["facts", "Key facts"],
  ["hours", "Hours & availability"],
  ["location", "Location"],
  ["contact", "Contact"],
  ["media", "Media"],
  ["relationships", "Relationships"],
  ["seasonal", "Seasonal"],
  ["other", "Other knowledge"],
];

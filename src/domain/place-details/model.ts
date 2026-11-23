/**
 * **One place page, for every place Go Have a Day shows** (owner brief M1041,
 * "Shared place details overhaul", 2026-11-23).
 *
 * The brief: _Atlas provides intelligence; Go Have a Day provides the
 * experience_, and one excellent details page serves every place — a pub
 * Passport features, a sports bar Atlas read from its website, a lake park —
 * with themes adding to it rather than building their own.
 *
 * This is the shape that page is drawn from. It holds no fact of its own:
 * every value is carried from an Atlas read (`fromComposed.ts`) or from the
 * sourced editorial facts a local favourite keeps until Atlas holds them
 * (`withFavourite.ts`). The page decides layout; the adapters decide nothing
 * Atlas did not say.
 *
 * ## Why a model and not more props
 *
 * Three pages drew places three ways: `/places/[id]` (Atlas Place reads),
 * `/passport/[id]` (Organization reads, as a list of facts) and
 * `/favourites/[slug]` (a hand-made card). Each improvement landed on one of
 * them. Drawing all of them from one shape is what makes the next
 * improvement land on every place at once.
 */

export interface PlacePhoto {
  readonly url: string;
  /** What the picture shows. */
  readonly alt: string;
  /** Said under the picture, where the source asks for credit. */
  readonly credit?: string;
}

/** One line of what a visitor can expect. `label` is the publisher's own. */
export interface PlaceFactLine {
  readonly label?: string;
  readonly text: string;
}

/**
 * The visitor's sections, in the order a person deciding whether to go asks
 * them. `about` is what fits nowhere else; it is still shown.
 */
export const SECTION_ORDER = [
  "food-drink",
  "activities",
  "amenities",
  "menus",
  "visitor",
  "about",
] as const;

export type PlaceSectionId = (typeof SECTION_ORDER)[number];

export const SECTION_TITLES: Record<PlaceSectionId, string> = {
  "food-drink": "Food & drink",
  activities: "Things to do",
  amenities: "Amenities",
  menus: "Menus",
  visitor: "Good to know before you go",
  about: "More about it",
};

export interface PlaceInfoSection {
  readonly id: PlaceSectionId;
  readonly title: string;
  readonly lines: readonly PlaceFactLine[];
  /**
   * Longer passages, already shortened to their opening sentences
   * (`summarise`). The full text is only ever in Sources & accuracy: a page
   * read from a website is evidence, not the visitor's experience.
   */
  readonly passages: readonly string[];
}

/** A link inside Go Have a Day: another place, a thing on here, an experience. */
export interface PlaceLink {
  readonly href: string;
  readonly title: string;
  readonly line?: string;
  readonly eyebrow?: string;
  readonly image?: { readonly url: string; readonly alt: string };
}

/** Where something on the page came from. */
export interface PlaceSourceNote {
  /** What it supports, e.g. "Address"; absent for a general source. */
  readonly label?: string;
  readonly url?: string;
  /** The site, as a person reads it: `longjohnspub.com`. */
  readonly site?: string;
  /** `YYYY-MM-DD` the source was read. */
  readonly checked?: string;
  /** The source's own words, verbatim. */
  readonly quote?: string;
}

export interface PlaceHours {
  /** Lines the source stated, as stated. Never derived. */
  readonly lines: readonly string[];
  /** Why the hours are not stated as fact, said plainly. */
  readonly note?: string;
  /** Whether the lines are confirmed or only what one source published. */
  readonly confirmed: boolean;
}

export interface PlaceDetailsModel {
  /** The Atlas id: what is saved, and what a day is built around. */
  readonly id: string;
  readonly name: string;
  /** "Pub", "Sports bar", "Lake park". */
  readonly kindLabel?: string;
  /** Where, in a person's words: "Main Street, SilverStar village". */
  readonly locality?: string;
  /** Why it is here, where that is editorial: "Local favourite · our pick". */
  readonly badge?: string;
  /** One line worth reading first. */
  readonly tagline?: string;
  readonly description?: string;
  /** Short tags: "Après", "Lake-view patio". */
  readonly goodFor: readonly string[];
  readonly photos: readonly PlacePhoto[];
  readonly hours?: PlaceHours;
  readonly address?: string;
  readonly point?: { readonly latitude: number; readonly longitude: number };
  /** E.164 where known (`+12505492992`), else as published. */
  readonly phone?: string;
  /** The business's own site: an information source, not the destination. */
  readonly website?: string;
  /** Other links the publisher published (book a table, a menu PDF). */
  readonly links: readonly { readonly label: string; readonly href: string }[];
  readonly social: readonly { readonly label: string; readonly url: string }[];
  readonly sections: readonly PlaceInfoSection[];
  /** Things Atlas says happen or are offered here. */
  readonly whatsOn: readonly PlaceLink[];
  /** What it is part of, who runs it, where it is hosted. */
  readonly partOf: readonly PlaceLink[];
  /** Experiences inside Go Have a Day it pairs with. */
  readonly pairsWith: readonly PlaceLink[];
  /** Other places close by, from the same corpus Discovery shows. */
  readonly nearby: readonly PlaceLink[];
  readonly sources: readonly PlaceSourceNote[];
  /** Long passages read from a page, in full, for Sources & accuracy. */
  readonly readFromSources: readonly PlaceFactLine[];
  /** Facts left out because they only restate what the page already says. */
  readonly withheld: number;
  /** The raw Atlas record, for whoever wants to check it. */
  readonly atlasHref?: string;
}

/** The phone's map app, to a point if one is stated, else to an address. */
export function directionsHref(model: PlaceDetailsModel): string | undefined {
  const base = "https://www.google.com/maps/dir/?api=1&destination=";
  if (model.point)
    return `${base}${model.point.latitude},${model.point.longitude}`;
  if (model.address)
    return `${base}${encodeURIComponent(`${model.name}, ${model.address}`)}`;
  return undefined;
}

/** Into the Day Builder with this place chosen — the same door Discovery uses. */
export const addToDayHref = (id: string) =>
  `/go?with=${encodeURIComponent(id)}`;

/** A dialable `tel:` link, from whatever digits were published. */
export function callHref(phone: string | undefined): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 7) return undefined;
  return `tel:${digits}`;
}

/** `+12505492992` → `(250) 549-2992`; anything else as published. */
export function phoneDisplay(phone: string): string {
  const d = phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return d.length === 10
    ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    : phone;
}

/** `https://www.longjohnspub.com/x` → `longjohnspub.com`. */
export function siteOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/**
 * **The opening of a passage, never a rewrite of it.** Whole sentences, in
 * the source's words, up to about `max` characters; a passage with no
 * sentence break that short is cut at a word and marked with an ellipsis.
 */
export function summarise(text: string, max = 260): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [];
  let out = "";
  for (const s of sentences) {
    if ((out + s).trim().length > max) break;
    out += s;
  }
  if (out.trim()) return out.trim();
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max).trim()}…`;
}

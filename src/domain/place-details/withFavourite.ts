import {
  FAVOURITE_LABEL,
  type LocalFavourite,
  type Sourced,
} from "@/domain/featured/locals";
import { placeOfFact } from "./classify";
import {
  SECTION_ORDER,
  SECTION_TITLES,
  siteOf,
  type PlaceDetailsModel,
  type PlaceSectionId,
  type PlaceSourceNote,
} from "./model";

/**
 * **A local favourite is a place page with an editor's note**, not a page of
 * its own (owner brief M1041: _do not build three custom pages_).
 *
 * The Atlas record stays the record (doctrine §12, _Local favourites_). What
 * the favourite adds is what `locals.ts` keeps until Atlas holds it — the
 * location, phone, photos, published hours, each quoted with its page and
 * day — plus the editorial line, the label that says it is our pick, and the
 * experiences it pairs with. Where Atlas states a fact, Atlas's stands; the
 * favourite fills only what Atlas left empty, and its sources are listed
 * beside Atlas's.
 *
 * `atlas` may be absent: when Atlas cannot be reached the page is still the
 * favourite's sourced facts, said as such, rather than an error.
 */
export function withFavourite(
  atlas: PlaceDetailsModel | undefined,
  f: LocalFavourite,
): PlaceDetailsModel {
  const base: PlaceDetailsModel = atlas ?? {
    id: f.atlasId,
    name: f.name,
    goodFor: [],
    photos: [],
    links: [],
    social: [],
    sections: [],
    whatsOn: [],
    partOf: [],
    pairsWith: [],
    nearby: [],
    sources: [],
    readFromSources: [],
    withheld: 0,
  };

  const note = (label: string, fact: Sourced<unknown>): PlaceSourceNote => ({
    label,
    url: fact.source,
    ...(siteOf(fact.source) ? { site: siteOf(fact.source) } : {}),
    checked: fact.checked,
    quote: fact.quote,
  });

  // Atlas's description stays where it says something the business's own
  // words do not; a one-line Atlas summary under a fuller quote is a repeat.
  const atlasLine = atlas?.description?.trim();
  const sections =
    atlasLine && atlasLine !== f.said.value
      ? addLine(base.sections, atlasLine, sectionOf(atlasLine))
      : base.sections;

  return {
    ...base,
    // The name as the business writes it: "Long John's", not "Long Johns".
    name: f.name,
    kindLabel: base.kindLabel ?? f.kind,
    locality: f.place,
    badge: FAVOURITE_LABEL,
    tagline: f.line,
    description: f.said.value,
    goodFor: [...new Set([...f.goodFor, ...base.goodFor])],
    photos: f.photos.length > 0 ? f.photos : base.photos,
    hours: base.hours ?? {
      confirmed: f.hours.confirmed,
      lines: f.hours.confirmed
        ? [f.hours.value.value]
        : f.hours.published
          ? [f.hours.published.value]
          : [],
      ...(f.hours.confirmed ? {} : { note: f.hours.why }),
    },
    address: base.address ?? f.address.value,
    point: base.point ?? f.at.value,
    ...(base.phone || f.phone ? { phone: base.phone ?? f.phone!.value } : {}),
    ...(base.website || f.website
      ? { website: base.website ?? f.website!.value }
      : {}),
    social: base.social.length > 0 ? base.social : f.social,
    sections,
    pairsWith: [
      ...f.pairsWith.map((p) => ({
        href: p.href,
        title: p.label,
        line: p.line,
      })),
      ...base.pairsWith,
    ],
    sources: [
      note("In their words", f.said),
      note("Address", f.address),
      note("Map point", f.at),
      ...(f.phone ? [note("Phone", f.phone)] : []),
      ...(f.website ? [note("Website", f.website)] : []),
      ...(f.hours.confirmed
        ? [note("Hours", f.hours.value)]
        : f.hours.published
          ? [note("Hours, as published", f.hours.published)]
          : []),
      ...base.sources,
    ],
    atlasHref:
      base.atlasHref ?? `/passport/${f.atlasId}?kind=Organization&atlas=1`,
  };
}

function sectionOf(text: string): PlaceSectionId {
  const place = placeOfFact({ value: text });
  return place === "hours" || place === "phone" || place === "website"
    ? "about"
    : place;
}

function addLine(
  sections: PlaceDetailsModel["sections"],
  text: string,
  id: PlaceSectionId,
): PlaceDetailsModel["sections"] {
  if (sections.some((s) => s.id === id))
    return sections.map((s) =>
      s.id === id ? { ...s, lines: [{ text }, ...s.lines] } : s,
    );
  const added = [
    ...sections,
    { id, title: SECTION_TITLES[id], lines: [{ text }], passages: [] },
  ];
  return SECTION_ORDER.flatMap((o) => added.filter((s) => s.id === o));
}

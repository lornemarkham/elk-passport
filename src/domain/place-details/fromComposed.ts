import type { SubjectPageView, SubjectView } from "@/lib/passport/subjectPage";
import { formatStatedDay } from "@/lib/passport/subjectPage";
import {
  actionsFor,
  composedFactSections,
  whereLine,
  type FactGroup,
} from "@/domain/passport/detailComposition";
import { placeOfFact, phoneIn } from "./classify";
import {
  SECTION_ORDER,
  SECTION_TITLES,
  siteOf,
  summarise,
  type PlaceDetailsModel,
  type PlaceFactLine,
  type PlaceInfoSection,
  type PlaceLink,
  type PlaceSectionId,
} from "./model";

/**
 * **An Atlas composed read, as a place page** (`GET /organizations/:id/detail`
 * and its siblings, through `subjectPageView`).
 *
 * The facts are the ones `composedFactSections` already keeps — a fact that
 * only restates the page's name, place or description is left out and
 * counted (`withheld`) — and each is moved under the heading a visitor looks
 * for (`placeOfFact`). A long passage read from a page is shortened to its
 * opening sentences on the page and kept in full under Sources & accuracy.
 * Nothing is added.
 */
export function placeDetailsFromComposed(
  view: SubjectPageView,
): PlaceDetailsModel {
  const { subject } = view;
  const actions = actionsFor(view);
  const { sections: factSections, hidden } = composedFactSections(
    view,
    actions,
  );

  const lines = new Map<PlaceSectionId, PlaceFactLine[]>();
  const passages = new Map<PlaceSectionId, string[]>();
  const hours: string[] = [];
  const readFromSources: PlaceFactLine[] = [];
  let phone: string | undefined;
  let website: string | undefined;

  const sort = (
    group: FactGroup,
    title: string | undefined,
    prose: boolean,
  ) => {
    for (const value of group.values) {
      const place = placeOfFact({
        label: group.label,
        ...(title ? { category: title } : {}),
        value,
      });
      if (place === "phone" && phoneIn(value)) {
        phone ??= phoneIn(value);
        continue;
      }
      if (place === "website" && /^https?:\/\//.test(value.trim())) {
        website ??= value.trim();
        continue;
      }
      if (place === "hours" && !prose) {
        hours.push(
          labelWorthKeeping(group.label) ? `${group.label}: ${value}` : value,
        );
        continue;
      }
      const section: PlaceSectionId =
        place === "hours" || place === "phone" || place === "website"
          ? "visitor"
          : place;
      if (prose) {
        readFromSources.push({ label: group.label, text: value });
        passages.set(section, [
          ...(passages.get(section) ?? []),
          summarise(value),
        ]);
      } else {
        lines.set(section, [
          ...(lines.get(section) ?? []),
          labelWorthKeeping(group.label) && !restatesTitle(group.label, section)
            ? { label: group.label, text: value }
            : { text: value },
        ]);
      }
    }
  };
  for (const section of factSections) {
    for (const group of section.details) sort(group, section.title, false);
    for (const group of section.prose) sort(group, section.title, true);
  }

  const sections: PlaceInfoSection[] = SECTION_ORDER.flatMap((id) => {
    const l = lines.get(id) ?? [];
    const p = passages.get(id) ?? [];
    return l.length + p.length > 0
      ? [{ id, title: SECTION_TITLES[id], lines: l, passages: p }]
      : [];
  });

  const official = actions.find((a) => a.kind === "official")?.href;
  const links = actions
    .filter((a) => a.kind === "tickets")
    .map((a) => ({ label: a.label, href: a.href }));

  const description = subject.description.trim();
  const point = subject.coordinates
    ? { latitude: subject.coordinates[1], longitude: subject.coordinates[0] }
    : view.venue?.coordinates
      ? {
          latitude: view.venue.coordinates[1],
          longitude: view.venue.coordinates[0],
        }
      : undefined;
  const address = whereLine(view);

  return {
    id: subject.id,
    name: subject.name,
    ...(kindLabel(subject) ? { kindLabel: kindLabel(subject) } : {}),
    ...(address ? { address, locality: address } : {}),
    ...(description
      ? description.length > 420
        ? {
            description: summarise(description, 420),
          }
        : { description }
      : {}),
    goodFor: [],
    photos: subject.imageUrl
      ? [{ url: subject.imageUrl, alt: subject.name }]
      : [],
    ...(hours.length > 0 ? { hours: { lines: hours, confirmed: true } } : {}),
    ...(point ? { point } : {}),
    ...(phone ? { phone } : {}),
    ...(website || official ? { website: website ?? official } : {}),
    links,
    social: [],
    sections,
    whatsOn: view.offerings
      .flatMap((o) => [subjectLink(o.subject), ...o.parts.map(subjectLink)])
      .concat(view.parts.map(subjectLink)),
    partOf: [view.partOf, view.offeredBy, view.venue]
      .filter((s): s is SubjectView => s !== undefined && s.id !== subject.id)
      .filter((s, i, all) => all.findIndex((t) => t.id === s.id) === i)
      .map((s) => ({ href: `/passport/${s.id}`, title: s.name })),
    pairsWith: [],
    nearby: [],
    sources: view.sources.map((s) => ({
      url: s.url,
      ...(siteOf(s.url) ? { site: siteOf(s.url) } : {}),
      ...(s.retrievedAt ? { checked: s.retrievedAt.slice(0, 10) } : {}),
      ...(s.sourceType ? { label: sourceKind(s.sourceType) } : {}),
    })),
    readFromSources:
      description.length > 420
        ? [{ label: "Description", text: description }, ...readFromSources]
        : readFromSources,
    withheld: hidden.length,
    atlasHref: `/passport/${subject.id}?kind=${encodeURIComponent(subject.kind)}&atlas=1`,
  };
}

/** "Organization" says nothing to a visitor; Atlas's subtype usually does. */
function kindLabel(subject: SubjectView): string | undefined {
  const sub = subject.subtype?.trim();
  if (sub && sub.toLowerCase() !== "unknown")
    return sub.charAt(0).toUpperCase() + sub.slice(1);
  return subject.kind === "Organization" ? undefined : subject.kind;
}

function subjectLink(s: SubjectView): PlaceLink {
  const first = s.days[0];
  const last = s.days[s.days.length - 1];
  const when = first
    ? first === last
      ? formatStatedDay(first)
      : `${formatStatedDay(first)} – ${formatStatedDay(last!)}`
    : undefined;
  return {
    href: `/passport/${s.id}`,
    title: s.name,
    ...(when ? { eyebrow: when } : {}),
    ...(s.description ? { line: summarise(s.description, 140) } : {}),
    ...(s.imageUrl ? { image: { url: s.imageUrl, alt: s.name } } : {}),
  };
}

/** A label adds something only when it is not a generic word. */
function labelWorthKeeping(label: string): boolean {
  return !/^(info|information|details?|description|notes?|other|general|about)$/i.test(
    label.trim(),
  );
}

/** "Food" under "Food & drink" says nothing twice. */
function restatesTitle(label: string, section: PlaceSectionId): boolean {
  const l = label.trim().toLowerCase();
  return SECTION_TITLES[section].toLowerCase().includes(l);
}

const SOURCE_KINDS: Record<string, string> = {
  "official-website": "The business's own website",
  osm: "OpenStreetMap",
  wikipedia: "Wikipedia",
  bcparks: "BC Parks",
  destinationbc: "Destination BC",
};

function sourceKind(sourceType: string): string {
  return (
    SOURCE_KINDS[sourceType] ??
    sourceType.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

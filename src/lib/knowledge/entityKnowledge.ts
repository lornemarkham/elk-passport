import type { AdminEntity } from "@/lib/data/admin-repo";
import type { Relationship, SourceRecord } from "@/lib/data/explorer-repo";
import { fieldUsage, keyFactUsage, type FieldUsage } from "./passportUsage";

/**
 * The Entity Workspace's read-model: turns Atlas's raw admin payloads
 * (entity + source records + relationships) into *knowledge*, grouped the
 * way the sources themselves grouped it, with provenance and a Passport
 * usage state on every item.
 *
 * **Deliberately built in `app/`, composing existing admin endpoints,
 * rather than as a new Atlas service.** Three reasons, in order:
 *
 *  1. It needs `passportUsage.ts`, which Atlas must never know about.
 *  2. Everything it reads is already exposed (`/admin/entities`,
 *     `/admin/source-records`, `/admin/relationships`) — a new Atlas
 *     endpoint would be a second path to the same data.
 *  3. It's a view, not domain knowledge. Nothing here is persisted, and
 *     re-deriving it on every request is what keeps it from drifting
 *     (the same "compute fresh, never store a second copy" discipline
 *     `ContentHealthService` and `computeSourceCoverage` already follow).
 *
 * Pure and synchronous — callers fetch once and pass everything in.
 */

/** Where a piece of knowledge came from. Mirrors the four-way model in the design proposal §G. */
export type ProvenanceOrigin =
  "sourced" | "derived" | "ai" | "human" | "unknown";

/** Whether Passport currently surfaces this knowledge to a traveler. */
export type UsageState = "used" | "known";

export interface KnowledgeProvenance {
  readonly origin: ProvenanceOrigin;
  readonly sourceRecordId?: string;
  readonly sourceType?: string;
  /** The source's own URL/identifier, e.g. the Wikipedia article URL. */
  readonly source?: string;
  readonly retrievedAt?: string;
  readonly confidence?: number;
  /**
   * Whether this value can be found in the raw content of at least one
   * source that describes this entity. `false` is the fabrication signal —
   * see `checkSupport` below for exactly what it does and does not prove.
   */
  readonly supported: boolean;
  /** A short window of the source text around the match, for the evidence drawer. Absent when unsupported. */
  readonly excerpt?: string;
  /** For list-valued knowledge: how much of the list was actually found, when not all of it was. */
  readonly partialSupportNote?: string;
}

export interface KnowledgeItem {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** `field` = a typed entity field; `keyFact` = an ADR 017 attributed fact; `externalId` = a registry identifier. */
  readonly kind: "field" | "keyFact" | "externalId";
  /** The underlying entity field name, for `field` items — what `passportUsage` keys on. */
  readonly fieldName?: string;
  readonly usage: UsageState;
  readonly usageDetail: FieldUsage;
  readonly provenance: KnowledgeProvenance;
}

export interface KnowledgeGroup {
  readonly key: string;
  readonly label: string;
  /** How this grouping was arrived at — shown in the UI so a curator knows whether the structure is the source's or Atlas's. */
  readonly groupedBy: "source-category" | "source" | "core";
  /** Which source types contributed to this group — so "the official website taught Atlas this" is legible at a glance, not inferred. */
  readonly sourceTypes: readonly string[];
  readonly items: readonly KnowledgeItem[];
}

export interface SourceContribution {
  readonly id: string;
  readonly sourceType: string;
  readonly source: string;
  readonly retrievedAt: string;
  readonly rawContentLength: number;
  /** Section headings the loader preserved from the source (`Section:` markers, ADR 017's second amendment). */
  readonly sections: readonly string[];
  /** Knowledge items attributable to this source. */
  readonly contributedLabels: readonly string[];
  /**
   * A crude, honest richness signal: how many characters of source text
   * exist per piece of structured knowledge extracted from it. High values
   * suggest the source said far more than Atlas recorded — the
   * "Silent Schema Underutilization" pattern. It is a *prompt to look*,
   * never a measurement of what was missed; the AI action answers that.
   */
  readonly charsPerContribution: number | null;
}

export interface RelationshipView {
  readonly id: string;
  readonly type: string;
  /** Reads as a sentence in the entity's own direction, e.g. "Telus Park **contains** Big White Ski Resort". */
  readonly statement: string;
  readonly direction: "outgoing" | "incoming";
  readonly otherId: string;
  readonly otherName: string;
  readonly otherKind: string;
  /** True when this entity is the *object* of the relationship — the case where an inverted `contains` is easy to miss. */
  readonly thisEntityIsTarget: boolean;
}

export interface EntityKnowledge {
  readonly entityId: string;
  readonly name: string;
  readonly kind: string;
  readonly subtype?: string;
  readonly groups: readonly KnowledgeGroup[];
  readonly sources: readonly SourceContribution[];
  readonly relationships: readonly RelationshipView[];
  readonly counts: {
    readonly total: number;
    readonly used: number;
    readonly known: number;
    readonly unsupported: number;
  };
}

/** Fields that are structural/internal rather than knowledge a curator curates. */
const NON_KNOWLEDGE_FIELDS = new Set(["id", "kind", "archivedAt"]);

/** Human labels for the typed fields. Anything not listed falls back to a de-camelCased version — no field is ever hidden for lack of a label. */
const FIELD_LABELS: Readonly<Record<string, string>> = {
  name: "Name",
  description: "Description",
  imageUrl: "Image",
  placeType: "Place type",
  organizationType: "Organization type",
  activityType: "Activity type",
  eventType: "Event type",
  geometry: "Location",
  address: "Address",
  activities: "Confirmed activities",
  facilities: "Confirmed facilities",
  hours: "Hours",
  feeRequired: "Fee required",
  wheelchairAccessible: "Wheelchair accessible",
  hasActiveFireBan: "Active fire ban",
  aliases: "Also known as",
  externalIds: "External identifiers",
  keyFacts: "Key facts",
  startTime: "Starts",
  endTime: "Ends",
};

function humanizeFieldName(field: string): string {
  return (
    FIELD_LABELS[field] ??
    field.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (Array.isArray(value))
    return value.map(formatValue).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const geometry = value as { type?: string; coordinates?: unknown };
    if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
      const [lon, lat] = geometry.coordinates as number[];
      return `${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`;
    }
    const externalId = value as { system?: string; id?: string };
    if (externalId.system && externalId.id)
      return `${externalId.system}: ${externalId.id}`;
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Does this value actually appear in any source that describes this
 * entity? Deliberately a plain substring search over the stored raw
 * content, and deliberately conservative about what that proves.
 *
 * **What a `false` means:** nothing in any attached source's raw text
 * contains this string. That is exactly how the fabricated
 * `BC Parks ORCS: 139` on Big White is detectable — the digits "139" and
 * the word "ORCS" appear nowhere in the Wikipedia article it supposedly
 * came from.
 *
 * **What a `false` does not mean:** that the value is wrong. A value can
 * be legitimately derived rather than quoted — a geocoded coordinate
 * (`NominatimGeocoder`) is real knowledge that will never appear in the
 * source text, and a normalized value may be phrased differently. Those
 * are reported as `derived`, not as fabrications, via `origin`.
 *
 * So this is a *flag for review*, never an automatic verdict, and the UI
 * must present it that way.
 */
function checkSupport(
  value: string,
  sources: readonly SourceRecord[],
): { supported: boolean; sourceRecordId?: string; excerpt?: string } {
  const needle = value.trim();
  if (!needle || needle.length < 2) return { supported: true };

  for (const source of sources) {
    const raw =
      typeof source.rawContent === "string"
        ? source.rawContent
        : JSON.stringify(source.rawContent ?? "");
    const index = raw.toLowerCase().indexOf(needle.toLowerCase());
    if (index !== -1) {
      const start = Math.max(0, index - 90);
      const end = Math.min(raw.length, index + needle.length + 90);
      return {
        supported: true,
        sourceRecordId: source.id,
        excerpt: `${start > 0 ? "…" : ""}${raw.slice(start, end).replace(/\s+/g, " ").trim()}${end < raw.length ? "…" : ""}`,
      };
    }
  }
  return { supported: false };
}

/** Values Atlas computes rather than quotes — never flagged as unsupported when absent from source text. */
const DERIVED_FIELDS = new Set(["geometry", "imageUrl"]);

/**
 * Fields whose value is an AI *summary* of the source rather than a quote
 * from it. A description is supposed to be reworded — flagging it as
 * "unverified" because it isn't verbatim would be a false positive, and a
 * detector that cries wolf on every entity's description is a detector
 * nobody reads by the time a real fabrication appears.
 */
const SYNTHESIZED_FIELDS = new Set(["name", "description"]);

/**
 * Array-valued fields are checked element by element, not as one
 * comma-joined string. `"night skiing, skiing"` never appears verbatim in
 * any source, but `"night skiing"` and `"skiing"` both do — checking the
 * joined form would flag every list on every entity.
 */
function checkListSupport(
  values: readonly string[],
  sources: readonly SourceRecord[],
): {
  supported: boolean;
  foundCount: number;
  sourceRecordId?: string;
  excerpt?: string;
} {
  let foundCount = 0;
  let firstHit: { sourceRecordId?: string; excerpt?: string } | undefined;
  for (const value of values) {
    const hit = checkSupport(value, sources);
    if (hit.supported) {
      foundCount += 1;
      firstHit ??= { sourceRecordId: hit.sourceRecordId, excerpt: hit.excerpt };
    }
  }
  return { supported: foundCount === values.length, foundCount, ...firstHit };
}

interface KeyFactShape {
  label?: string;
  value?: string;
  category?: string;
  sourceRecordId?: string;
  confidence?: number;
  asOf?: string;
}

export function buildEntityKnowledge(
  entity: AdminEntity,
  allSources: readonly SourceRecord[],
  allRelationships: readonly Relationship[],
  allEntities: readonly AdminEntity[],
): EntityKnowledge {
  // Sources that describe this entity — the same `describes` traversal
  // `computeSourceCoverage` already uses, not a new notion of attachment.
  const describingIds = new Set(
    allRelationships
      .filter((r) => r.type === "describes" && r.targetEntityId === entity.id)
      .map((r) => r.sourceEntityId),
  );
  const sources = allSources.filter((s) => describingIds.has(s.id));
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const items: KnowledgeItem[] = [];

  // ---- Typed entity fields -------------------------------------------------
  for (const [fieldName, rawValue] of Object.entries(entity)) {
    if (
      NON_KNOWLEDGE_FIELDS.has(fieldName) ||
      fieldName === "keyFacts" ||
      fieldName === "externalIds"
    )
      continue;
    const value = formatValue(rawValue);
    if (!value) continue;

    const usage = fieldUsage(entity.kind, fieldName);
    const derived = DERIVED_FIELDS.has(fieldName);
    const synthesized = SYNTHESIZED_FIELDS.has(fieldName);

    let support: {
      supported: boolean;
      sourceRecordId?: string;
      excerpt?: string;
      foundCount?: number;
    };
    if (derived || synthesized) {
      // Neither is expected to appear verbatim. Still attributed to a
      // source where one exists, so provenance isn't lost — just not
      // subjected to a verbatim test it was never going to pass.
      support = { supported: true, sourceRecordId: sources[0]?.id };
    } else if (Array.isArray(rawValue)) {
      support = checkListSupport(
        rawValue.map(formatValue).filter(Boolean),
        sources,
      );
    } else {
      support = checkSupport(value, sources);
    }

    const attributed = support.sourceRecordId
      ? sourceById.get(support.sourceRecordId)
      : undefined;
    const origin: ProvenanceOrigin = derived
      ? "derived"
      : synthesized
        ? "ai"
        : support.supported
          ? "sourced"
          : "unknown";

    items.push({
      id: `field:${fieldName}`,
      label: humanizeFieldName(fieldName),
      value,
      kind: "field",
      fieldName,
      usage: usage.sections.length > 0 ? "used" : "known",
      usageDetail: usage,
      provenance: {
        origin,
        sourceRecordId: attributed?.id,
        sourceType: attributed?.sourceType,
        source: attributed?.source,
        retrievedAt: attributed?.retrievedAt,
        supported: support.supported,
        excerpt: support.excerpt,
        partialSupportNote:
          Array.isArray(rawValue) &&
          support.foundCount !== undefined &&
          !support.supported
            ? `${support.foundCount} of ${rawValue.length} items found verbatim in an attached source.`
            : undefined,
      },
    });
  }

  // ---- External identifiers (each one separately — a fabricated one hides in a list) ----
  const externalIds = Array.isArray(entity.externalIds)
    ? entity.externalIds
    : [];
  for (const [index, raw] of externalIds.entries()) {
    const pair = raw as { system?: string; id?: string };
    if (!pair?.system || !pair?.id) continue;
    // Checked on the identifier value alone: the *system* name is Atlas's
    // own label and often absent from source prose, so including it would
    // make every identifier look unsupported.
    const support = checkSupport(String(pair.id), sources);
    const attributed = support.sourceRecordId
      ? sourceById.get(support.sourceRecordId)
      : undefined;
    items.push({
      id: `externalId:${index}`,
      label: pair.system,
      value: String(pair.id),
      kind: "externalId",
      usage: "known",
      usageDetail: fieldUsage(entity.kind, "externalIds"),
      provenance: {
        origin: support.supported ? "sourced" : "unknown",
        sourceRecordId: attributed?.id,
        sourceType: attributed?.sourceType,
        source: attributed?.source,
        retrievedAt: attributed?.retrievedAt,
        supported: support.supported,
        excerpt: support.excerpt,
      },
    });
  }

  // ---- Key facts (ADR 017) — the source-native structure ----
  const keyFacts = (
    Array.isArray(entity.keyFacts) ? entity.keyFacts : []
  ) as KeyFactShape[];
  for (const [index, fact] of keyFacts.entries()) {
    if (!fact?.label || !fact?.value) continue;
    const attributed = fact.sourceRecordId
      ? sourceById.get(fact.sourceRecordId)
      : undefined;
    const support = checkSupport(fact.value, sources);
    items.push({
      id: `keyFact:${index}`,
      label: fact.label,
      value: fact.asOf ? `${fact.value} (as of ${fact.asOf})` : fact.value,
      kind: "keyFact",
      usage: keyFactUsage().sections.length > 0 ? "used" : "known",
      usageDetail: keyFactUsage(),
      provenance: {
        origin: support.supported ? "sourced" : "unknown",
        sourceRecordId: fact.sourceRecordId,
        sourceType: attributed?.sourceType,
        source: attributed?.source,
        retrievedAt: attributed?.retrievedAt,
        confidence: fact.confidence,
        supported: support.supported,
        excerpt: support.excerpt,
      },
    });
  }

  // ---- Grouping ------------------------------------------------------------
  // Priority, per the approved design: (1) the source's own category,
  // (2) the source itself, (3) core identity. Never an Atlas-invented
  // taxonomy — a winery must work here without a code change.
  const groups = new Map<
    string,
    {
      label: string;
      groupedBy: KnowledgeGroup["groupedBy"];
      items: KnowledgeItem[];
    }
  >();
  const push = (
    key: string,
    label: string,
    groupedBy: KnowledgeGroup["groupedBy"],
    item: KnowledgeItem,
  ) => {
    const existing = groups.get(key) ?? { label, groupedBy, items: [] };
    existing.items.push(item);
    groups.set(key, existing);
  };

  for (const item of items) {
    if (item.kind === "keyFact") {
      const index = Number(item.id.split(":")[1]);
      const category = keyFacts[index]?.category;
      if (category) {
        push(`cat:${category}`, category, "source-category", item);
        continue;
      }
    }
    if (
      item.kind === "field" &&
      [
        "name",
        "description",
        "placeType",
        "organizationType",
        "activityType",
        "eventType",
        "geometry",
        "address",
        "imageUrl",
      ].includes(item.fieldName ?? "")
    ) {
      push("core", "Core identity", "core", item);
      continue;
    }
    const sourceLabel = item.provenance.sourceType
      ? `From ${item.provenance.sourceType}`
      : "Origin not yet traceable";
    push(
      `src:${item.provenance.sourceType ?? "unknown"}`,
      sourceLabel,
      "source",
      item,
    );
  }

  const orderedGroups: KnowledgeGroup[] = [...groups.entries()]
    .map(([key, g]) => ({
      key,
      label: g.label,
      groupedBy: g.groupedBy,
      sourceTypes: [
        ...new Set(
          g.items
            .map((i) => i.provenance.sourceType)
            .filter((t): t is string => Boolean(t)),
        ),
      ],
      items: g.items,
    }))
    // Core first, then the source's own categories (the richest structure), then source buckets.
    .sort((a, b) => {
      const rank = (g: KnowledgeGroup) =>
        g.groupedBy === "core" ? 0 : g.groupedBy === "source-category" ? 1 : 2;
      return rank(a) - rank(b) || a.label.localeCompare(b.label);
    });

  // ---- Source contributions ------------------------------------------------
  const sourceContributions: SourceContribution[] = sources.map((s) => {
    const raw =
      typeof s.rawContent === "string"
        ? s.rawContent
        : JSON.stringify(s.rawContent ?? "");
    const contributed = items
      .filter((i) => i.provenance.sourceRecordId === s.id)
      .map((i) => i.label);
    return {
      id: s.id,
      sourceType: s.sourceType,
      source: s.source,
      retrievedAt: s.retrievedAt,
      rawContentLength: raw.length,
      sections: [...raw.matchAll(/^Section:\s*(.+)$/gm)].map((m) =>
        m[1]!.trim(),
      ),
      contributedLabels: contributed,
      charsPerContribution:
        contributed.length > 0
          ? Math.round(raw.length / contributed.length)
          : null,
    };
  });

  // ---- Relationships, with direction made explicit -------------------------
  const nameById = new Map(allEntities.map((e) => [e.id, e]));
  const relationships: RelationshipView[] = allRelationships
    .filter(
      (r) =>
        r.type !== "describes" &&
        (r.sourceEntityId === entity.id || r.targetEntityId === entity.id),
    )
    .map((r) => {
      const outgoing = r.sourceEntityId === entity.id;
      const otherId = outgoing ? r.targetEntityId : r.sourceEntityId;
      const other = nameById.get(otherId);
      const otherName = other?.name ?? otherId;
      // Always rendered subject-verb-object in real-world order, so an
      // inverted `contains` reads as the nonsense it is rather than as a
      // neutral link. This is the whole point: "Telus Park contains Big
      // White Ski Resort" should look wrong at a glance.
      const statement = outgoing
        ? `${entity.name} ${r.type} ${otherName}`
        : `${otherName} ${r.type} ${entity.name}`;
      return {
        id: r.id,
        type: r.type,
        statement,
        direction: outgoing ? ("outgoing" as const) : ("incoming" as const),
        otherId,
        otherName,
        otherKind: other?.kind ?? "unknown",
        thisEntityIsTarget: !outgoing,
      };
    });

  const used = items.filter((i) => i.usage === "used").length;
  const unsupported = items.filter((i) => !i.provenance.supported).length;

  return {
    entityId: entity.id,
    name: entity.name,
    kind: entity.kind,
    subtype:
      formatValue(
        entity.placeType ??
          entity.organizationType ??
          entity.activityType ??
          entity.eventType,
      ) || undefined,
    groups: orderedGroups,
    sources: sourceContributions,
    relationships,
    counts: {
      total: items.length,
      used,
      known: items.length - used,
      unsupported,
    },
  };
}

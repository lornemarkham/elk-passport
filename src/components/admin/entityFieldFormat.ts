import type { AdminEntity } from "@/lib/data/admin-repo";

/**
 * Curator-facing rendering for a raw Atlas entity's fields — humanized
 * labels, readable values, no schema knowledge required. Shared by
 * whatever content-quality view needs to show a curator "here's an entity,
 * here's what's in it": Duplicate Review today, and — per the Content
 * Operations Center direction this page is the start of — future views
 * like reviewing a newly-extracted entity or one missing an image will
 * want this exact same rendering, not a reinvention of it.
 */

const HIDDEN_FIELDS = new Set(["id", "kind", "archivedAt"]);

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  description: "Description",
  imageUrl: "Image",
  placeType: "Place type",
  organizationType: "Organization type",
  activityType: "Activity type",
  eventType: "Event type",
  aliases: "Aliases",
  address: "Address",
  geometry: "Location",
  startTime: "Start time",
  endTime: "End time",
  hasActiveFireBan: "Fire ban in effect",
  activities: "Confirmed activities",
  externalIds: "External IDs",
  facilities: "Confirmed facilities",
  hours: "Opening hours",
  wheelchairAccessible: "Wheelchair accessibility",
  feeRequired: "Fee required",
};

export function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  // Fallback for any field this list doesn't know about yet — still
  // readable, not a raw camelCase dump.
  return field
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

export function isImageField(field: string): boolean {
  return field === "imageUrl";
}

function formatExternalIds(value: readonly unknown[]): string {
  if (value.length === 0) return "—";
  return value
    .map((entry) => {
      if (
        typeof entry === "object" &&
        entry !== null &&
        "system" in entry &&
        "id" in entry
      ) {
        const e = entry as { system: unknown; id: unknown };
        return `${String(e.system)}: ${String(e.id)}`;
      }
      return JSON.stringify(entry);
    })
    .join(", ");
}

function formatGeometry(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    (value as { type: unknown }).type === "Point" &&
    "coordinates" in value
  ) {
    const [lon, lat] = (value as { coordinates: [number, number] }).coordinates;
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
  return "Shape on file (not a single point)";
}

export function formatFieldValue(field: string, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (field === "geometry") return formatGeometry(value);
  if (field === "externalIds" && Array.isArray(value))
    return formatExternalIds(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Every field worth showing a curator, in a stable and skim-friendly order — the fields every kind shares first, then whatever's specific to this kind. */
export function fieldNamesFor(entities: AdminEntity[]): string[] {
  const names = new Set<string>();
  for (const entity of entities) {
    for (const key of Object.keys(entity)) {
      if (!HIDDEN_FIELDS.has(key)) names.add(key);
    }
  }
  const priority = ["name", "description", "imageUrl"];
  return [
    ...priority.filter((name) => names.has(name)),
    ...[...names].filter((name) => !priority.includes(name)).sort(),
  ];
}

export function fieldsDiffer(entities: AdminEntity[], field: string): boolean {
  const values = entities.map((e) => JSON.stringify(e[field]));
  return new Set(values).size > 1;
}

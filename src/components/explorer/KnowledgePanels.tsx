import type {
  DossierEntityRecord,
  EntityDossier,
} from "@/lib/data/explorer-dossier-repo";
import { Chip, Empty, EntityLink, Field, Id, Panel } from "./primitives";

/**
 * **Identity, location and content — the stored record, arranged.**
 *
 * Every panel here reads the entity exactly as Atlas serves it, including
 * the fields only one kind has. Nothing is renamed, reformatted or rounded:
 * `hours` is shown as the string the publisher wrote, because a normalised
 * copy of a fact is a different fact, and this is the page that has to show
 * the original.
 *
 * Absent fields are drawn as absent. "Atlas has no address for this" is one
 * of the two answers this whole tool exists to give, and an omitted row
 * gives neither.
 */

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

export function IdentityPanel({ dossier }: { dossier: EntityDossier }) {
  const { identity } = dossier;
  return (
    <Panel title="Identity">
      <dl>
        <Field label="Atlas id">
          <Id value={identity.id} />
        </Field>
        <Field label="Kind">
          {identity.kind}
          {identity.isRegion && (
            <span className="ml-2">
              <Chip>Atlas Region</Chip>
            </span>
          )}
        </Field>
        <Field label="Subtype" empty={!identity.subtype}>
          <span className="font-mono text-xs">{identity.subtype}</span>
        </Field>
        <Field label="Aliases" empty={identity.aliases.length === 0}>
          <span className="flex flex-wrap gap-1">
            {identity.aliases.map((alias) => (
              <Chip key={alias}>{alias}</Chip>
            ))}
          </span>
        </Field>
        <Field
          label="External identifiers"
          empty={identity.externalIds.length === 0}
        >
          <ul className="flex flex-col gap-0.5">
            {identity.externalIds.map((external) => (
              <li key={`${external.system}:${external.id}`} className="text-xs">
                <span className="font-mono">{external.system}</span>{" "}
                <span className="text-muted-foreground font-mono break-all">
                  {external.id}
                </span>
              </li>
            ))}
          </ul>
        </Field>
        <Field label="Archived" empty={!identity.archivedAt}>
          {identity.archivedAt}
        </Field>
      </dl>
    </Panel>
  );
}

export function LocationPanel({ dossier }: { dossier: EntityDossier }) {
  const entity = dossier.entity;
  const geometry = entity.geometry as
    { type?: string; coordinates?: number[] } | undefined;

  return (
    <Panel title="Location">
      <dl>
        <Field label="Address" empty={typeof entity.address !== "string"}>
          {entity.address as string}
        </Field>
        <Field label="Geometry" empty={!geometry}>
          {geometry && (
            <span className="font-mono text-xs">
              {geometry.type}{" "}
              {Array.isArray(geometry.coordinates)
                ? geometry.coordinates.join(", ")
                : ""}
            </span>
          )}
        </Field>
        <Field
          label="Region membership"
          empty={dossier.regionMemberships.length === 0}
        >
          <ul>
            {dossier.regionMemberships.map((membership) => (
              <li key={membership.relationshipId}>
                <EntityLink entity={membership.region} />
              </li>
            ))}
          </ul>
        </Field>
      </dl>
      {dossier.regionMemberships.length === 0 && (
        <p className="text-muted-foreground mt-2 text-xs">
          No region has claimed this entity. Membership is an asserted{" "}
          <code className="font-mono">contains</code> edge from a region, never
          derived from coordinates — so an entity can have exact coordinates
          inside the Okanagan and still belong to no region.
        </p>
      )}
    </Panel>
  );
}

/** Fields every kind carries, so the content panel can list the rest generically. */
const COMMON_FIELDS = new Set([
  "kind",
  "id",
  "name",
  "aliases",
  "description",
  "media",
  "imageUrl",
  "externalIds",
  "archivedAt",
  "address",
  "geometry",
  "placeType",
  "organizationType",
  "activityType",
  "eventType",
]);

function renderValue(value: unknown): React.ReactNode {
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === "string")) {
      return (
        <span className="flex flex-wrap gap-1">
          {(value as string[]).map((v) => (
            <Chip key={v}>{v}</Chip>
          ))}
        </span>
      );
    }
    return (
      <ul className="flex flex-col gap-0.5">
        {value.map((v, index) => {
          const fact = v as { label?: string; value?: string };
          return (
            <li key={index} className="text-sm">
              {fact.label ? (
                <>
                  <span className="text-muted-foreground">{fact.label}: </span>
                  {fact.value}
                </>
              ) : (
                <code className="font-mono text-xs">{JSON.stringify(v)}</code>
              )}
            </li>
          );
        })}
      </ul>
    );
  }
  return <code className="font-mono text-xs">{JSON.stringify(value)}</code>;
}

export function ContentPanel({ entity }: { entity: DossierEntityRecord }) {
  // Whatever this kind carries beyond identity and location — `keyFacts`,
  // `activities`, `hours`, `feeRequired`, `startTime`, and anything a future
  // field adds without this file needing to know about it.
  const extras = Object.entries(entity).filter(
    ([key, value]) =>
      !COMMON_FIELDS.has(key) &&
      value !== undefined &&
      value !== null &&
      !(Array.isArray(value) && value.length === 0),
  );

  return (
    <Panel title="Content">
      <dl>
        <Field label="Description" empty={!entity.description}>
          <p className="whitespace-pre-wrap">{entity.description}</p>
        </Field>
        {extras.map(([key, value]) => (
          <Field key={key} label={key}>
            {renderValue(value)}
          </Field>
        ))}
      </dl>
      {extras.length === 0 && (
        <p className="text-muted-foreground mt-2 text-xs">
          Beyond a name and a description, Atlas stores no kind-specific field
          for this entity — no key facts, no hours, no activities.
        </p>
      )}
    </Panel>
  );
}

interface MediaAssetLike {
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  sourceRecordId?: string;
}

export function MediaPanel({ entity }: { entity: DossierEntityRecord }) {
  const media = (entity.media as MediaAssetLike[] | undefined) ?? [];
  const bySource = new Map<string, number>();
  for (const asset of media) {
    const key = asset.sourceRecordId ?? "(no source)";
    bySource.set(key, (bySource.get(key) ?? 0) + 1);
  }

  return (
    <Panel
      title="Media"
      count={media.length}
      subtitle={
        bySource.size > 1 ? `from ${bySource.size} source records` : undefined
      }
    >
      {media.length === 0 ? (
        <Empty>Atlas holds no image for this entity.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {media.slice(0, 24).map((asset) => (
              <figure key={asset.url} className="min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- external Atlas-recorded URLs, deliberately not proxied through the Next image pipeline */}
                <img
                  src={asset.thumbnailUrl ?? asset.url}
                  alt={asset.caption ?? ""}
                  className="bg-muted aspect-square w-full rounded object-cover"
                  loading="lazy"
                />
                {asset.caption && (
                  <figcaption className="text-muted-foreground mt-0.5 line-clamp-2 text-[10px]">
                    {asset.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
          {media.length > 24 && (
            <p className="text-muted-foreground mt-2 text-xs">
              Showing 24 of {media.length}.
            </p>
          )}
          <p className="text-muted-foreground mt-2 text-xs">
            Captions are the publisher&apos;s own words. A caption naming
            something else is Atlas attributing a page&apos;s images to the
            wrong subject — worth seeing rather than cropping out.
          </p>
        </>
      )}
    </Panel>
  );
}

export { asStringArray };

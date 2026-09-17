import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  ExplorerNotFoundError,
  getDiscoveryVerdict,
  getEntityDossier,
} from "@/lib/data/explorer-dossier-repo";
import { activeScope } from "@/domain/discovery/activeScope";
import { passportView } from "@/lib/explorer/passportView";
import { KindBadge, Id, Flag, Chip } from "@/components/explorer/primitives";
import {
  ContentPanel,
  IdentityPanel,
  LocationPanel,
  MediaPanel,
} from "@/components/explorer/KnowledgePanels";
import { RelationshipBrowser } from "@/components/explorer/RelationshipBrowser";
import {
  HistoryPanel,
  ObservationsPanel,
  SourcesPanel,
} from "@/components/explorer/EvidencePanel";
import { PassportLens } from "@/components/explorer/PassportLens";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const dossier = await getEntityDossier(id);
    return {
      title: `${dossier.identity.name} — Atlas Explorer`,
      robots: { index: false, follow: false },
    };
  } catch {
    return { title: "Atlas Explorer", robots: { index: false, follow: false } };
  }
}

/**
 * **One entity, everything Atlas holds about it.**
 *
 * ## Three requests, whatever the entity's degree
 *
 * The dossier, the Discovery projection, and the region list. Not one per
 * relationship — the Kalamalka investigation found a Passport page issuing
 * `getPlace` per neighbour, which made Atlas read the whole corpus 32 times
 * and pushed Postgres past its statement timeout. An inspection tool for
 * highly-connected entities is precisely where that mistake would hurt most,
 * so the fan-out happens once, inside Atlas, where the corpus is already in
 * memory.
 *
 * ## Two columns, two different claims
 *
 * The left column is the record — identity, location, content, media. The
 * right is the graph and the evidence behind it, which is where the
 * interesting failures live. The Passport lens sits at the top of the right
 * column, boxed and dashed, because it is the one thing on the page that is
 * not Atlas truth.
 */
export default async function ExplorerEntityPage({ params }: Props) {
  const { id } = await params;

  let dossier;
  try {
    dossier = await getEntityDossier(id);
  } catch (error) {
    if (error instanceof ExplorerNotFoundError) notFound();
    throw error;
  }

  // Both are Passport's own view rather than Atlas's, and both are allowed to
  // fail without taking the dossier with them: Atlas truth is the point of
  // the page, and the lens is commentary on it.
  const [verdict, scope] = await Promise.all([
    getDiscoveryVerdict(id).catch(() => null),
    activeScope().catch(() => undefined),
  ]);

  const { identity, counts, entity } = dossier;
  const lens = verdict ? passportView(verdict, scope) : null;

  return (
    <>
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <KindBadge kind={identity.kind} />
          <h1 className="text-2xl font-semibold tracking-tight">
            {identity.name}
          </h1>
          {identity.subtype && (
            <span className="text-muted-foreground font-mono text-sm">
              {identity.subtype}
            </span>
          )}
          {identity.isRegion && <Chip>Atlas Region</Chip>}
          {identity.archivedAt && <Flag>archived</Flag>}
        </div>

        <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <Id value={identity.id} />
          <span className="font-mono">
            {counts.relationships} relationships
          </span>
          <span className="font-mono">
            {counts.sources} sources
            {counts.subjectSpecificSources !== undefined &&
              ` (${counts.subjectSpecificSources} about it)`}
          </span>
          <span className="font-mono">
            {counts.media} media
            {counts.representativeMedia !== undefined &&
              ` (${counts.representativeMedia} representative)`}
          </span>
          <span className="font-mono">
            {counts.attributedObservations +
              counts.geographicObservations +
              counts.temporalClaims}{" "}
            observations
            {counts.withheldClaims !== undefined &&
              counts.withheldClaims > 0 &&
              ` (${counts.withheldClaims} withheld claims)`}
          </span>
          <span className="font-mono">
            {dossier.regionMemberships.length} regions
          </span>
          {dossier.researchNeed?.needed && (
            <span
              className="text-amber-700 dark:text-amber-400"
              title={dossier.researchNeed.detail}
            >
              research due: {dossier.researchNeed.reason}
            </span>
          )}
          {lens?.destination && (
            <Link
              href={lens.destination}
              className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
            >
              open in Passport
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <IdentityPanel dossier={dossier} />
          <LocationPanel dossier={dossier} />
          <ContentPanel entity={entity} />
          <MediaPanel entity={entity} />
        </div>

        <div className="flex flex-col gap-4">
          {lens ? (
            <PassportLens view={lens} scopeLabel={scope?.label} />
          ) : (
            <section className="rounded-lg border border-dashed border-sky-500/40 px-4 py-3">
              <h2 className="text-sm font-semibold">How Passport sees this</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Discovery&apos;s projection could not be read, so this panel is
                unavailable. Atlas&apos;s own knowledge, on the left and below,
                is unaffected.
              </p>
            </section>
          )}

          <RelationshipBrowser
            name={identity.name}
            groups={dossier.edgeGroups}
            counts={counts}
          />
          <SourcesPanel sources={dossier.sources} />
          <ObservationsPanel
            attributed={dossier.attributedObservations}
            geographic={dossier.geographicObservations}
            temporal={dossier.temporalClaims}
          />
          <HistoryPanel
            merges={dossier.mergeRecords}
            corrections={dossier.corrections}
            research={dossier.research}
          />
        </div>
      </div>
    </>
  );
}

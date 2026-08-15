import type { Metadata } from "next";
import Link from "next/link";
import { Layers, MapPin, Search, Split, Waves } from "lucide-react";
import {
  loadResearchMissions,
  awaitsReview,
} from "@/lib/knowledge/researchMissions";
import { loadRegions } from "@/lib/knowledge/regions";
import {
  Code,
  EmptyState,
  List,
  PageHeader,
  Pill,
  Row,
  Section,
  Stat,
  StatLine,
} from "@/components/atlas/ui";

export const metadata: Metadata = { title: "Atlas" };

/**
 * **Atlas — the front door.**
 *
 * ## The one question
 *
 * *"Which region am I working on today?"*
 *
 * Everything on this page serves that and nothing else. Regions first and
 * largest; the cross-region tools below them; a single quiet line of system
 * status at the foot.
 *
 * ## What was removed, and why
 *
 * The previous version opened with a four-cell KPI block — Regions,
 * Entities, Unplaced, Waiting — in 30px numerals. Every number was true and
 * none of them was the question. A dashboard at the front door makes an
 * operator read statistics before choosing work.
 *
 * Those numbers still exist, as one line of 13px text at the bottom, which
 * is the weight they deserve: context, not headline.
 *
 * Also gone: the paragraph explaining what Atlas is. A front door that
 * describes itself is a front door that is not obvious.
 */
export default async function AtlasHomePage() {
  // Two calls, both cheap. The workspace bundle used to be awaited here for
  // an entity count that is now derived from the regions payload — dropping
  // it removes the page's slowest dependency for no loss.
  const [missions, regionsResult] = await Promise.all([
    loadResearchMissions(),
    loadRegions(),
  ]);

  const waiting = missions.filter(awaitsReview).length;
  const { regions, unassignedIds } = regionsResult;

  // Derived from the regions payload rather than from the workspace bundle.
  //
  // The bundle is a second, slower call and it can fail on its own — which
  // it did, and the page rendered "0 entities" beside "167 unplaced". A
  // fabricated zero is worse than a missing number: it reads as a fact
  // about an empty corpus rather than as a failed fetch.
  //
  // `unassignedIds` plus every region's members plus the regions themselves
  // is the whole corpus, computed from data that actually loaded.
  const placed = new Set(regions.flatMap((r) => r.memberIds));
  const entityCount = unassignedIds.length + placed.size + regions.length;
  const atlasReachable = regions.length > 0 || unassignedIds.length > 0;

  return (
    <div className="flex flex-col gap-14">
      <PageHeader back={{ href: "/", label: "Passport" }} title="Atlas" />

      {/* --- Regions. The reason this page exists. ----------------------- */}
      <Section
        title="Regions"
        action={
          regions.length > 0 ? (
            <Link
              href="/admin/regions"
              className="text-muted-foreground hover:text-foreground text-[13px] transition-colors"
            >
              View all
            </Link>
          ) : undefined
        }
      >
        {regions.length === 0 ? (
          <EmptyState title="The benchmark region, Okanagan, has not been created yet.">
            <p>
              A region is a Place a curator has marked as one; membership is
              asserted, never inferred from coordinates.
            </p>
            <p className="mt-3">
              <Code>
                npm run define-region -- &quot;Okanagan&quot; --lat 49.8 --lon
                -119.5 --assign &quot;Big White Ski Resort&quot;
              </Code>
            </p>
          </EmptyState>
        ) : (
          <List>
            {regions.map((region) => (
              <Row
                key={region.id}
                href={`/admin/regions/${region.id}`}
                icon={<MapPin className="h-4 w-4" />}
                title={region.name}
                meta={`${region.memberIds.length} ${region.memberIds.length === 1 ? "entity" : "entities"}`}
              />
            ))}
          </List>
        )}
      </Section>

      {/* --- Everything that is not one destination ---------------------- */}
      <Section title="Operations">
        <List>
          <Row
            href="/admin/review"
            icon={<Search className="h-4 w-4" />}
            title="Review"
            meta="Research findings waiting on a decision"
            trailing={
              waiting > 0 ? <Pill tone="attention">{waiting}</Pill> : undefined
            }
          />
          <Row
            href="/admin/runs"
            icon={<Waves className="h-4 w-4" />}
            title="Runs"
            meta="What Atlas has been doing"
          />
          <Row
            href="/admin/duplicates"
            icon={<Split className="h-4 w-4" />}
            title="Duplicates"
            meta="Entries that look like the same real thing"
          />
          <Row
            href="/admin/entities"
            icon={<Layers className="h-4 w-4" />}
            title="All entities"
            meta="Everything Atlas holds, placed or not"
          />
        </List>
      </Section>

      {/* --- Context, at the weight context deserves --------------------- */}
      {atlasReachable ? (
        <StatLine>
          <Stat
            label={entityCount === 1 ? "entity" : "entities"}
            value={entityCount}
          />
          <Stat
            label={regions.length === 1 ? "region" : "regions"}
            value={regions.length}
          />
          <Stat label="unplaced" value={unassignedIds.length} />
        </StatLine>
      ) : (
        // Never a row of zeros. A zero is a claim about the corpus; this is
        // a statement about the connection, and they are different things.
        <p className="text-muted-foreground text-[13px]">
          Atlas is not responding — counts unavailable.
        </p>
      )}
    </div>
  );
}

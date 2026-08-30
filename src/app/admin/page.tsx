import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Layers, MapPin, Search, Split, Waves } from "lucide-react";
import {
  loadResearchMissions,
  awaitsReview,
} from "@/lib/knowledge/researchMissions";
import { KNOWLEDGE_DOMAINS } from "@/lib/knowledge/knowledgeDomains";
import { loadRegions } from "@/lib/knowledge/regions";
import { duplicateGroupCount, runsToday } from "@/lib/knowledge/adminSummary";
import {
  Code,
  EmptyState,
  List,
  PageHeader,
  Pill,
  Row,
  Section,
} from "@/components/atlas/ui";

export const metadata: Metadata = { title: "Atlas" };

/**
 * **Atlas — the front door.**
 *
 * ## The one question
 *
 * *"Which region am I working on today?"*
 *
 * ## Three areas, in the order they are asked about
 *
 * **Regions** — the thing being built, and the primary object here. **Knowledge
 * Domains** — the permanent responsibilities through which a region gets built,
 * each running one finite mission at a time. **Operations** — the maintenance
 * underneath both, and the only Atlas-wide rows on the page.
 *
 * The hierarchy the product now states is Region → Knowledge Domain → Mission →
 * Operation. A region is never finished; a domain is never finished; a mission
 * is, and that is where an operator gets to feel they completed something.
 *

 * ## Every row carries its own state
 *
 * The page used to end with a floating line — `168 entities · 1 region ·
 * 167 unplaced` — orphaned from anything it described. Numbers belong on
 * the thing they are about: the entity count sits on **All entities**, the
 * region's size sits on the region, the review backlog sits on **Review**.
 * A statistic with no home is a statistic nobody acts on.
 *
 * ## Metrics degrade individually, and never to zero
 *
 * Each count is fetched independently and bounded. When one cannot be
 * established the row falls back to describing its destination rather than
 * showing `0` — a zero is a claim about the corpus, and this page has
 * already once told an operator there were `0 entities` when there were
 * 168. See `adminSummary.ts`.
 *
 * ## What is deliberately absent
 *
 * *Last updated* on a region. Entities carry no modification timestamp, so
 * any such figure would be derived from something adjacent and presented as
 * if it were the thing. Omitted rather than approximated.
 */
export default async function AtlasHomePage() {
  const [missions, regionsResult, runs, duplicates] = await Promise.all([
    loadResearchMissions(),
    loadRegions(),
    runsToday(),
    duplicateGroupCount(),
  ]);

  const waiting = missions.filter(awaitsReview);
  const { regions, unassignedIds } = regionsResult;

  const placed = new Set(regions.flatMap((r) => r.memberIds));
  const entityCount = unassignedIds.length + placed.size + regions.length;
  // Asked, not inferred. This used to be `regions.length > 0 ||
  // unassignedIds.length > 0` — a heuristic that reads "Atlas is up" from
  // "Atlas returned something", and therefore reports a genuinely empty
  // Atlas as unreachable. `loadRegions` now says which it is.
  const atlasReachable = regionsResult.status === "ok";

  // Asserted in `missions.ts` and counted here, never estimated. There is
  // deliberately no percentage: Atlas cannot know what fraction of a region's
  // lakes it holds, so any bar would be a number invented to fill a shape.
  const operationalDomains = KNOWLEDGE_DOMAINS.filter(
    (d) => d.status === "operational",
  ).length;
  const unconfiguredDomains = KNOWLEDGE_DOMAINS.filter(
    (d) => d.publishers.length === 0,
  ).length;

  return (
    <div className="flex flex-col gap-14">
      <PageHeader
        back={{ href: "/", label: "Passport" }}
        title="Atlas"
        description="Knowledge Engine"
      />

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
            {regions.map((region) => {
              const size = region.memberIds.length;
              const reviewing = waiting.filter((m) =>
                region.memberIds.includes(m.entityId),
              ).length;

              return (
                <Row
                  key={region.id}
                  href={`/admin/regions/${region.id}`}
                  icon={<MapPin className="h-4 w-4" />}
                  title={`Build ${region.name}`}
                  meta={
                    // A bare "0 entities" reads as a dead metric. The same
                    // fact stated as a condition reads as something to do.
                    size === 0
                      ? "No entities placed here yet"
                      : [
                          `${size} ${size === 1 ? "entity" : "entities"}`,
                          reviewing > 0 && `${reviewing} awaiting review`,
                        ]
                          .filter(Boolean)
                          .join("  ·  ")
                  }
                  trailing={
                    reviewing > 0 ? (
                      <Pill tone="attention">{reviewing}</Pill>
                    ) : undefined
                  }
                />
              );
            })}
          </List>
        )}
      </Section>

      {/* --- How knowledge arrives. A peer of Regions, not an Operation. --
          Regions is "where am I working"; Knowledge Acquisition is "what is
          Atlas responsible for knowing". Operations is the maintenance drawer
          underneath both. Three areas, in that order, is the whole
          reorganisation — nothing was moved out of Operations. */}
      <Section title="Knowledge Domains">
        <List>
          <Row
            href="/admin/knowledge"
            icon={<Compass className="h-4 w-4" />}
            title="What Atlas is responsible for knowing"
            meta={
              // Counted from the catalogue itself, so the line cannot drift
              // from the pages it summarises. Stated in words rather than in
              // the status vocabulary, because the key that explains that
              // vocabulary lives on the other side of this link.
              [
                `${KNOWLEDGE_DOMAINS.length} domains`,
                operationalDomains > 0 && `${operationalDomains} operational`,
                unconfiguredDomains > 0 &&
                  `${unconfiguredDomains} with no publisher yet`,
              ]
                .filter(Boolean)
                .join("  ·  ")
            }
          />
        </List>
      </Section>

      {/* --- Everything that is not one destination ---------------------- */}
      <Section title="Operations">
        <List>
          <Row
            href="/admin/review"
            icon={<Search className="h-4 w-4" />}
            title="Review"
            meta={
              // `missions` loaded, so zero is a real answer rather than a
              // missing one — stated the same way Runs and Duplicates state
              // theirs, so the three rows read as one vocabulary.
              waiting.length > 0
                ? `${waiting.length} ${waiting.length === 1 ? "finding" : "findings"} waiting`
                : "Nothing waiting on you"
            }
            trailing={
              waiting.length > 0 ? (
                <Pill tone="attention">{waiting.length}</Pill>
              ) : undefined
            }
          />
          <Row
            href="/admin/runs"
            icon={<Waves className="h-4 w-4" />}
            title="Runs"
            meta={
              runs === null
                ? "What Atlas has been doing"
                : runs === 0
                  ? "Nothing has run today"
                  : `${runs} ${runs === 1 ? "run" : "runs"} today`
            }
          />
          <Row
            href="/admin/duplicates"
            icon={<Split className="h-4 w-4" />}
            title="Duplicates"
            meta={
              duplicates === null
                ? "Entries that look like the same real thing"
                : duplicates === 0
                  ? "Nothing needs review"
                  : `${duplicates} ${duplicates === 1 ? "group needs" : "groups need"} review`
            }
            trailing={
              duplicates !== null && duplicates > 0 ? (
                <Pill>{duplicates}</Pill>
              ) : undefined
            }
          />
          <Row
            href="/admin/entities"
            icon={<Layers className="h-4 w-4" />}
            title="All entities"
            meta={
              atlasReachable
                ? `${entityCount} in Atlas  ·  ${unassignedIds.length} not in a region`
                : "Everything Atlas holds, placed or not"
            }
          />
        </List>
      </Section>
    </div>
  );
}

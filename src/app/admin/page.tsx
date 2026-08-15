import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Layers,
  Search,
  Split,
  Waves,
  X,
} from "lucide-react";
import {
  loadResearchMissions,
  awaitsReview,
  isOpen,
} from "@/lib/knowledge/researchMissions";
import {
  loadWorkspaceBundle,
  type WorkspaceBundle,
} from "@/lib/knowledge/workspaceData";
import { computeRegionHealth } from "@/lib/knowledge/regionHealth";
import { decideResearch } from "@/app/admin/entities/[id]/actions";

export const metadata: Metadata = { title: "Atlas" };

/**
 * **Atlas — the home page.**
 *
 * ## The one question this page answers
 *
 * *"What should I work on today?"*
 *
 * Not "what is Atlas", not "what tools exist", not "how is the corpus
 * doing". Those are all real questions and none of them is the one an
 * operator has when they sit down.
 *
 * ## Why this replaced two pages
 *
 * `/admin/content` and `/admin/ingestion` both used to answer *"how is
 * Atlas doing and what should I do next?"* — both showed a health
 * percentage, both counted the same 167 entities, both suggested next
 * actions. Neither was wrong; **both existing was the defect**, and the
 * first decision of every session was a navigation decision rather than a
 * curation one.
 *
 * ## Findings come first, and that ordering is the whole design
 *
 * A mission in `awaiting-review` is the only thing on this page blocked on
 * *this person*. Health is context; a gap is a suggestion; a finding is a
 * decision someone is waiting for. So it opens the page, and it is
 * **decidable in place** — accept or decline without navigating to the
 * entity first. That single change removes the three-page round trip that
 * research previously required (request on the entity → run in a terminal
 * → watch on Mission Control → return to the entity to review).
 *
 * The entity is still one click away for anyone who wants the full context
 * before deciding, which is the right default for a page whose job is
 * triage rather than depth.
 *
 * ## What was deliberately removed
 *
 * The Operations grid's six "Coming soon" cards. A disabled card is a
 * promise the product cannot keep, and six of them at the front door was
 * the strongest available signal that Atlas is unfinished. The live tools
 * became navigation, because Duplicate Review and Runs are destinations,
 * not features to discover.
 */
export default async function AtlasHomePage() {
  const [missions, bundle] = await Promise.all([
    loadResearchMissions(),
    loadWorkspaceBundle().catch((): WorkspaceBundle | null => null),
  ]);

  const entities = (bundle?.entities ?? []) as unknown as Record<
    string,
    unknown
  >[];
  const names = new Map(entities.map((e) => [String(e.id), String(e.name)]));
  const health = computeRegionHealth(bundle);

  const waiting = missions.filter(awaitsReview);
  const running = missions.filter(isOpen);

  return (
    <>
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Passport
      </Link>

      <h1 className="mb-2 text-3xl font-bold tracking-tight">Atlas</h1>
      <p className="text-muted-foreground mb-10 text-sm">
        {waiting.length > 0
          ? `${waiting.length} finding${waiting.length === 1 ? "" : "s"} waiting on you.`
          : "Nothing is waiting on you. Below is where Atlas is thinnest."}
      </p>

      <div className="flex flex-col gap-12">
        {/* --- The work, first ------------------------------------------- */}
        {waiting.length > 0 && (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                <Search className="h-5 w-5" />
                Waiting on you
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Atlas researched these and applied nothing. Decide here, or open
                the entity for full context.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {waiting.map((mission) => {
                const facts = mission.findings?.keyFacts ?? [];
                const media = mission.findings?.media ?? [];
                return (
                  <div
                    key={mission.id}
                    className="border-border rounded-xl border p-5"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="text-sm font-medium capitalize">
                        {mission.topic}
                      </p>
                      <Link
                        href={`/admin/entities/${mission.entityId}`}
                        className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
                      >
                        {names.get(mission.entityId) ??
                          mission.entityId.slice(0, 8)}
                      </Link>
                      <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                        {facts.length} fact{facts.length === 1 ? "" : "s"} ·{" "}
                        {media.length} media
                      </span>
                    </div>

                    {mission.summary && (
                      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                        {mission.summary}
                      </p>
                    )}

                    {facts.length > 0 && (
                      <dl className="mt-3 flex flex-col gap-1.5">
                        {facts.slice(0, 4).map((fact) => (
                          <div
                            key={`${fact.label}-${fact.value}`}
                            className="flex gap-3 text-sm"
                          >
                            <dt className="text-muted-foreground min-w-[130px] shrink-0">
                              {fact.label}
                            </dt>
                            <dd className="leading-relaxed">{fact.value}</dd>
                          </div>
                        ))}
                        {facts.length > 4 && (
                          <Link
                            href={`/admin/entities/${mission.entityId}`}
                            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                          >
                            + {facts.length - 4} more on the entity page
                          </Link>
                        )}
                      </dl>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <form action={decideResearch}>
                        <input
                          type="hidden"
                          name="missionId"
                          value={mission.id}
                        />
                        <input
                          type="hidden"
                          name="entityId"
                          value={mission.entityId}
                        />
                        <input type="hidden" name="decision" value="accept" />
                        <button className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-emerald-700">
                          <Check className="h-3.5 w-3.5" />
                          Accept
                        </button>
                      </form>
                      <form action={decideResearch}>
                        <input
                          type="hidden"
                          name="missionId"
                          value={mission.id}
                        />
                        <input
                          type="hidden"
                          name="entityId"
                          value={mission.entityId}
                        />
                        <input type="hidden" name="decision" value="reject" />
                        <button className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition">
                          <X className="h-3.5 w-3.5" />
                          Decline
                        </button>
                      </form>
                      <span className="text-muted-foreground text-[11px]">
                        Accepting merges into the entity. Anything Atlas already
                        holds is kept.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* --- In flight, so a requested mission never looks forgotten ---- */}
        {running.length > 0 && (
          <section className="border-border rounded-xl border border-dashed p-5">
            <p className="text-sm font-medium">
              {running.length} mission{running.length === 1 ? "" : "s"}{" "}
              requested and not yet answered
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              Run{" "}
              <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                npm run run-missions
              </code>{" "}
              to answer them. Atlas does not start research from the browser —
              the request is recorded here, the work runs deliberately.
            </p>
          </section>
        )}

        {/* --- Where Atlas is thinnest. Context, not a to-do list. -------- */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Where Atlas is thinnest
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Completeness of what Atlas holds — never coverage of the world.
              </p>
            </div>
            <Link
              href="/admin/entities"
              className="border-border hover:bg-muted/40 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition"
            >
              Browse entities
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="border-border divide-border divide-y rounded-xl border">
            {health.categories.map((category) => (
              <div
                key={category.key}
                className="flex items-center gap-4 px-5 py-3"
              >
                <p className="min-w-[180px] text-sm font-medium">
                  {category.label}
                </p>
                {/* `completeness` is null when Atlas holds nothing to measure, and
                    `notMeasurable` says why. Rendering 0% for either would assert a
                    measurement that was never taken. */}
                {category.completeness === null ? (
                  <p className="text-muted-foreground flex-1 text-sm">
                    {category.notMeasurable ??
                      "Nothing held yet — nothing to measure."}
                  </p>
                ) : (
                  <>
                    <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full bg-emerald-600"
                        style={{
                          width: `${Math.round(category.completeness)}%`,
                        }}
                      />
                    </div>
                    <p className="text-muted-foreground w-12 text-right text-sm tabular-nums">
                      {Math.round(category.completeness)}%
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* --- Destinations, not a grid of cards ------------------------- */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Elsewhere in Atlas
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Destination
              href="/admin/runs"
              icon={<Waves className="h-4 w-4" />}
              title="Runs"
              blurb="What Atlas has been doing — every run, what it read, what it learned."
            />
            <Destination
              href="/admin/duplicates"
              icon={<Split className="h-4 w-4" />}
              title="Duplicate review"
              blurb="Entries that look like the same real thing. Human judgement required."
            />
            <Destination
              href="/admin/explorer"
              icon={<Layers className="h-4 w-4" />}
              title="Field explorer"
              blurb="Inspect many entities' fields at once, for batch checks."
            />
          </div>
        </section>
      </div>
    </>
  );
}

function Destination({
  href,
  icon,
  title,
  blurb,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  blurb: string;
}) {
  return (
    <Link
      href={href}
      className="border-border hover:border-foreground/30 hover:bg-muted/30 group flex flex-col gap-1.5 rounded-xl border p-5 transition"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </p>
      <p className="text-muted-foreground text-sm leading-relaxed">{blurb}</p>
    </Link>
  );
}

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Circle,
  CircleDot,
  HelpCircle,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";
import type {
  EntityKnowledgeView,
  KnowledgeSection,
  TemplateRegion,
} from "@/lib/knowledge/entityKnowledgeView";
import { MediaGallery } from "./MediaGallery";
import { ResearchMissionPanel } from "./ResearchMissionPanel";
import { isOpen, type ResearchMission } from "@/lib/knowledge/researchMissions";
import { isResearchable } from "@/lib/knowledge/researchMissions.shared";
import { startResearch } from "@/app/admin/workspace/[id]/actions";

/**
 * **The Baseline Entity Template** — the default renderer for every Atlas
 * entity.
 *
 * ## What this is, and what it is not
 *
 * This is the Atlas workspace: *everything Atlas knows about one thing*. It
 * is not a Passport page and it is not a page builder. Atlas owns truth;
 * Passport decides later how to present it. The two jobs look similar and
 * conflating them is what turned the previous version into an ingestion
 * debugger.
 *
 * Being Atlas-first buys a specific freedom: **this page is allowed to be
 * dense.** It should read as *"I am looking at everything Atlas knows"*, not
 * as a form to fill in. Nothing here is truncated for tidiness.
 *
 * ## Every kind renders through this
 *
 * A restaurant, a resort, a trail, a festival and a lift all render here.
 * That works because the regions are about *how knowledge is shaped*, not
 * about what the thing is: prose, discrete facts, time, place, contact,
 * pictures, connections, seasonality. A trail and a taproom differ
 * enormously in content and not at all in shape.
 *
 * The order is fixed and is the order a curator reads an entity: what it
 * is → what it's like → what's true about it → when → where → how to reach
 * it → what it looks like → what it connects to → how it changes → whatever
 * fits nowhere yet → what we still don't know → where it all came from.
 *
 * ## How specialised templates will extend this
 *
 * They compose it, they do not replace it. A future `RestaurantTemplate`
 * renders `<BaselineEntityTemplate>` and overrides a region — because the
 * regions are data (`view.regions`) rather than JSX buried in this file, a
 * specialised template can reorder, restyle or inject without forking the
 * renderer. Deliberately not built yet: there is exactly one template, and
 * an inheritance mechanism with one implementor is a guess about the second.
 *
 * ## The rule that outranks the layout
 *
 * **No knowledge Atlas holds may become unreachable.** Anything that
 * matches no section lands in "Other knowledge", which is a real region
 * rather than a debug view. A section can be hidden from travellers; it can
 * never be hidden from the curator.
 */
export function BaselineEntityTemplate({
  view,
  missions = [],
}: {
  view: EntityKnowledgeView;
  /** Research Missions for this entity. Optional — the page renders fully without them. */
  missions?: readonly ResearchMission[];
}) {
  return (
    <div className="flex flex-col gap-12">
      <Hero view={view} />

      {view.regions.map((region) => (
        <Region key={region.id} region={region} />
      ))}

      <ResearchMissionPanel missions={missions} entityId={view.id} />
      <MissingKnowledge view={view} missions={missions} entityId={view.id} />
      <Recommendations view={view} />
      <ProvenanceDrawer view={view} />
    </div>
  );
}

/**
 * Name, kind, status, lead image, and what contains this.
 *
 * The parent is here rather than down in Relationships because it is
 * context for everything else on the page — "a restaurant" and "a
 * restaurant at Big White" are different things to read the rest of the
 * page against. Only the *containing* side appears: what an entity contains
 * can run to hundreds of rows and belongs in Relationships.
 */
function Hero({ view }: { view: EntityKnowledgeView }) {
  const { hero } = view;

  return (
    <header className="flex flex-col gap-5">
      {hero.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hero.image.url}
          alt={hero.image.caption ?? ""}
          className="border-border h-56 w-full rounded-2xl border object-cover sm:h-72"
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs font-medium tracking-widest uppercase">
            <span>{hero.kindLabel}</span>
            <span aria-hidden>·</span>
            <span>{hero.status}</span>
            {hero.parent && (
              <>
                <span aria-hidden>·</span>
                <Link
                  href={`/admin/workspace/${hero.parent.id}`}
                  className="hover:text-foreground underline-offset-4 hover:underline"
                >
                  part of {hero.parent.name}
                </Link>
              </>
            )}
          </div>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            {hero.name}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm tabular-nums">
            {view.factCount} fact{view.factCount === 1 ? "" : "s"} ·{" "}
            {view.media.length} media · {view.known} section
            {view.known === 1 ? "" : "s"} · {view.unknown} not yet known
          </p>
        </div>

        <Link
          href={`/passport/${view.id}`}
          className="border-border hover:border-foreground/40 hover:bg-muted/40 inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition"
        >
          Open Passport page
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}

/**
 * One region of the template. Never rendered empty — the builder drops those.
 *
 * The sub-heading is suppressed where it would only echo the region: a
 * region called "Location" containing one section called "Location" reads
 * as a stutter, and the marker it carries can simply move up. `facts` and
 * `other` always keep theirs, because there the section title ("Food &
 * drink", "Getting there") is the only thing distinguishing one block of
 * rows from the next.
 */
function Region({ region }: { region: TemplateRegion }) {
  const media = region.sections.flatMap((s) => s.media ?? []);
  const withItems = region.sections.filter((s) => s.items.length > 0);
  const flatten =
    withItems.length === 1 && region.id !== "facts" && region.id !== "other";

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight">{region.title}</h2>
        {flatten && <StateMark state={withItems[0]!.state} />}
      </div>

      {/* Media renders as one gallery per region, not one per section, so a
          page never shows two grids under two headings that mean the same
          thing to the person looking at them. */}
      {media.length > 0 && <MediaGallery media={media} />}

      {withItems.length > 0 && (
        <div className="border-border divide-border divide-y rounded-xl border">
          {withItems.map((section) => (
            <SectionRows
              key={section.id}
              section={section}
              showTitle={!flatten}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** ● shown to travellers · ○ held but hidden. The entire vocabulary of this screen. */
function StateMark({ state }: { state: KnowledgeSection["state"] }) {
  const shown = state === "shown";
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[11px]">
      {shown ? (
        <CircleDot className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
      ) : (
        <Circle className="h-3.5 w-3.5" />
      )}
      {shown ? "shown in Passport" : "held, not shown"}
    </span>
  );
}

function SectionRows({
  section,
  showTitle,
}: {
  section: KnowledgeSection;
  showTitle: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 p-5">
      {showTitle && (
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{section.title}</p>
          <StateMark state={section.state} />
        </div>
      )}

      <dl className="flex flex-col gap-2.5">
        {section.items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="flex flex-col gap-0.5 sm:flex-row sm:gap-4"
          >
            <dt className="text-muted-foreground min-w-[140px] shrink-0 text-sm">
              {item.label}
            </dt>
            <dd className="text-sm leading-relaxed">
              {isUrl(item.value) ? (
                <a
                  href={item.value}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  {item.value.replace(/^https?:\/\/(www\.)?/, "")}
                  <ArrowUpRight className="h-3 w-3 opacity-60" />
                </a>
              ) : (
                item.value
              )}
              {/* The source's own heading, preserved verbatim — ADR 017. */}
              {item.category && (
                <span className="text-muted-foreground ml-2 text-[11px]">
                  from &ldquo;{item.category}&rdquo;
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Absence, kept — and one of Atlas's real strengths.
 *
 * Collected into a single region rather than scattered as empty headings
 * through the page above. A gap you can see is a gap you can close; nine
 * headings each saying "nothing here" is noise pretending to be structure.
 */
function MissingKnowledge({
  view,
  missions,
  entityId,
}: {
  view: EntityKnowledgeView;
  missions: readonly ResearchMission[];
  entityId: string;
}) {
  const unknown = view.sections.filter((s) => s.state === "unknown");
  if (unknown.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          What Atlas doesn&apos;t know yet
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Named rather than hidden — a gap you can see is a gap you can close.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {unknown.map((section) => (
          <div
            key={section.id}
            className="border-border/70 rounded-xl border border-dashed p-4"
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <HelpCircle className="text-muted-foreground h-3.5 w-3.5" />
              {section.title}
            </p>
            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
              {section.absence?.explanation}
            </p>
            <ResearchAction
              section={section}
              missions={missions}
              entityId={entityId}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The action beside a gap — a real button where Atlas can act, a label
 * where it cannot.
 *
 * Phase 1 makes exactly one topic actionable. Every other gap keeps the
 * label it has always had, rendered as text rather than as a button,
 * because a button that does nothing is worse than no button: it teaches a
 * curator that the whole list is decorative.
 *
 * A gap with a mission already open shows the mission's state instead. Two
 * clicks is impatience, not a request for two crawls.
 */
function ResearchAction({
  section,
  missions,
  entityId,
}: {
  section: KnowledgeSection;
  missions: readonly ResearchMission[];
  entityId: string;
}) {
  const existing = missions.find(
    (m) =>
      m.topic === section.id && (isOpen(m) || m.status === "awaiting-review"),
  );

  if (existing) {
    return (
      <p className="text-muted-foreground mt-3 inline-flex items-center gap-1.5 text-xs">
        <Loader2
          className={`h-3 w-3 ${isOpen(existing) ? "animate-spin" : ""}`}
        />
        {isOpen(existing) ? "Research requested" : "Findings ready above"}
      </p>
    );
  }

  if (!isResearchable(section.id)) {
    return (
      <p className="text-muted-foreground/70 mt-3 text-xs italic">
        {section.absence?.action}
      </p>
    );
  }

  return (
    <form action={startResearch} className="mt-3">
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="topic" value={section.id} />
      <button className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition">
        <Search className="h-3 w-3" />
        {section.absence?.action}
      </button>
    </form>
  );
}

/** Derived entirely from what is absent — never a hardcoded list. */
export function Recommendations({ view }: { view: EntityKnowledgeView }) {
  if (view.recommendations.length === 0) return null;

  return (
    <section className="border-border rounded-xl border p-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4" />
        Atlas recommends
      </p>
      <ul className="mt-3 flex flex-col gap-2.5">
        {view.recommendations.map((r) => (
          <li key={r.title}>
            <p className="text-sm font-medium">{r.title}</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {r.why}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Evidence — kept in full, deliberately last, deliberately closed. */
export function ProvenanceDrawer({ view }: { view: EntityKnowledgeView }) {
  return (
    <details className="border-border rounded-xl border p-5">
      <summary className="cursor-pointer text-sm font-medium">
        Where this came from
        <span className="text-muted-foreground ml-2 text-xs font-normal">
          {view.provenance.length} source
          {view.provenance.length === 1 ? "" : "s"}
        </span>
      </summary>
      <ul className="mt-4 flex flex-col gap-3">
        {view.provenance.map((p) => (
          <li key={p.url + p.retrievedAt} className="text-sm">
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline-offset-4 hover:underline"
            >
              {p.sourceType}
            </a>
            <p className="text-muted-foreground mt-0.5 text-xs break-all">
              {p.url.replace(/^https?:\/\/(www\.)?/, "")} · read{" "}
              {p.retrievedAt.slice(0, 10)}
              {p.taughtCount > 0
                ? ` · taught ${p.taughtCount} fact${p.taughtCount === 1 ? "" : "s"}`
                : ""}
            </p>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground mt-4 text-xs">
        <Link
          href="/admin/ingestion"
          className="underline-offset-4 hover:underline"
        >
          Ingestion detail
        </Link>{" "}
        — how Atlas read these, rather than what it learned.
      </p>
    </details>
  );
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

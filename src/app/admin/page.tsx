import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Layers,
  MapPin,
  Search,
  Split,
  Waves,
} from "lucide-react";
import {
  loadResearchMissions,
  awaitsReview,
  isOpen,
} from "@/lib/knowledge/researchMissions";
import { loadRegions } from "@/lib/knowledge/regions";
import {
  loadWorkspaceBundle,
  type WorkspaceBundle,
} from "@/lib/knowledge/workspaceData";

export const metadata: Metadata = { title: "Atlas" };

/**
 * **Atlas — headquarters.**
 *
 * ## The one question this page answers
 *
 * *"How is Atlas doing across everything, and where do I go?"*
 *
 * ## What this page is NOT, and why that matters
 *
 * The previous version of this page opened with **"Where Atlas is
 * thinnest"** and a list of category completeness — Restaurants 58%, Parks
 * 47%, Lakes 67%. That was a real measurement answering nobody's question,
 * and it conflated four different things: global health, regional health,
 * entity completeness, and taxonomy.
 *
 * Worse, it hid the product's organising concept. A curator's unit of work
 * is **a destination** — *"grow the Okanagan"* — and a home page that
 * opened with a taxonomy made geography invisible.
 *
 * So this page's first job is to make the hierarchy obvious:
 *
 * ```
 * Atlas  →  Regions  →  Region  →  Entities  →  Entity  →  Passport
 * ```
 *
 * ## Findings still come first
 *
 * A mission in `awaiting-review` is the only thing here blocked on *this
 * person*, and it can span regions — so it belongs at headquarters rather
 * than inside one region. Regions come immediately after, because that is
 * where work is chosen.
 *
 * ## No speculative cards, no disabled features
 *
 * Every destination below is a working page. The six "Coming soon" cards
 * that used to sit here were deleted: a disabled card is a promise the
 * product cannot keep, and six at the front door was the loudest available
 * signal that Atlas is unfinished.
 */
export default async function AtlasHomePage() {
  const [missions, regionsResult, bundle] = await Promise.all([
    loadResearchMissions(),
    loadRegions(),
    loadWorkspaceBundle().catch((): WorkspaceBundle | null => null),
  ]);

  const waiting = missions.filter(awaitsReview);
  const running = missions.filter(isOpen);
  const entityCount = (bundle?.entities ?? []).length;
  const { regions, unassignedIds } = regionsResult;

  return (
    <div className="flex flex-col gap-12">
      <div>
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Passport
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Atlas</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          The knowledge behind Passport. Atlas grows one destination at a time —
          better regions make better entities, and better entities make better
          traveller pages.
        </p>
      </div>

      {/* --- System health, in one line. Not a dashboard. ------------------ */}
      <section className="border-border grid gap-6 rounded-xl border p-6 sm:grid-cols-4">
        <Stat label="Regions" value={String(regions.length)} />
        <Stat label="Entities" value={String(entityCount)} />
        <Stat
          label="Unplaced"
          value={String(unassignedIds.length)}
          hint="Belong to no region yet"
        />
        <Stat
          label="Waiting on you"
          value={String(waiting.length)}
          hint={running.length > 0 ? `${running.length} requested` : undefined}
        />
      </section>

      {/* --- Blocked on a person, and can span regions --------------------- */}
      {waiting.length > 0 && (
        <Link
          href="/admin/review"
          className="border-border hover:border-foreground/30 hover:bg-muted/30 flex items-center gap-3 rounded-xl border p-5 transition"
        >
          <Search className="h-4 w-4" />
          <span className="text-sm font-medium">
            {waiting.length} research finding{waiting.length === 1 ? "" : "s"}{" "}
            waiting on a decision
          </span>
          <ArrowRight className="text-muted-foreground ml-auto h-4 w-4" />
        </Link>
      )}

      {/* --- The hierarchy, made obvious ----------------------------------- */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Regions</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Where knowledge is grown. Open a destination to see its health and
              grow it.
            </p>
          </div>
          <Link
            href="/admin/regions"
            className="border-border hover:bg-muted/40 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition"
          >
            All regions
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {regions.length === 0 ? (
          <div className="border-border rounded-xl border border-dashed p-6">
            <p className="text-sm font-medium">
              The benchmark region, Okanagan, has not been created yet.
            </p>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
              All {entityCount} entities are unplaced. A region is a real Place
              with{" "}
              <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                placeType: region
              </code>
              , and membership is the{" "}
              <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                contains
              </code>{" "}
              relationship — asserted by a curator, never inferred from
              coordinates.
            </p>
            <p className="text-muted-foreground mt-3 text-sm">
              <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                npm run define-region -- &quot;Okanagan&quot; --lat 49.8 --lon
                -119.5 --assign &quot;Big White Ski Resort&quot;
              </code>
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {regions.map((region) => (
              <Link
                key={region.id}
                href={`/admin/regions/${region.id}`}
                className="border-border hover:border-foreground/30 hover:bg-muted/30 group flex items-center gap-3 rounded-xl border p-5 transition"
              >
                <MapPin className="text-muted-foreground h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{region.name}</p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {region.memberIds.length} entit
                    {region.memberIds.length === 1 ? "y" : "ies"}
                  </p>
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 shrink-0 transition" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* --- Genuinely cross-region tools ---------------------------------- */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Across all regions
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            System-wide observation and resolution. These do not belong to any
            one destination.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Destination
            href="/admin/runs"
            icon={<Waves className="h-4 w-4" />}
            title="Runs"
            blurb="Every run, what it read, what it learned."
          />
          <Destination
            href="/admin/duplicates"
            icon={<Split className="h-4 w-4" />}
            title="Duplicates"
            blurb="Entries that look like the same real thing."
          />
          <Destination
            href="/admin/entities"
            icon={<Layers className="h-4 w-4" />}
            title="All entities"
            blurb="Everything Atlas holds, placed or not."
          />
          <Destination
            href="/admin/explorer"
            icon={<Layers className="h-4 w-4" />}
            title="Field explorer"
            blurb="Inspect many entities' fields at once."
          />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
        {value}
      </p>
      {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
    </div>
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
      className="border-border hover:border-foreground/30 hover:bg-muted/30 flex flex-col gap-1.5 rounded-xl border p-5 transition"
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </p>
      <p className="text-muted-foreground text-sm leading-relaxed">{blurb}</p>
    </Link>
  );
}

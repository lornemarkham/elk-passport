import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock,
  MapPin,
  Phone,
  Sparkles,
  Utensils,
} from "lucide-react";
import { loadWorkspaceBundle } from "@/lib/knowledge/workspaceData";
import { getSubjectDetail } from "@/lib/data/atlas-repo";
import { subjectPageView } from "@/lib/passport/subjectPage";
import { ComposedSubjectPage } from "@/components/passport/ComposedSubject";
import { formatEventWhen } from "@/domain/experience/eventTime";
import {
  loadComposition,
  resolveComposition,
  visibleSections,
} from "@/lib/passport/composition";
import {
  buildPassportPage,
  type EntityKnowledge,
  type PageSection,
  type RelatedEntity,
  type SourceSummary,
} from "@/lib/passport/buildPage";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Passport — ${id.slice(0, 8)}`,
    robots: { index: false, follow: false },
  };
}

/**
 * `/passport/[id]` — the traveller page, for any entity kind.
 *
 * ## Why a neutral route
 *
 * `/places/[id]` is a misnomer for a restaurant, and forcing Organizations
 * through it would have meant either lying in the URL or bending the Place
 * renderer into something it isn't. A neutral route leaves room for Places,
 * Organizations, Events and whatever comes next without misleading
 * semantics — and leaves the existing Place page completely untouched.
 *
 * ## Every fact here is read live from Atlas
 *
 * The composition layer decides *which* sections appear and in what order.
 * It holds no hours, no address, no description. Teach Atlas something and
 * this page improves on the next request, with no republish step. That
 * property is the entire reason the engine is worth building, and it is
 * the first thing to protect if this page is ever extended.
 *
 * ## Two loaders, and why the composed one is tried first
 *
 * This page used to build its own world out of `/admin/entities` and
 * `/admin/relationships` — the whole corpus, joined by uuid here — which let
 * it show what a single record held and nothing about what that record was
 * connected to. Black Mountain was the proof: an address, a generic sentence
 * and *"Operation period: Every October"*, while Atlas held the eight nights,
 * the six afternoons, both price tables and the two modes, one hop away
 * along edges this page never asked for.
 *
 * So a subject Atlas can compose (`GET /organizations/:id/detail`,
 * `GET /experiences/:id/detail`, Atlas 2846f50) is rendered from that one
 * **public** read — no admin token, no relationship table, no uuid join, and
 * no second implementation of `claimCoversDay`: `?on=YYYY-MM-DD` on this page
 * is handed straight to Atlas. Every other kind falls through to the loader
 * below, exactly as it was.
 *
 * ## Operator tooling is not the traveller's page
 *
 * The curator bar, the completeness score and the *"N things would make this
 * page better"* block are a curator's instruments — *Research hours*,
 * *Research the menu*, *Find more images* — and a traveller reading about a
 * haunted house should not be handed them. They are not deleted: `?curator=1`
 * restores every one of them, which is also how the Knowledge workspace
 * should link here.
 */
export default async function PassportPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const on = typeof query.on === "string" ? query.on : undefined;
  const curator = query.curator === "1";

  // A subject Atlas composes is rendered from the composed read alone. Tried
  // in the order a consumer is most likely to arrive: October Discover routes
  // an Organization card to its Organization id.
  // Events last only because an Organization id is the likeliest arrival;
  // every kind Atlas composes is tried, and an Event is most of a month.
  for (const kind of ["organizations", "experiences", "events"] as const) {
    const composition = await getSubjectDetail(kind, id, on).catch(() => null);
    if (composition) {
      return (
        <main className="bg-background min-h-screen">
          {curator && <CuratorBar id={id} />}
          <ComposedSubjectPage view={subjectPageView(composition)} />
        </main>
      );
    }
  }

  const bundle = await loadWorkspaceBundle().catch(() => null);
  const entity = (
    bundle?.entities as unknown as EntityKnowledge[] | undefined
  )?.find((e) => e.id === id);
  if (!entity) notFound();

  const related: RelatedEntity[] = (bundle?.relationships ?? [])
    .filter((r) => r.sourceEntityId === id || r.targetEntityId === id)
    .map((r) => {
      const otherId =
        r.sourceEntityId === id ? r.targetEntityId : r.sourceEntityId;
      const other = (bundle?.entities as unknown as EntityKnowledge[])?.find(
        (e) => e.id === otherId,
      );
      return other
        ? {
            id: other.id,
            name: other.name,
            kind: other.kind,
            relationship: r.type,
          }
        : null;
    })
    .filter((r): r is RelatedEntity => r !== null && r.kind !== "SourceRecord");

  const describedBy = new Set(
    (bundle?.relationships ?? [])
      .filter((r) => r.type === "describes" && r.targetEntityId === id)
      .map((r) => r.sourceEntityId),
  );
  const sources: SourceSummary[] = (bundle?.sources ?? [])
    .filter((s) => describedBy.has(s.id))
    .map((s) => ({
      id: s.id,
      sourceType: s.sourceType,
      url: s.source,
      retrievedAt: s.retrievedAt,
    }));

  const saved = await loadComposition(id);
  const composition = resolveComposition(id, entity.kind, saved);
  const page = buildPassportPage({
    entity,
    related,
    sources,
    order: visibleSections(composition),
    chosenHeroUrl: composition.heroImageUrl,
  });

  const missing = page.sections.filter((s) => s.state === "missing");
  const hero = page.sections.find((s) => s.type === "hero");

  return (
    <main className="bg-background min-h-screen">
      {/* Curator instruments, off by default — see this file's doc comment. */}
      {curator && (
        <div className="border-border bg-muted/30 border-b">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-3">
            <Link
              href="/admin/entities"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to entities
            </Link>
            <div className="flex items-center gap-3 text-xs">
              <span
                className={`rounded-full border px-2.5 py-1 font-medium ${
                  composition.status === "published"
                    ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-500"
                    : composition.status === "ready"
                      ? "border-amber-500/40 text-amber-700 dark:text-amber-500"
                      : "border-border text-muted-foreground"
                }`}
              >
                {composition.status === "published"
                  ? "Published"
                  : composition.status === "ready"
                    ? "Ready"
                    : "Draft"}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {page.completeness}% complete
              </span>
              <Link
                href={`/admin/entities/${id}`}
                className="text-muted-foreground hover:text-foreground"
              >
                Evidence
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ---- The traveller page ---- */}
      <article className="mx-auto max-w-3xl px-6 pb-24">
        <HeroBlock section={hero} entity={entity} />

        <div className="mt-12 flex flex-col gap-12">
          {page.sections
            .filter((s) => s.type !== "hero")
            .map((section) => (
              <Section key={section.type} section={section} />
            ))}
        </div>

        {/* ---- What would make this page better: a curator's list, not a traveller's ---- */}
        {curator && missing.length > 0 && (
          <section className="border-border mt-16 rounded-2xl border border-dashed p-6">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              {missing.length} {missing.length === 1 ? "thing" : "things"} would
              make this page better
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {missing.map((section) => (
                <li
                  key={section.type}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                >
                  <span className="text-muted-foreground">
                    {section.missingLabel}
                  </span>
                  <span className="border-border rounded-full border px-3 py-1 text-xs font-medium">
                    {section.action}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
              Nothing here is invented. Where Atlas knows nothing, this page
              says so — a visible gap can be fixed, an invented one cannot.
            </p>
          </section>
        )}
      </article>
    </main>
  );
}

/**
 * The curator's strip: where this record lives and what evidence stands
 * behind it. Kept out of the traveller's way rather than deleted — a page
 * with no route back to its evidence is a page nobody can correct.
 */
function CuratorBar({ id }: { id: string }) {
  return (
    <div className="border-border bg-muted/30 border-b">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <Link
          href="/admin/entities"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to entities
        </Link>
        <Link
          href={`/admin/entities/${id}`}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          Evidence
        </Link>
      </div>
    </div>
  );
}

function HeroBlock({
  section,
  entity,
}: {
  section?: PageSection;
  entity: EntityKnowledge;
}) {
  const data = section?.data as { imageUrl?: string } | undefined;
  const kindLabel =
    entity.organizationType && entity.organizationType !== "unknown"
      ? entity.organizationType
      : (entity.placeType ?? entity.kind);
  const when = formatEventWhen(
    entity.startTime,
    entity.endTime,
    entity.timePrecision,
  );

  return (
    <header className="pt-10">
      {data?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.imageUrl}
          alt={entity.name}
          className="border-border h-72 w-full rounded-2xl border object-cover"
        />
      ) : (
        <div className="border-border bg-muted/40 flex h-56 w-full items-center justify-center rounded-2xl border border-dashed">
          <p className="text-muted-foreground text-sm">No photograph yet</p>
        </div>
      )}
      <p className="text-muted-foreground mt-6 text-xs font-medium tracking-widest uppercase">
        {kindLabel}
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">{entity.name}</h1>
      {/* For an Event this is the fact the page exists to carry. Rendered
          beside the name rather than as a section, because a date is not
          something a traveller should have to scroll for. */}
      {when && (
        <p className="text-muted-foreground mt-3 text-base font-medium">
          {when}
        </p>
      )}
    </header>
  );
}

/** One section. Present sections render their knowledge; missing ones render the work. */
function Section({ section }: { section: PageSection }) {
  if (section.state === "missing") {
    return (
      <section className="border-border/60 rounded-xl border border-dashed p-5">
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          {section.title}
        </p>
        <p className="text-muted-foreground mt-2 text-sm">
          {section.missingLabel}
        </p>
        <button className="border-border hover:bg-muted mt-3 rounded-full border px-3.5 py-1.5 text-xs font-medium transition">
          {section.action}
        </button>
      </section>
    );
  }

  const d = section.data as Record<string, unknown>;

  return (
    <section>
      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {section.title}
      </p>

      {section.type === "overview" && (
        <p className="mt-3 text-lg leading-relaxed">{String(d.text)}</p>
      )}

      {section.type === "hours" && (
        <p className="mt-3 flex items-start gap-2.5 text-base">
          <Clock className="text-muted-foreground mt-1 h-4 w-4 shrink-0" />
          {String(d.text)}
        </p>
      )}

      {section.type === "contact" && (
        <div className="mt-3 flex flex-col gap-2 text-base">
          {!!d.phone && (
            <p className="flex items-center gap-2.5">
              <Phone className="text-muted-foreground h-4 w-4" />
              {String(d.phone)}
            </p>
          )}
          {!!d.website && (
            <a
              href={String(d.website)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
            >
              Official website
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      {section.type === "dining" && (
        <ul className="mt-3 flex flex-col gap-3">
          {(d.facts as { label: string; value: string }[]).map((fact) => (
            <li key={fact.label + fact.value}>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Utensils className="text-muted-foreground h-3.5 w-3.5" />
                {fact.label}
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                {fact.value}
              </p>
            </li>
          ))}
        </ul>
      )}

      {section.type === "location" && (
        <div className="mt-3">
          <p className="flex items-start gap-2.5 text-base">
            <MapPin className="text-muted-foreground mt-1 h-4 w-4 shrink-0" />
            {String(d.address)}
          </p>
          {!d.hasCoordinates && (
            <p className="text-muted-foreground mt-2 text-xs">
              Described in words, not coordinates — so this can&apos;t be mapped
              yet.
            </p>
          )}
        </div>
      )}

      {section.type === "nearby" && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {(d.related as RelatedEntity[]).map((r) => (
            <li key={r.id}>
              <Link
                href={`/passport/${r.id}`}
                className="border-border hover:border-foreground/40 inline-block rounded-full border px-3.5 py-1.5 text-sm transition"
              >
                {r.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {section.type === "gallery" && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(d.images as string[]).map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={src}
              src={src}
              alt=""
              className="border-border h-32 w-full rounded-lg border object-cover"
            />
          ))}
        </div>
      )}

      {section.type === "planning" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ...((d.activities as string[]) ?? []),
            ...((d.facilities as string[]) ?? []),
          ].map((item) => (
            <span
              key={item}
              className="border-border rounded-full border px-3 py-1 text-sm"
            >
              {item}
            </span>
          ))}
        </div>
      )}

      {section.type === "sources" && (
        <ul className="mt-3 flex flex-col gap-2">
          {(d.sources as SourceSummary[]).map((s) => (
            <li key={s.id} className="text-sm">
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
              >
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
                {s.sourceType}
              </a>
              <span className="text-muted-foreground ml-2 text-xs">
                {s.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

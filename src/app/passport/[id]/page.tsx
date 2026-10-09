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
import { ComposedOctoberSubject } from "@/components/october/detail/ComposedOctoberSubject";
import { CuratedSubjectPage } from "@/components/passport/CuratedSubject";
import { curationFor } from "@/lib/passport/curation/october2026";
import { isOctoberSubject } from "@/domain/passport/octoberContext";
import type { SubjectPageView } from "@/lib/passport/subjectPage";
import { currentUser } from "@/lib/auth/currentUser";
import {
  OctoberActions,
  OctoberProvenance,
  OctoberShell,
} from "@/components/october/detail/OctoberShell";
import { SaveToOctober } from "@/components/october/detail/SaveToOctober";
import { BeforeYouGo } from "@/components/october/environment/BeforeYouGo";
import { briefingFor } from "@/lib/environment/briefing";
import {
  actionsFor,
  composedFactSections,
} from "@/domain/passport/detailComposition";
import { isOctoberKind } from "@/lib/october/types";
import { octoberThingsFor } from "@/lib/october/octoberThings";
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

/**
 * **The tab, the bookmark and the shared link say what the thing is.**
 *
 * This read `Passport — 32e9c9e2`: eight characters of a uuid, which is what
 * a person saw in their tab and what they got if they sent the link to
 * somebody. The subject's own name is one cached read away — the page below
 * asks for exactly the same composition, and `getSubjectDetail` answers the
 * second caller from memory — so naming it costs nothing.
 *
 * Still `noindex`: a traveller page assembled live from Atlas is not a
 * published document, and that was a deliberate decision rather than an
 * oversight this is tidying.
 */
export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const hinted = KINDS.find((k) => k === query.kind);
  const on = typeof query.on === "string" ? query.on : undefined;

  const compositions = await Promise.all(
    (hinted ? [hinted] : KINDS).map((kind) =>
      getSubjectDetail(kind, id, on).catch(() => null),
    ),
  );
  const named = compositions.find((c) => c)?.root.name.trim();

  return {
    // The uuid stays as the fallback rather than a cheerful invention: a
    // subject Atlas cannot compose has no name to print.
    title: named ? `${named} — October` : `Passport — ${id.slice(0, 8)}`,
    robots: { index: false, follow: false },
  };
}

/**
 * The composed-detail routes, in the order a miss falls through them. Shared
 * with the page itself so the title and the body ask the same question — and
 * therefore hit the same cache entry.
 */
const KINDS = ["organizations", "experiences", "events"] as const;

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

  // A subject Atlas composes is rendered from the composed read alone.
  //
  // **Asked all at once, resolved in priority order.** This was a serial loop
  // — Organization, then Experience, then Event — and each miss costs a full
  // Atlas round trip. Measured on 2026-10-01 those round trips were ~17
  // seconds each, so an Event, which is tried last and is most of October,
  // took **56 seconds** to open. Asking in parallel makes the slowest case
  // one round trip instead of three.
  //
  // The order below is unchanged and still decides which composition wins:
  // October Discover routes an Organization card to its Organization id, so
  // an Organization is the likeliest arrival.
  //
  // A caller that already knows the kind says so with `?kind=`, and then only
  // one read happens. Discovery knows it — the possibility carries it — so the
  // common path costs Atlas one query instead of three. An unknown or absent
  // hint falls back to asking all three, so no link can break by omitting it.
  const hinted = KINDS.find((k) => k === query.kind);
  const asking = hinted ? [hinted] : KINDS;
  const compositions = await Promise.all(
    asking.map((kind) => getSubjectDetail(kind, id, on).catch(() => null)),
  );

  for (const composition of compositions) {
    if (composition) {
      const view = subjectPageView(composition);
      // **One route, one read, two arrangements.** A subject a human put in
      // the October launch collection gets the curated layout; every other
      // subject in Atlas renders exactly as it did before, from the same view.
      const curation = curationFor(id);
      // **Context, decided from the subject rather than from how you got
      // here.** A curated subject is October's; so is anything whose own
      // evidence puts it inside the month, which is what Discovery surfaces.
      // Clicking an October card used to land on a cream dossier, and a
      // refresh used to change the product.
      const october = isOctoberSubject(view);
      const save = october ? await saveControl(view) : null;
      // What the conditions mean for *this* thing, on its own next day, at
      // its own place. Null for an indoor subject on an ordinary evening,
      // for anything beyond the forecast, and for everything unclassified.
      const briefing = october
        ? await briefingFor(
            view,
            typeof query.sim === "string" ? query.sim : undefined,
          )
        : null;
      const actions = october
        ? octoberFoot(view, Boolean(curation), save)
        : null;
      return (
        // The theme sits on the page wrapper, not inside the renderer, so it
        // covers the whole viewport rather than a column floating on the
        // default background.
        <main
          className="bg-background min-h-screen"
          {...(october ? { "data-theme": "october" } : {})}
        >
          {curator && <CuratorBar id={id} />}
          {october ? (
            <OctoberShell
              backTo={
                query.from === "october" ? "/october/discover" : undefined
              }
              backLabel={
                query.from === "october" ? "Back to October" : undefined
              }
              actions={actions}
            >
              {curation ? (
                <>
                  <CuratedSubjectPage
                    view={view}
                    curation={curation}
                    save={save}
                  />
                  {briefing ? <BeforeYouGo read={briefing} /> : null}
                </>
              ) : (
                <>
                  <ComposedOctoberSubject view={view} save={save} />
                  {briefing ? <BeforeYouGo read={briefing} /> : null}
                </>
              )}
            </OctoberShell>
          ) : curation ? (
            <CuratedSubjectPage view={view} curation={curation} />
          ) : (
            <ComposedSubjectPage view={view} />
          )}
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

/**
 * **Save to My October, drawn once and placed by the page.**
 *
 * Saving needs a signed-in person and a kind My October can actually hold, so
 * this is absent where either is. Everything else about it — where it sits,
 * what it sits beside — belongs to the renderer, because the hero of a
 * bespoke experience and the hero of a composed one look nothing alike and
 * still have to put this control in the same place.
 */
async function saveControl(view: SubjectPageView) {
  const kind = view.subject.kind;
  if (!isOctoberKind(kind)) return null;
  const user = await currentUser().catch(() => null);
  const saved = user
    ? await octoberThingsFor(user)
        .then((things) => things.some((t) => t.entityId === view.subject.id))
        .catch(() => false)
    : false;
  return (
    <SaveToOctober
      entityId={view.subject.id}
      entityKind={kind}
      name={view.subject.name}
      startsAt={view.subject.startTime ?? null}
      initiallySaved={saved}
      signedIn={Boolean(user)}
    />
  );
}

/**
 * **The foot of an October page: what to do next, and where it all came from.**
 *
 * Both halves are repeated deliberately. Somebody who has just read four
 * paragraphs about a haunted house has scrolled a long way from the hero, and
 * "now what" is a fair question to answer twice. The two Save buttons share
 * one state, so they can never disagree about whether it is kept.
 *
 * It appears only where there is a page to have read. A subject Atlas knows
 * one sentence about ends at its hero, and a person who has not moved should
 * not be handed the same two buttons again three inches lower — that is the
 * empty-container version of consistency, which is worse than none.
 */
function octoberFoot(
  view: SubjectPageView,
  curated: boolean,
  save: React.ReactNode,
) {
  const external = actionsFor(view);
  const { sections, hidden } = composedFactSections(view, external);
  // Curated pages are curated precisely because they have a great deal to
  // show; a composed one has a body when Atlas gave it something to put there.
  const hasBody =
    curated ||
    sections.length > 0 ||
    view.parts.length > 0 ||
    view.offerings.length > 0;

  return (
    <>
      {/* Only where the publisher has somewhere to send a decided person.
          A box holding one Save button and an empty rule under it is the
          empty-container version of consistency: the hero already has it. */}
      {hasBody && external.length > 0 && (
        <OctoberActions
          save={save}
          external={
            <>
              {external.map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={
                    action.kind === "tickets"
                      ? "inline-flex min-h-11 items-center rounded-full bg-[#d09a4e] px-5 text-sm font-medium text-[#1a1207] transition-opacity hover:opacity-90"
                      : "inline-flex min-h-11 items-center rounded-full border border-[#e9e6da]/25 px-5 text-sm text-[#e9e6da]/85 transition-colors hover:border-[#d09a4e]/60 hover:text-[#f3efe4]"
                  }
                >
                  {action.label}
                </a>
              ))}
            </>
          }
          note={
            external.some((a) => a.kind === "tickets")
              ? "Booking, tickets and terms are handled on their site."
              : undefined
          }
        />
      )}
      {/* A curated page carries its own evidence drawer, with its curated
          media and its own held-back list. Rendering this one as well printed
          the same summary twice on the reference page. */}
      {!curated && (
        <OctoberProvenance
          sources={view.sources.map((s) => ({
            id: s.id,
            url: s.url,
            ...(s.sourceType ? { sourceType: s.sourceType } : {}),
          }))}
          hidden={hidden}
        />
      )}
    </>
  );
}

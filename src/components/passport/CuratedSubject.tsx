import { CalendarDays, ChevronRight, MapPin, Ticket } from "lucide-react";
import {
  formatStatedDay,
  type SubjectPageView,
} from "@/lib/passport/subjectPage";
import { formatEventWhen } from "@/domain/experience/eventTime";
import {
  actionsFor,
  urlIn,
  whenSummary,
  whereLine,
} from "@/domain/passport/detailComposition";
import { partitionFacts, restates } from "@/domain/passport/factVisibility";
import {
  curatedAssets,
  placedFactLabels,
  type Curation,
} from "@/lib/passport/curation/october2026";

/**
 * **A subject in the October 2026 curated launch collection.**
 *
 * ## Why this exists beside `ComposedSubjectPage` rather than replacing it
 *
 * The ordinary renderer is honest and deliberately plain: it prints what Atlas
 * holds, in one column, and says so. That is the right page for a subject
 * nobody has finished. It is the wrong page for twenty subjects a human picked
 * for launch, where the data is already rich and the presentation is the only
 * thing between it and something worth shipping.
 *
 * So: one route, one `subjectPageView`, the same `detailComposition` helpers
 * for when, where and what to do next — and a different arrangement of them.
 * Nothing here re-reads Atlas, and nothing here knows about Field of Screams.
 * Every subject-specific decision arrives as a `Curation`.
 *
 * ## Nothing on this page is invented
 *
 * Every price, every maze description, every line under *Know before you go*
 * is an Atlas key fact printed verbatim. Curation chose which section each one
 * sits in and what order they read in; it wrote none of them. The one piece of
 * human prose is `editorialSummary`, which is a lead written from what Atlas
 * holds and is marked as such in the register.
 *
 * Media is the same discipline: each asset carries the page it came from, and
 * the evidence drawer lists them, so a reader can check that the photograph of
 * a maze is the maze's own poster and not a stock pumpkin.
 */
export function CuratedSubjectPage({
  view,
  curation,
  save,
}: {
  view: SubjectPageView;
  curation: Curation;
  /**
   * Save to My October. Drawn by the route, placed here — at the end of the
   * hero, on its own line under the publisher's buttons — because every
   * October subject puts it in the same place, however different the page
   * above it looks.
   */
  save?: React.ReactNode;
}) {
  const { subject } = view;
  const actions = actionsFor(view);
  const where = whereLine(view);
  const when = whenSummary(view);

  const whenLine = subject.startTime
    ? (formatEventWhen(
        subject.startTime,
        subject.endTime,
        subject.timePrecision as "day" | "minute" | undefined,
      ) ?? formatStatedDay(when.days[0] ?? ""))
    : when.days.length > 0
      ? `${formatStatedDay(when.days[0]!)}${when.days.length > 1 ? ` – ${formatStatedDay(when.days[when.days.length - 1]!)}` : ""}`
      : undefined;

  const factByLabel = new Map(subject.facts.map((f) => [f.label, f]));
  const valueOf = (label: string) => factByLabel.get(label)?.value;

  // The primary call to action is a URL a publisher printed inside a fact —
  // never constructed, never guessed. Absent if that fact holds no link.
  const ctaHref = curation.featuredCta
    ? urlIn(valueOf(curation.featuredCta.factLabel) ?? "")
    : undefined;
  const secondary = actions.filter((a) => a.href !== ctaHref);

  const { visible, hidden } = partitionFacts(
    subject.facts.map((f) => ({ label: f.label, value: f.value })),
    {
      ...(whenLine ? { when: whenLine } : {}),
      ...(where ? { where } : {}),
      description: subject.description,
      placed: placedFactLabels(curation),
    },
  );

  // **Every fact under a label, not the first one.** A ticketing page states
  // `Price = $35.00 Adult` and `Price = $33.00 Senior (60+)`; a lookup keyed
  // by label printed the adult amount twice and lost the concession.
  const groups = (curation.groups ?? [])
    .map((g) => ({
      ...g,
      facts: g.factLabels.flatMap((l) =>
        subject.facts.filter((f) => f.label === l && f.value?.trim()),
      ),
    }))
    .filter((g) => g.facts.length > 0);

  // A tile is a way in, never a replacement for the sentence it came from —
  // the fact itself still prints in its group below.
  const highlights = (curation.highlights ?? []).filter((h) =>
    subject.facts.some((f) => f.label === h.factLabel && f.value?.trim()),
  );

  const tiers = (curation.pricing?.tiers ?? [])
    .map((t) => ({ ...t, amount: valueOf(t.factLabel) }))
    .filter((t): t is typeof t & { amount: string } => Boolean(t.amount));

  const cards = (curation.cards?.items ?? [])
    .map((c) => ({ ...c, body: valueOf(c.factLabel) }))
    .filter((c): c is typeof c & { body: string } => Boolean(c.body));

  const assets = curatedAssets(curation);
  /** Whether anything was printed between the hero and the foot of the page. */
  const bodyPrinted =
    cards.length > 0 ||
    tiers.length > 0 ||
    groups.length > 0 ||
    visible.length > 0 ||
    highlights.length > 0;
  // A flyer is not a backdrop. Video always wins the hero, because a video is
  // never a poster.
  const poster = !curation.heroVideo && curation.heroImage?.fit === "panel";
  const sourceCount = view.sources?.length ?? 0;

  return (
    <div className="october-page text-foreground">
      {/* ---------------- HERO ----------------
          A poster stands beside the title; everything else sits behind it.
          See `CuratedAsset.fit`. */}
      <header
        className={
          poster
            ? "mx-auto grid w-full max-w-6xl items-center gap-8 px-6 pt-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14 lg:px-10"
            : "relative isolate flex min-h-[78vh] items-end overflow-hidden sm:min-h-[86vh]"
        }
      >
        {poster && (
          <div className="october-edge border-border/60 bg-card order-2 min-w-0 overflow-hidden rounded-2xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={curation.heroImage!.url}
              alt={curation.heroImage!.caption}
              className="h-auto w-full object-contain"
            />
          </div>
        )}
        {!poster && (
          <div className="absolute inset-0 -z-10">
            {curation.heroVideo ? (
              <video
                className="october-hero-video h-full w-full object-cover"
                src={curation.heroVideo.url}
                poster={curation.heroImage?.url}
                autoPlay
                muted
                loop
                playsInline
                aria-label={curation.heroVideo.caption}
              />
            ) : curation.heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={curation.heroImage.url}
                alt=""
                // A photograph may be cropped; a chart may not. The Draco chart
                // is square and its whole area is the information — cropped into
                // a tall phone hero it lost the constellation it exists to show.
                className={`h-full w-full ${
                  curation.heroImage.fit === "contain"
                    ? "object-contain object-top"
                    : "object-cover"
                }`}
              />
            ) : null}
            {/* Legibility, not decoration: the text below sits on footage whose
                brightness nobody controls. */}
            <div className="from-background via-background/70 absolute inset-0 bg-gradient-to-t to-transparent" />
            <div className="from-background/90 absolute inset-0 bg-gradient-to-r to-transparent" />
          </div>
        )}

        <div
          className={
            poster
              ? "order-1 min-w-0"
              : "mx-auto w-full max-w-6xl px-6 pt-32 pb-14 sm:pb-20 lg:px-10"
          }
        >
          {curation.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={curation.logo.url}
              alt={subject.name}
              className="mb-6 w-56 max-w-full drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] sm:w-72"
            />
          ) : (
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
              {subject.name}
            </h1>
          )}
          {curation.logo && <h1 className="sr-only">{subject.name}</h1>}

          {curation.eyebrow && (
            <p className="text-primary text-sm font-semibold tracking-[0.2em] uppercase">
              {curation.eyebrow}
            </p>
          )}

          <p className="mt-4 max-w-3xl text-xl leading-relaxed text-balance sm:text-2xl lg:text-3xl lg:leading-[1.35]">
            {curation.editorialSummary ?? subject.description}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 text-base">
            {whenLine && (
              <span className="flex items-center gap-2.5">
                <CalendarDays className="text-primary h-5 w-5 shrink-0" />
                {whenLine}
              </span>
            )}
            {where && (
              <span className="flex items-center gap-2.5">
                <MapPin className="text-primary h-5 w-5 shrink-0" />
                {where}
              </span>
            )}
          </div>

          <div className="mt-9 flex flex-wrap gap-3">
            {ctaHref && (
              <a
                href={ctaHref}
                target="_blank"
                rel="noreferrer noopener"
                className="bg-primary text-primary-foreground inline-flex min-h-12 items-center gap-2 rounded-full px-7 text-base font-semibold shadow-lg transition hover:brightness-110"
              >
                <Ticket className="h-5 w-5" />
                {curation.featuredCta!.label}
              </a>
            )}
            {secondary.map((a) => (
              <a
                key={a.href}
                href={a.href}
                target="_blank"
                rel="noreferrer noopener"
                className="border-border/80 bg-card/60 inline-flex min-h-12 items-center rounded-full border px-6 text-base backdrop-blur transition hover:brightness-125"
              >
                {a.label}
              </a>
            ))}
          </div>

          {/* Ours, under theirs. Booking is the publisher's; keeping it is
              this product's, and a person should not have to reach the foot
              of a long page to find that out. */}
          {save && <div className="mt-5">{save}</div>}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-28 lg:px-10">
        {/* ---------------- HIGHLIGHTS ----------------
            Two or three numbers a person needs before anything else, each
            carrying the condition its source attached. The sentence they came
            from is printed in full further down. */}
        {highlights.length > 0 && (
          <section
            data-testid="curated-highlights"
            className="border-border/60 grid gap-6 border-t py-12 sm:grid-cols-3"
          >
            {highlights.map((h) => (
              <div key={h.factLabel}>
                <p className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {h.display}
                </p>
                {h.caption && (
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {h.caption}
                  </p>
                )}
              </div>
            ))}
          </section>
        )}

        {/* ---------------- THE EXPERIENCE ----------------
            A lead written from Atlas's own sentence sometimes *is* Atlas's own
            sentence. Fall Fest printed "An afternoon at Paynter's Fruit
            Market, put on by the City of West Kelowna" and then, under a
            heading, "A festival event hosted by the City of West Kelowna at
            Paynter's Fruit Market" — one fact, twice, looking like two. */}
        {curation.editorialSummary &&
          subject.description &&
          !restates(subject.description, curation.editorialSummary) && (
            <section className="border-border/60 grid gap-8 border-t py-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                The experience
              </h2>
              <p className="text-lg leading-relaxed lg:text-xl">
                {subject.description}
              </p>
            </section>
          )}

        {/* ---------------- CARDS (the mazes) ---------------- */}
        {cards.length > 0 && (
          <section className="border-border/60 border-t py-14">
            <SectionHeading
              title={curation.cards!.title}
              intro={
                curation.cards!.introFactLabel
                  ? valueOf(curation.cards!.introFactLabel)
                  : undefined
              }
            />
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((c) => (
                <article
                  key={c.factLabel}
                  className="october-edge border-border/60 bg-card group flex flex-col overflow-hidden rounded-2xl border"
                >
                  {c.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.image.url}
                      alt={c.image.caption}
                      className="aspect-[3/4] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {c.eyebrow && (
                          <p className="text-primary text-[11px] font-semibold tracking-[0.18em] uppercase">
                            {c.eyebrow}
                          </p>
                        )}
                        <h3 className="mt-1 text-lg font-semibold">
                          {c.title ?? c.factLabel}
                        </h3>
                      </div>
                      {c.mark && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.mark.url}
                          alt=""
                          aria-hidden
                          className="mt-0.5 h-8 w-8 shrink-0 opacity-45"
                        />
                      )}
                    </div>
                    <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                      {c.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ---------------- PRICING ---------------- */}
        {tiers.length > 0 && (
          <section className="border-border/60 border-t py-14">
            <SectionHeading title={curation.pricing!.title} />
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {tiers.map((t) => (
                <div
                  key={t.factLabel}
                  className={`october-edge flex flex-col rounded-2xl border p-6 ${
                    t.featured
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/60 bg-card"
                  }`}
                >
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight">
                    {t.amount}
                  </p>
                  {t.detail && (
                    <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                      {t.detail}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 space-y-1.5">
              {(curation.pricing!.notes ?? [])
                .map((n) => ({ note: n, fact: factByLabel.get(n.factLabel) }))
                .filter(
                  (
                    x,
                  ): x is {
                    note: typeof x.note;
                    fact: NonNullable<typeof x.fact>;
                  } => Boolean(x.fact?.value?.trim()),
                )
                .map(({ note, fact }) => (
                  <p
                    key={`${fact.label}|${fact.value}`}
                    className="text-muted-foreground text-sm"
                  >
                    {note.prefix ? `${note.prefix}: ` : ""}
                    {fact.value}
                  </p>
                ))}
            </div>
            {ctaHref && (
              <a
                href={ctaHref}
                target="_blank"
                rel="noreferrer noopener"
                className="bg-primary text-primary-foreground mt-8 inline-flex min-h-12 items-center gap-2 rounded-full px-7 text-base font-semibold transition hover:brightness-110"
              >
                <Ticket className="h-5 w-5" />
                {curation.featuredCta!.label}
              </a>
            )}
          </section>
        )}

        {/* ---------------- KNOW BEFORE YOU GO ---------------- */}
        {groups.length > 0 && (
          <section
            className="border-border/60 relative isolate overflow-hidden border-t py-14"
            style={
              curation.texture
                ? {
                    backgroundImage: `url(${curation.texture.url})`,
                    backgroundSize: "540px",
                  }
                : undefined
            }
          >
            {curation.texture && (
              <div
                className="bg-background/93 absolute inset-0 -z-10"
                aria-hidden
              />
            )}
            <SectionHeading title="Know before you go" />
            <div className="mt-10 grid gap-x-10 gap-y-9 md:grid-cols-2 lg:grid-cols-3">
              {groups.map((g) => (
                <div key={g.id}>
                  <h3 className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
                    {g.title}
                  </h3>
                  <dl className="mt-3 space-y-3">
                    {g.facts.map((f) => (
                      <div key={`${f.label}|${f.value}`}>
                        <dt className="text-sm font-medium">{f.label}</dt>
                        <dd className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                          {f.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Anything Atlas holds that curation did not place and the page does
              not already say. Never hidden — a fact nobody grouped is still a
              fact, and a curator seeing it here knows there is a group missing. */}
        {visible.length > 0 && (
          <section className="border-border/60 border-t py-14">
            <SectionHeading title="Also worth knowing" />
            <dl className="mt-8 grid gap-x-10 gap-y-4 md:grid-cols-2">
              {visible.map((f) => (
                <div key={`${f.label}-${f.value.slice(0, 12)}`}>
                  <dt className="text-sm font-medium">{f.label}</dt>
                  <dd className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* ---------------- WHERE ----------------
            Repeated at the foot of a page somebody has scrolled — not on a
            page that ends where it began. Fall Fest holds no facts, so its
            "Where" sat two inches under the identical line in the hero, with
            the third copy of Directions in it. */}
        {where && bodyPrinted && (
          <section className="border-border/60 border-t py-14">
            <SectionHeading title="Where" />
            <div className="october-edge border-border/60 bg-card mt-8 flex flex-wrap items-center justify-between gap-6 rounded-2xl border p-6">
              <p className="text-lg">{where}</p>
              {actions
                .filter((a) => a.kind === "directions")
                .map((a) => (
                  <a
                    key={a.href}
                    href={a.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="border-border inline-flex min-h-11 items-center gap-1.5 rounded-full border px-5 text-sm transition hover:brightness-125"
                  >
                    {a.label}
                    <ChevronRight className="h-4 w-4" />
                  </a>
                ))}
            </div>
          </section>
        )}

        {/* ---------------- PROVENANCE, available and not dominant ---------------- */}
        <section className="border-border/60 border-t py-12">
          <details className="group">
            <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-2 text-sm">
              <ChevronRight className="h-4 w-4 transition group-open:rotate-90" />
              Verified from {sourceCount} source{sourceCount === 1 ? "" : "s"}
              {assets.length > 0 && ` · ${assets.length} curated assets`}
            </summary>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold tracking-[0.18em] uppercase">
                  Sources
                </h3>
                <ul className="mt-3 space-y-1.5">
                  {(view.sources ?? []).map((s) => (
                    <li
                      key={s.id}
                      className="text-muted-foreground text-sm break-all"
                    >
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="hover:text-foreground underline underline-offset-2"
                      >
                        {s.url.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold tracking-[0.18em] uppercase">
                  Curated media
                </h3>
                <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                  Selected by hand from the subject&rsquo;s own site. Each is
                  listed with the page it was taken from.
                </p>
                <ul className="mt-3 space-y-1.5">
                  {assets.map((a) => (
                    <li key={a.url} className="text-muted-foreground text-sm">
                      {a.caption} —{" "}
                      <a
                        href={a.provenance}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="hover:text-foreground underline underline-offset-2"
                      >
                        {a.provenance.replace(/^https?:\/\/(www\.)?/, "")}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {hidden.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xs font-semibold tracking-[0.18em] uppercase">
                  Held by Atlas, not printed here
                </h3>
                <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                  Nothing is removed from Atlas. These are facts this page
                  already says better somewhere else.
                </p>
                <ul className="mt-3 space-y-1">
                  {hidden.map((f) => (
                    <li
                      // Two facts can share a label and a rule — a ticketing
                      // page states `Price` once per tier — so the value is
                      // part of what makes this row itself.
                      key={`${f.label}|${f.value}|${f.rule}`}
                      className="text-muted-foreground text-xs"
                    >
                      <span className="font-medium">{f.label}</span> — {f.rule}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </details>
        </section>
      </main>
    </div>
  );
}

function SectionHeading({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="max-w-3xl">
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {intro && (
        <p className="text-muted-foreground mt-3 text-lg leading-relaxed">
          {intro}
        </p>
      )}
    </div>
  );
}

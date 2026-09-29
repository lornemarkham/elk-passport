import type { ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import {
  formatStatedDay,
  type OfferingView,
  type SubjectPageView,
  type SubjectView,
} from "@/lib/passport/subjectPage";
import {
  actionsFor,
  attendableParts,
  composedFactSections,
  renderedWhen,
  whenSummary,
  whereLine,
} from "@/domain/passport/detailComposition";
import { OctoberHero } from "./OctoberHero";

/**
 * **Every October subject nobody curated.**
 *
 * ## The gap this closes
 *
 * Four subjects were composed by hand and looked like a product. The other
 * thirty arrived through the same lanes, on the same dark canvas, and rendered
 * as the plain evidence view: one column, every key fact at one weight, the
 * publisher's own paragraph flattened into a `label — value` row, and —
 * measured on the Salute to the Sockeye page — `Start`, `End`, `Event
 * Category` and `Website` printed underneath a WHEN block, an eyebrow and two
 * buttons that already said all four.
 *
 * Nothing was false. It simply was not composed, and a person who clicked a
 * card that looked like October landed on a database view of it.
 *
 * ## The same language, driven by evidence instead of by a register
 *
 * `CuratedSubjectPage` arranges a hand-written `Curation`. This arranges what
 * Atlas holds, through the same helpers — `actionsFor`, `whenSummary`,
 * `whereLine`, `factSections`, `partitionFacts` — and every section appears
 * only because its evidence does:
 *
 * ```
 * a lead image Atlas chose   → a hero photograph
 * none                       → a typographic hero, and no placeholder
 * parts a person can attend  → Ways to go
 * a value shaped like prose  → its own block, in the publisher's words
 * a value shaped like a row  → a row
 * a venue or an address      → Where, and a directions link
 * ```
 *
 * A subject holding none of that renders a title, a sentence and a way back.
 * That is the honest page for a thing nobody has finished researching, and
 * padding it would be the one thing this product must never do: twenty-five
 * of the thirty-four subjects October surfaces have a lead image, and the nine
 * without one are allowed to look like it.
 *
 * ## Nothing here is written by Passport
 *
 * Every sentence on the page is Atlas's, printed verbatim. Curation of this
 * kind chooses arrangement and weight only — which is also why the facts this
 * page decides not to print are listed, by rule, in the provenance drawer at
 * the bottom rather than quietly dropped.
 */
export function ComposedOctoberSubject({
  view,
  save,
}: {
  readonly view: SubjectPageView;
  /**
   * Save to My October, drawn by the route because it needs the session.
   * It sits at the end of the hero on every October subject, bespoke or
   * composed, so a person never has to find out how long a page is before
   * they can keep the thing it is about.
   */
  readonly save?: ReactNode;
}) {
  const { subject } = view;
  const actions = actionsFor(view);
  const where = whereLine(view);
  const when = whenSummary(view);
  const parts = attendableParts(view);

  const whenLine = renderedWhen(view);

  // One decision, made in `detailComposition` so the provenance drawer at the
  // bottom of the page lists exactly what this body held back.
  const { sections } = composedFactSections(view, actions);

  return (
    <div className="october-page text-foreground">
      <HeroFrame imageUrl={subject.imageUrl}>
        <p className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
          {subject.subtype ?? subject.kind}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {subject.name}
        </h1>
        {when.edition && when.edition !== subject.name && (
          <p className="text-muted-foreground mt-2 text-base">{when.edition}</p>
        )}
        {subject.description && (
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-balance sm:text-xl">
            {subject.description}
          </p>
        )}
        {(whenLine || where) && (
          <div className="mt-7 flex flex-wrap items-center gap-x-8 gap-y-3 text-base">
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
            {/* A list of nights is not an interval, and saying how many
                  there are is the difference between "sometime in October"
                  and a plan. */}
            {!subject.startTime && when.days.length > 1 && !when.isRange && (
              <span className="text-muted-foreground">
                {when.days.length} dates
              </span>
            )}
          </div>
        )}

        {/* Theirs on one line, ours on the next. The publisher owns booking
              and terms; Passport owns keeping it. A single row would blur two
              different promises together. */}
        {(actions.length > 0 || save) && (
          <div className="mt-8 flex flex-col items-start gap-4">
            {actions.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {actions.map((action) => (
                  <a
                    key={action.href}
                    href={action.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={
                      action.kind === "tickets"
                        ? "bg-primary text-primary-foreground inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold transition hover:brightness-110"
                        : "border-border/80 bg-card/60 inline-flex min-h-11 items-center rounded-full border px-5 text-sm backdrop-blur transition hover:brightness-125"
                    }
                  >
                    {action.label}
                  </a>
                ))}
              </div>
            )}
            {save}
          </div>
        )}
      </HeroFrame>

      <main className="mx-auto w-full max-w-5xl px-5 pb-2 sm:px-8">
        {parts.length > 0 && (
          <Section title="Ways to go">
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {parts.map((part) => (
                <PartCard key={part.id} part={part} />
              ))}
            </div>
          </Section>
        )}

        {view.offerings.map((offering) => (
          <Offering key={offering.subject.id} offering={offering} />
        ))}

        {sections.length > 0 && (
          <Section title="Good to know">
            <div className="mt-6 flex flex-col gap-10">
              {sections.map((section, index) => (
                <div key={section.title ?? `section-${index}`}>
                  {section.title && (
                    <h3 className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
                      {section.title}
                    </h3>
                  )}
                  {section.prose.length > 0 && (
                    <div className="mt-4 flex max-w-3xl flex-col gap-6">
                      {section.prose.map((fact) => (
                        <div key={`${fact.label}|${fact.value}`}>
                          <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                            {fact.label}
                          </p>
                          <p className="mt-2 leading-relaxed whitespace-pre-line">
                            {fact.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  {section.details.length > 0 && (
                    <dl className="mt-5 grid gap-x-10 gap-y-4 sm:grid-cols-2">
                      {section.details.map((fact) => (
                        <div key={`${fact.label}|${fact.value}`}>
                          <dt className="text-sm font-medium">{fact.label}</dt>
                          <dd className="text-muted-foreground mt-0.5 text-sm leading-relaxed whitespace-pre-line">
                            {fact.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* No "Where" block. The hero already names the venue and the action
            row below already carries Directions — a third copy of one address
            is how a composed page slides back into being a record dump. */}
      </main>
    </div>
  );
}

/**
 * The hero, with or without a picture.
 *
 * A subject whose media lane chose nothing leads with its own words on the
 * dark canvas — which is a real hero, not a broken one. Where there is an
 * image, `OctoberHero` decides how to show it from the image's own shape.
 */
function HeroFrame({
  imageUrl,
  children,
}: {
  readonly imageUrl?: string;
  readonly children: ReactNode;
}) {
  if (imageUrl)
    return <OctoberHero imageUrl={imageUrl}>{children}</OctoberHero>;
  return (
    <header className="mx-auto w-full max-w-5xl px-5 pt-14 sm:px-8">
      {children}
    </header>
  );
}

/**
 * One way to attend, with its own nights and its own prices.
 *
 * Nothing is summed and no "from $x" is computed: a mode's facts are the
 * publisher's rows, and a part with none shows fewer lines.
 */
function PartCard({ part }: { part: SubjectView }) {
  return (
    <Link
      href={`/passport/${part.id}`}
      data-testid="part-card"
      className="october-edge border-border/60 bg-card hover:border-primary/50 block rounded-2xl border p-5 transition"
    >
      <p className="font-semibold">{part.name}</p>
      {part.description && (
        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
          {part.description}
        </p>
      )}
      {part.days.length > 0 && (
        <p className="text-muted-foreground mt-3 text-xs tabular-nums">
          {formatStatedDay(part.days[0]!)}
          {part.days.length > 1 &&
            ` – ${formatStatedDay(part.days[part.days.length - 1]!)}`}
          {part.days.length > 1 && ` · ${part.days.length} dates`}
        </p>
      )}
      {part.facts.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {part.facts
            .filter((f) => f.value !== part.description)
            .slice(0, 5)
            .map((f) => (
              <li
                key={`${f.label}|${f.value}`}
                className="flex justify-between gap-3 text-sm"
              >
                <span className="text-muted-foreground shrink-0">
                  {f.label}
                </span>
                {/* A price is three characters and a rule is a sentence, and
                    this list holds both. The value wraps rather than pushing
                    the card past the width of a phone. */}
                <span className="min-w-0 text-right tabular-nums">
                  {f.value}
                </span>
              </li>
            ))}
        </ul>
      )}
    </Link>
  );
}

/** What an organisation is actually putting on, and where. */
function Offering({ offering }: { offering: OfferingView }) {
  const { subject, venue } = offering;
  return (
    <Section title="What's on">
      <h2 className="mt-4 text-2xl font-semibold tracking-tight">
        {subject.name}
      </h2>
      {subject.description && (
        <p className="mt-2 max-w-3xl leading-relaxed">{subject.description}</p>
      )}
      {venue && (
        <p className="text-muted-foreground mt-3 flex items-start gap-2.5 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          Hosted at {venue.name}
          {venue.address ? ` · ${venue.address}` : ""}
        </p>
      )}
    </Section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border/60 mt-12 border-t pt-10">
      <h2 className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

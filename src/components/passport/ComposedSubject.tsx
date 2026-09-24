import Link from "next/link";
import { CalendarDays, Check, MapPin, Ticket } from "lucide-react";
import {
  formatStatedDay,
  type OfferingView,
  type SubjectPageView,
  type SubjectView,
} from "@/lib/passport/subjectPage";

/**
 * The traveller's view of a subject Atlas composed.
 *
 * Every line here came from one public Atlas read. Nothing is computed from a
 * date, nothing is merged between subjects, and where Atlas said *no claim I
 * hold states this day* the page says that sentence rather than "closed".
 *
 * Deliberately plain: this mission is about what the page can *say*, not what
 * it looks like. No October styling, no attraction-specific layout.
 */
export function ComposedSubjectPage({ view }: { view: SubjectPageView }) {
  const { subject, offerings } = view;

  return (
    <article className="mx-auto max-w-3xl px-6 pt-10 pb-24">
      <header>
        <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          {subject.subtype ?? subject.kind}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          {subject.name}
        </h1>
        {subject.description && (
          <p className="mt-4 text-lg leading-relaxed">{subject.description}</p>
        )}
        {subject.address && (
          <p className="text-muted-foreground mt-4 flex items-start gap-2.5 text-base">
            <MapPin className="mt-1 h-4 w-4 shrink-0" />
            {subject.address}
          </p>
        )}
        {/* A root that holds its own schedule — an Experience opened directly
            — states it here; a provider that holds none shows nothing. */}
        <Days subject={subject} />
      </header>

      {view.on && <DayAnswer view={view} />}

      {offerings.map((offering) => (
        <Offering key={offering.subject.id} offering={offering} />
      ))}

      {(view.offeredBy || view.partOf || view.venue) && (
        <Section title="Part of">
          <ul className="mt-3 flex flex-wrap gap-2">
            {[view.partOf, view.offeredBy, view.venue]
              .filter((s): s is SubjectView => s !== undefined)
              .map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/passport/${s.id}`}
                    className="border-border hover:border-foreground/40 inline-block rounded-full border px-3.5 py-1.5 text-sm transition"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
          </ul>
        </Section>
      )}

      {subject.facts.length > 0 && (
        <Section title="Good to know">
          <FactList subject={subject} />
        </Section>
      )}

      {view.sources.length > 0 && (
        <Section title="Where this comes from">
          <ul className="mt-3 flex flex-col gap-2">
            {view.sources.map((source) => (
              <li key={source.id} className="text-sm">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                >
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
                  {source.url.replace(/^https?:\/\/(www\.)?/, "")}
                </a>
                {source.retrievedAt && (
                  <span className="text-muted-foreground ml-2 text-xs">
                    read {source.retrievedAt.slice(0, 10)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}

/**
 * What Atlas said about the day the caller asked about.
 *
 * `stated: false` is rendered as Atlas's own sentence. Passport does not know
 * whether the thing is closed that day, and saying so would be inventing the
 * one fact the temporal model exists to withhold.
 */
function DayAnswer({ view }: { view: SubjectPageView }) {
  // Only subjects that actually hold a schedule are worth answering for. A
  // subject with no claim has nothing to say about any day, and printing that
  // for every parent and provider buries the two answers that matter.
  const rows = [
    ...view.offerings.flatMap((offering) => [
      offering.subject,
      ...offering.parts,
    ]),
    view.subject,
  ].filter((s) => s.day !== undefined && s.claims.length > 0);

  if (rows.length === 0) return null;

  return (
    <Section title={`On ${formatStatedDay(view.on!)}`}>
      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((s) => (
          <li key={s.id} className="flex items-start gap-2.5 text-sm">
            <CalendarDays className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-medium">{s.name}</span>{" "}
              <span className="text-muted-foreground">
                {s.day!.stated
                  ? "— the schedule Atlas holds states this day"
                  : `— ${s.day!.meaning}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** One offered thing, with the parts Atlas says it includes. Each keeps its own facts. */
function Offering({ offering }: { offering: OfferingView }) {
  const { subject, parts, venue } = offering;
  return (
    <Section title="What's on">
      <h2 className="mt-3 text-2xl font-semibold tracking-tight">
        {subject.name}
      </h2>
      {subject.description && (
        <p className="mt-2 leading-relaxed">{subject.description}</p>
      )}
      {venue && (
        <p className="text-muted-foreground mt-3 flex items-start gap-2.5 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          Hosted at {venue.name}
          {venue.address ? ` · ${venue.address}` : ""}
        </p>
      )}
      <Days subject={subject} />
      {subject.facts.length > 0 && (
        <div className="mt-5">
          <FactList subject={subject} />
        </div>
      )}

      {parts.map((part) => (
        <div
          key={part.id}
          className="border-border mt-8 rounded-2xl border p-5"
        >
          <p className="flex items-center gap-2 text-lg font-semibold">
            <Ticket className="text-muted-foreground h-4 w-4" />
            {part.name}
          </p>
          {part.description && (
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {part.description}
            </p>
          )}
          <Days subject={part} />
          {part.facts.length > 0 && (
            <div className="mt-4">
              <FactList subject={part} />
            </div>
          )}
        </div>
      ))}
    </Section>
  );
}

/** The days Atlas stated, formatted. No day is derived, filtered or extended here. */
function Days({ subject }: { subject: SubjectView }) {
  if (subject.days.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-widest uppercase">
        <CalendarDays className="h-3.5 w-3.5" />
        Dates the publisher states
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {subject.days.map((day) => (
          <li
            key={day}
            className="border-border rounded-full border px-2.5 py-1 text-xs tabular-nums"
          >
            {formatStatedDay(day)}
          </li>
        ))}
      </ul>
      {/* `unresolved` — what the reading could not carry from the passage,
          e.g. "time 18:00 is not in the passage" — is kept in the view and
          deliberately not shown here: it is a note to a curator about Atlas's
          own reading, not something a traveller can act on. */}
    </div>
  );
}

/** A subject's own facts, grouped by the publisher's own heading. Never another subject's. */
function FactList({ subject }: { subject: SubjectView }) {
  const groups = new Map<string, typeof subject.facts>();
  for (const fact of subject.facts) {
    // A publisher that writes one sentence twice — as the mode's summary and
    // as a fact — is quoted once. Nothing is dropped from the data.
    if (fact.value === subject.description) continue;
    const key = fact.category ?? "";
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }
  return (
    <div className="flex flex-col gap-5">
      {[...groups.entries()].map(([category, facts]) => (
        <div key={category || "ungrouped"}>
          {category && category !== subject.name && (
            <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
              {category}
            </p>
          )}
          <ul className="mt-2 flex flex-col gap-2.5">
            {facts.map((fact) => (
              <li key={fact.label + fact.value} className="text-sm">
                <span className="font-medium">{fact.label}</span>
                <span className="text-muted-foreground whitespace-pre-line">
                  {" — "}
                  {fact.value}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
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
    <section className="mt-12">
      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {title}
      </p>
      {children}
    </section>
  );
}

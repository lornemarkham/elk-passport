import type { Metadata } from "next";
import Link from "next/link";
import { octoberPool } from "@/lib/labs/october/pool";
import {
  byFit,
  closingSoon,
  eveningLine,
  fitFor,
  mixSources,
  sayOnce,
  type Context,
} from "@/lib/labs/october/fit";
import type { Possibility } from "@/lib/labs/october/possibility";
import { dayLabel, weekdayLabel } from "@/lib/labs/october/possibility";
import {
  Because,
  CardWhen,
  Shot,
  Simulated,
  When,
} from "@/components/labs/october/atoms";
import { LabBar } from "@/components/labs/october/LabBar";
import { LabKeep } from "@/components/labs/october/LabKeep";
import { OctoberTray } from "@/components/labs/october/OctoberTray";
import { Unanswered } from "@/components/october/shell/atoms";

export const metadata: Metadata = { title: "Tonight — Discovery Lab" };

const HERE = "/labs/october/discovery/a";

/**
 * **Experiment A — October composes the evening, and you read it.**
 *
 * The discovery model is *editorial*. There is no control on this page. You do
 * not tell it anything, you do not filter, you do not choose a category — it
 * looks at the date, the clock, the sky and the inventory, decides what
 * tonight is about, and writes a page about that. The cost is that it can be
 * wrong about you. The benefit is the thing a filter bar can never do: it
 * makes a *claim*, and a claim is what gives somebody something to agree or
 * disagree with.
 *
 * ## Why it is one column and not lanes
 *
 * Lanes are an answer to "what kinds of things do you have". This page is an
 * answer to "what is tonight", so it narrows as it goes: one thing, then a
 * few, then what is running out, then the weekend, then the open-ended stuff
 * that will still be there whenever. Each section is a different *temporal
 * promise*, which is the organising principle the brief asked for — not the
 * entity kind, which appears nowhere on this page.
 *
 * ## The sky is in the ordering, not beside it
 *
 * `fitFor` has already moved everything before this page renders. What you see
 * at the top on a wet Thursday and a clear Saturday are different pages built
 * from the same pool, and the sentence under the lead says which it is and
 * why. Nothing is excluded for weather — the haunt is still here on a wet
 * night, further down, with the rain said out loud.
 */
export default async function TonightLab({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string }>;
}) {
  const pool = await octoberPool((await searchParams).sim);
  const { ctx, page, possibilities } = pool;

  const ranked = mixSources([...possibilities].sort(byFit(ctx)));
  const tonight = ranked.filter((p) => p.availability.tonight);
  // **The hero slot requires a photograph.** It is the one position on the
  // page where an empty frame reads as a broken product rather than as a
  // deliberate treatment, so the best *visual* candidate wins it even when a
  // slightly better-fitting possibility has no picture — that one takes the
  // row below and loses nothing.
  const lead =
    tonight.find((p) => p.image) ?? ranked.find((p) => p.image) ?? ranked[0];

  const used = new Set<string>(lead ? [lead.id] : []);
  // Filtering a mixed list can un-mix it — "Whenever you like" is films and
  // Doings only, so it arrived as five films in a row. Each lane is composed
  // again after it is filtered.
  const take = (from: readonly Possibility[], n: number) => {
    const out: Possibility[] = [];
    for (const p of from) {
      if (used.has(p.id) || out.length >= n) continue;
      used.add(p.id);
      out.push(p);
    }
    return mixSources(out);
  };

  // Each section is a different promise about time, and each one is allowed to
  // say nothing. An empty "while it lasts" is the common case and the honest
  // one — most evenings nothing is in its final two nights.
  const alsoTonight = take(tonight, 4);
  const closing = take(
    ranked.filter((p) => closingSoon(p.availability.days, pool.today)),
    2,
  );
  const ahead = take(
    ranked
      .filter(
        (p) =>
          p.availability.days.some((d) => d > pool.today) &&
          !p.availability.tonight,
      )
      .sort((a, b) =>
        (a.availability.days.find((d) => d > pool.today) ?? "").localeCompare(
          b.availability.days.find((d) => d > pool.today) ?? "",
        ),
      ),
    4,
  );
  const whenever = take(
    ranked.filter((p) => p.availability.shape === "anytime"),
    6,
  );

  const seed = possibilities
    .filter((p) => page.kept.has(p.id))
    .map((p) => ({ id: p.id, name: p.title, when: p.availability.label }));

  // One instance for the whole page: the lead gets the sentence, and the
  // twelve cards under it that would repeat it verbatim do not.
  const once = sayOnce();

  const evening = eveningLine(pool.weather);
  const when = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Vancouver",
  }).format(pool.now);

  return (
    <main className="min-h-screen bg-[#0c0a0c] text-[#e9e6da]">
      <div className="mx-auto max-w-4xl px-5 pt-10 pb-28 sm:px-6">
        <LabBar here={HERE} />
        <Simulated label={pool.simulated} />

        <header>
          <p className="text-[11px] tracking-[0.22em] text-[#d09a4e] uppercase">
            {when}
            {pool.areaName ? ` · ${pool.areaName}` : ""}
          </p>
          <h1 className="font-heading mt-2 text-4xl leading-[1.05] tracking-tight text-balance text-[#f3efe4] sm:text-6xl">
            {evening ? evening : "Here is tonight."}
          </h1>
          {evening ? (
            <p className="mt-3 max-w-lg leading-relaxed text-[#e9e6da]/50">
              So October has put the inside things first. Everything else is
              still here, further down.
            </p>
          ) : null}
        </header>

        {pool.outage ? (
          <div className="mt-10">
            <Unanswered />
          </div>
        ) : null}

        {lead ? (
          <section className="mt-9" data-testid="lead">
            <Lead p={lead} ctx={ctx} page={page} once={once} />
          </section>
        ) : null}

        <Section title="Also tonight" items={alsoTonight}>
          {alsoTonight.map((p) => (
            <Tile key={p.id} p={p} ctx={ctx} page={page} once={once} />
          ))}
        </Section>

        {closing.length > 0 ? (
          <section className="mt-14" data-testid="closing">
            <SectionHead title="While it lasts" line="Running out this week." />
            <div className="mt-4 flex flex-col gap-3">
              {closing.map((p) => {
                const end = closingSoon(p.availability.days, pool.today)!;
                return (
                  <Row
                    key={p.id}
                    p={p}
                    page={page}
                    note={
                      end.daysLeft === 1
                        ? `Final night — ${weekdayLabel(end.lastDay)}.`
                        : `Two nights left. Last is ${weekdayLabel(end.lastDay)} ${dayLabel(end.lastDay)}.`
                    }
                  />
                );
              })}
            </div>
          </section>
        ) : null}

        <Section title="Coming up" items={ahead}>
          {ahead.map((p) => (
            <Tile key={p.id} p={p} ctx={ctx} page={page} once={once} />
          ))}
        </Section>

        {whenever.length > 0 ? (
          <section className="mt-14" data-testid="whenever">
            <SectionHead
              title="Whenever you like"
              line="No date on any of these. They will still be here on Tuesday."
            />
            <div className="mt-4 flex flex-col gap-3">
              {whenever.map((p) => (
                <Row key={p.id} p={p} page={page} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <OctoberTray seed={seed} signedIn={page.signedIn} />
    </main>
  );
}

// ------------------------------------------------------------------ pieces

function Lead({
  p,
  ctx,
  page,
  once,
}: {
  readonly p: Possibility;
  readonly ctx: Context;
  readonly page: { signedIn: boolean; kept: ReadonlySet<string> };
  readonly once: (reason?: string) => string | undefined;
}) {
  const because = once(fitFor(p, ctx).because);
  return (
    <article className="overflow-hidden rounded-2xl border border-[#e9e6da]/10">
      <Link href={p.href} className="block">
        <Shot p={p} className="aspect-[16/9] w-full sm:aspect-[21/9]" />
      </Link>
      <div className="p-5 sm:p-6">
        <When p={p} />
        <h2 className="font-heading mt-2 text-3xl leading-tight text-balance text-[#f3efe4] sm:text-4xl">
          <Link href={p.href} className="hover:text-white">
            {p.title}
          </Link>
        </h2>
        {p.line ? (
          <p className="mt-2 max-w-xl leading-relaxed text-[#e9e6da]/60">
            {clip(p.line, 180)}
          </p>
        ) : null}
        <Because because={because} />
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <LabKeep
            p={p}
            saved={page.kept.has(p.id)}
            signedIn={page.signedIn}
            returnTo={HERE}
            big
          />
          <Link
            href={p.href}
            className="inline-flex min-h-11 items-center text-sm text-[#e9e6da]/50 underline-offset-4 hover:text-[#e9e6da] hover:underline"
          >
            Tell me more →
          </Link>
        </div>
      </div>
    </article>
  );
}

function Tile({
  p,
  ctx,
  page,
  once,
}: {
  readonly p: Possibility;
  readonly ctx: Context;
  readonly page: { signedIn: boolean; kept: ReadonlySet<string> };
  readonly once: (reason?: string) => string | undefined;
}) {
  const because = once(fitFor(p, ctx).because);
  return (
    <article
      data-testid="tile"
      data-source={p.source}
      className="flex flex-col overflow-hidden rounded-xl border border-[#e9e6da]/10 transition-colors hover:border-[#d09a4e]/35"
    >
      <Link href={p.href}>
        <Shot p={p} className="aspect-[4/3] w-full" />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <CardWhen p={p} />
        <h3 className="font-heading mt-1.5 text-lg leading-tight text-[#f3efe4]">
          <Link href={p.href} className="hover:text-white">
            {p.title}
          </Link>
        </h3>
        {p.line ? (
          <p className="mt-1.5 text-sm leading-snug text-[#e9e6da]/55">
            {clip(p.line, 96)}
          </p>
        ) : null}
        <Because because={because} />
        <div className="mt-auto pt-4">
          <LabKeep
            p={p}
            saved={page.kept.has(p.id)}
            signedIn={page.signedIn}
            returnTo={HERE}
          />
        </div>
      </div>
    </article>
  );
}

function Row({
  p,
  page,
  note,
}: {
  readonly p: Possibility;
  readonly page: { signedIn: boolean; kept: ReadonlySet<string> };
  readonly note?: string;
}) {
  return (
    <article
      data-testid="row"
      data-source={p.source}
      className="flex items-center gap-4 rounded-xl border border-[#e9e6da]/10 p-3 transition-colors hover:border-[#d09a4e]/35"
    >
      <Link href={p.href} className="shrink-0">
        <Shot p={p} className="h-20 w-28 rounded-lg" />
      </Link>
      <div className="min-w-0 flex-1">
        <CardWhen p={p} />
        <h3 className="font-heading mt-0.5 truncate text-base text-[#f3efe4]">
          <Link href={p.href} className="hover:text-white">
            {p.title}
          </Link>
        </h3>
        {note ? (
          <p className="mt-0.5 text-sm text-[#d09a4e]/85">{note}</p>
        ) : p.line ? (
          <p className="mt-0.5 truncate text-sm text-[#e9e6da]/45">
            {clip(p.line, 90)}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">
        <LabKeep
          p={p}
          saved={page.kept.has(p.id)}
          signedIn={page.signedIn}
          returnTo={HERE}
        />
      </div>
    </article>
  );
}

function SectionHead({
  title,
  line,
}: {
  readonly title: string;
  readonly line?: string;
}) {
  return (
    <>
      <h2 className="font-heading text-2xl text-[#f3efe4]">{title}</h2>
      {line ? <p className="mt-0.5 text-sm text-[#e9e6da]/40">{line}</p> : null}
    </>
  );
}

function Section({
  title,
  items,
  children,
}: {
  readonly title: string;
  readonly items: readonly Possibility[];
  readonly children: React.ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-14" data-testid="section">
      <SectionHead title={title} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {children}
      </div>
    </section>
  );
}

/** Atlas descriptions run to paragraphs. A card gets a sentence. */
function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "));
  return `${cut.slice(0, stop > max * 0.5 ? stop : max).trim()}…`;
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PassportNav } from "@/components/shell/PassportNav";
import { ThemeProvider } from "@/components/ghad/theme";
import { Picture } from "@/components/adventures/Picture";
import { PrintButton } from "@/components/adventures/PrintButton";
import { toneFor } from "@/components/adventures/kit";
import { adventureSession } from "@/lib/adventures/server";
import { adventureFor, type AdventureView } from "@/lib/adventures/store";
import { atlasStopsFor } from "@/lib/adventures/atlas-names";
import { dayDetails, type DayDetail } from "@/lib/adventures/propose";
import { groupByDay } from "@/lib/adventures/days";
import {
  clockLabel,
  minutesLabel,
  weekdayLabel,
  whenLabel,
} from "@/lib/adventures/present";
import { placeLabel } from "@/domain/discovery/compose";

export const metadata: Metadata = {
  title: "Adventure guide — Passport",
  robots: { index: false },
};

/** What we will actually remember — the Fishing With Emi prompts, for anyone. */
const AFTERWARDS = [
  "The best moment",
  "The funniest thing that happened",
  "Something we found that wasn't on the plan",
  "What we'd skip next time",
  "Would we do it again?",
];

/**
 * **The adventure guide — a keepsake, not a database export** (ADR 012 §6).
 *
 * Fishing With Emi's skeleton (`docs/product/originals/fishing-with-emi.md`)
 * applied to any adventure: a cover, how to read it, each day as moments
 * with reasons, what Passport could not check (printed with the day, A4),
 * space to write what happened (A7), and where everything came from. A
 * section with nothing sourced is left out rather than filled (A2). It
 * prints; the paper is enough without a phone, and it says plainly where it
 * isn't (A6: no offline map).
 *
 * Members only, read as the signed-in person — the printed day
 * (`/go/print`) is the one that needs no account.
 */
export default async function GuidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await adventureSession();
  let view: AdventureView | null = null;
  if (session)
    view = await adventureFor(session.db, id, session.user.id).catch(
      () => null,
    );

  if (!view)
    return (
      <>
        <PassportNav displayName={session?.user.displayName ?? null} />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="ghad-display text-2xl font-extrabold">
            {session ? "Not found" : "Sign in to open this guide"}
          </p>
          {!session && (
            <Link
              href={`/auth?next=${encodeURIComponent(`/adventures/${id}/guide`)}`}
              className="mt-4 inline-flex min-h-12 items-center rounded-full bg-[var(--gh-ink)] px-6 font-semibold text-white"
            >
              Sign in
            </Link>
          )}
        </main>
      </>
    );

  const refs = view.items.flatMap((i) => (i.atlasRef ? [i.atlasRef] : []));
  const [{ names, experiences }, details] = await Promise.all([
    atlasStopsFor(refs).catch(
      () =>
        ({ names: {}, experiences: {} }) as Awaited<
          ReturnType<typeof atlasStopsFor>
        >,
    ),
    dayDetails(view).catch(() => ({}) as Record<string, DayDetail>),
  ]);
  const { days, ideas } = groupByDay(view.items, view.startsOn, view.endsOn);
  const planned = days.filter((d) => d.items.length > 0);
  const cover = planned
    .flatMap((d) => d.items)
    .map((i) => (i.atlasRef ? experiences[i.atlasRef] : undefined))
    .find(
      (e) => e && (e.heroMedia || e.presentationImage || e.contextualMedia),
    );
  const unknowns = [
    ...new Set(Object.values(details).flatMap((d) => d.unknowns)),
  ];
  const nameOf = (ref: string | null, label: string | null) =>
    label ??
    (ref ? (experiences[ref]?.title ?? names[ref]) : undefined) ??
    "A stop";
  const going = view.members.map((m) => m.displayName);

  return (
    <>
      <div className="print:hidden">
        <PassportNav displayName={session?.user.displayName ?? null} />
      </div>
      <ThemeProvider className="block">
        <main
          className="bg-white text-[var(--gh-ink)]"
          data-testid="adventure-guide"
        >
          {/* ---------------------------------------------------- cover */}
          <header className="relative isolate overflow-hidden bg-[var(--gh-forest)] text-white print:min-h-[90vh] print:break-after-page">
            <Picture
              experience={cover}
              priority
              fallbackTitle=""
              className="absolute inset-0 -z-10 h-full w-full"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
            <div className="mx-auto flex min-h-[30rem] max-w-4xl flex-col justify-between px-4 pt-5 pb-10 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
                <Link
                  href={`/adventures/${view.id}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-black/30 px-4 text-sm font-semibold backdrop-blur"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Back to the plan
                </Link>
                <PrintButton />
              </div>
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-white/85 uppercase">
                  An adventure guide · Go Have a Day
                </p>
                <h1 className="ghad-display mt-3 text-5xl leading-[0.92] font-extrabold tracking-[-0.04em] text-balance sm:text-7xl">
                  {view.title}
                </h1>
                <p className="mt-4 text-lg font-semibold">
                  {[
                    whenLabel(view.startsOn, view.endsOn),
                    view.destinationLabel,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-1 text-base text-white/85">
                  For {going.join(", ")}
                </p>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-4xl space-y-14 px-4 py-12 sm:px-6">
            {/* ------------------------------------------ how to read it */}
            <section
              aria-labelledby="read-heading"
              className="rounded-3xl bg-[var(--gh-cream)] p-5 sm:p-7"
            >
              <h2
                id="read-heading"
                className="ghad-display text-2xl font-extrabold"
              >
                How to read this guide
              </h2>
              <ul className="mt-3 space-y-2 text-base">
                <li>
                  <strong>Kept</strong> stops are decided. Everything else is{" "}
                  <strong>not decided yet</strong> — a saved place somebody
                  brought, or Passport&apos;s suggestion.
                </li>
                <li>
                  Hours and prices are{" "}
                  <strong>quoted from whoever published them</strong>. Passport
                  hasn&apos;t checked them for the day.
                </li>
                <li>
                  “About 1 h 30” is how long the plan gives a stop — arithmetic,
                  not a promise. Passport made no reservations.
                </li>
                <li>There is no offline map on paper. Take one, or a phone.</li>
              </ul>
            </section>

            {/* ------------------------------------------------- the days */}
            {planned.length === 0 ? (
              <p className="text-lg">
                Nothing is on a day yet. Plan a day and it appears here.
              </p>
            ) : (
              planned.map((day, index) => {
                const tone = toneFor(index);
                const detail = details[day.onDay];
                return (
                  <section
                    key={day.onDay}
                    aria-label={weekdayLabel(day.onDay)}
                    data-testid="guide-day"
                    className="print:break-before-page"
                  >
                    <div
                      className="rounded-3xl px-5 py-6 sm:px-8"
                      style={{ background: tone.bg, color: tone.ink }}
                    >
                      <p className="text-xs font-bold tracking-[0.14em] uppercase opacity-85">
                        Day {index + 1} · {whenLabel(day.onDay, null)}
                      </p>
                      <h2 className="ghad-display mt-1 text-4xl font-extrabold tracking-[-0.03em]">
                        {weekdayLabel(day.onDay)}
                      </h2>
                      {detail?.title && (
                        <p className="mt-1 text-lg font-semibold">
                          {detail.title}
                        </p>
                      )}
                      {detail?.opening && (
                        <p className="mt-2 max-w-2xl text-base opacity-95">
                          {detail.opening}
                        </p>
                      )}
                    </div>
                    <ol className="mt-6 space-y-6">
                      {day.items.map((item, i) => {
                        const e = item.atlasRef
                          ? experiences[item.atlasRef]
                          : undefined;
                        const stop = item.atlasRef
                          ? detail?.stops[item.atlasRef]
                          : undefined;
                        const where = e ? placeLabel(e) : undefined;
                        return (
                          <li
                            key={item.id}
                            className="grid gap-4 sm:grid-cols-[12rem_1fr] print:break-inside-avoid"
                          >
                            <Picture
                              experience={e}
                              fallbackTitle={nameOf(item.atlasRef, item.label)}
                              tone={tone.bg}
                              className="aspect-[4/3] w-full rounded-2xl"
                            />
                            <div>
                              <p className="text-sm font-bold text-[var(--gh-ink-soft)]">
                                {stop?.arrive !== undefined
                                  ? `About ${clockLabel(stop.arrive)}`
                                  : `Stop ${i + 1}`}
                                {stop
                                  ? ` · about ${minutesLabel(stop.minutes)}`
                                  : ""}
                                {item.status === "confirmed"
                                  ? " · kept"
                                  : item.origin === "passport"
                                    ? " · Passport's suggestion"
                                    : " · not decided yet"}
                              </p>
                              <h3 className="ghad-display text-2xl font-extrabold">
                                {nameOf(item.atlasRef, item.label)}
                              </h3>
                              {where && (
                                <p className="text-base text-[var(--gh-ink-soft)]">
                                  {where}
                                </p>
                              )}
                              {stop?.because && (
                                <p className="mt-2 text-base">{stop.because}</p>
                              )}
                              <ul className="mt-2 space-y-1 text-sm text-[var(--gh-ink-soft)]">
                                {stop?.open && <li>{stop.open}</li>}
                                {stop?.hours && (
                                  <li>Published hours: {stop.hours}</li>
                                )}
                                {stop?.cost && (
                                  <li>Published price: {stop.cost}</li>
                                )}
                                {stop?.notes.map((n) => (
                                  <li key={n}>{n}</li>
                                ))}
                                {stop?.rainPlan && (
                                  <li>If it rains: {stop.rainPlan.title}</li>
                                )}
                                {item.note && <li>{item.note}</li>}
                              </ul>
                              {stop?.challenge && (
                                <p
                                  data-testid="guide-challenge"
                                  className="mt-3 rounded-2xl border-2 border-dashed border-[var(--gh-line)] p-3 text-base"
                                >
                                  <strong>Challenge:</strong> {stop.challenge}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                );
              })
            )}

            {/* ------------------------------------------- before you go */}
            {unknowns.length > 0 && (
              <section
                aria-labelledby="check-heading"
                className="print:break-inside-avoid"
              >
                <h2
                  id="check-heading"
                  className="ghad-display text-3xl font-extrabold tracking-[-0.02em]"
                >
                  Before you go
                </h2>
                <p className="mt-1 text-base text-[var(--gh-ink-soft)]">
                  Things Passport could not check for you.
                </p>
                <ul className="mt-4 space-y-2">
                  {unknowns.map((u) => (
                    <li key={u} className="flex items-start gap-3 text-base">
                      <span
                        aria-hidden
                        className="mt-1 inline-block h-5 w-5 shrink-0 rounded border-2 border-[var(--gh-ink)]"
                      />
                      {u}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {ideas.length > 0 && (
              <section aria-labelledby="ideas-heading">
                <h2
                  id="ideas-heading"
                  className="ghad-display text-3xl font-extrabold"
                >
                  If there&apos;s time
                </h2>
                <p className="mt-1 text-base text-[var(--gh-ink-soft)]">
                  Ideas that didn&apos;t make a day.
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-6 text-base">
                  {ideas.map((i) => (
                    <li key={i.id}>{nameOf(i.atlasRef, i.label)}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* ----------------------------------------------- afterwards */}
            <section
              id="afterwards"
              aria-labelledby="after-heading"
              data-testid="guide-afterwards"
              className="rounded-3xl bg-[var(--gh-sand)] p-5 sm:p-8 print:break-before-page"
            >
              <h2
                id="after-heading"
                className="ghad-display text-3xl font-extrabold tracking-[-0.02em]"
              >
                Afterwards
              </h2>
              <p className="mt-1 text-base text-[var(--gh-ink-soft)]">
                What we will actually remember. Write it here, on paper —
                Passport doesn&apos;t keep it yet.
              </p>
              <div className="mt-6 space-y-6">
                {AFTERWARDS.map((prompt) => (
                  <div key={prompt}>
                    <p className="text-base font-bold">{prompt}</p>
                    <div
                      aria-hidden
                      className="mt-6 border-b-2 border-dotted border-[var(--gh-ink)]/40"
                    />
                    <div
                      aria-hidden
                      className="mt-6 border-b-2 border-dotted border-[var(--gh-ink)]/40"
                    />
                  </div>
                ))}
                <div
                  aria-hidden
                  className="flex h-44 items-center justify-center rounded-2xl border-2 border-dashed border-[var(--gh-ink)]/40 text-sm font-semibold text-[var(--gh-ink-soft)]"
                >
                  Stick a photo here, or draw the best bit
                </div>
              </div>
            </section>

            {/* -------------------------------------------------- sources */}
            <section
              aria-labelledby="sources-heading"
              className="text-sm text-[var(--gh-ink-soft)]"
            >
              <h2
                id="sources-heading"
                className="text-base font-bold text-[var(--gh-ink)]"
              >
                Where this came from
              </h2>
              <p className="mt-1">
                Every place is a real subject in Atlas, ELK&apos;s knowledge of
                the world. Reasons and durations are Passport&apos;s; hours,
                prices and rules are quoted from their publishers and may have
                changed. Printed{" "}
                {new Date().toLocaleDateString("en-CA", { dateStyle: "long" })}.
              </p>
            </section>
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}

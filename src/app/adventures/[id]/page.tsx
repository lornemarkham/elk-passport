import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  MapPin,
  Repeat,
} from "lucide-react";
import { PassportNav } from "@/components/shell/PassportNav";
import { ThemeProvider } from "@/components/ghad/theme";
import { AdventurePeople } from "@/components/adventures/AdventurePeople";
import { AdventureJourney } from "@/components/adventures/journey/AdventureJourney";
import { Picture } from "@/components/adventures/Picture";
import {
  PeopleDots,
  pillClass,
  StatusBadge,
} from "@/components/adventures/kit";
import { adventureSession } from "@/lib/adventures/server";
import {
  adventureFor,
  invitesOf,
  type AdventureView,
  type InviteView,
} from "@/lib/adventures/store";
import { atlasStopsFor, type AtlasStops } from "@/lib/adventures/atlas-names";
import { dayDetails, type DayDetail } from "@/lib/adventures/propose";
import { todayIn } from "@/lib/adventures/overview";
import { loadSaved } from "@/lib/data/loadSaved";
import { kindLabel } from "@/lib/adventures/kinds";
import {
  adventureStatus,
  momentLabel,
  whenLabel,
} from "@/lib/adventures/present";

export const metadata: Metadata = {
  title: "Adventure — Passport",
  robots: { index: false },
};

const STARTED: Readonly<Record<string, string>> = {
  ok: "Here's a first sketch, from real places Atlas knows. Every stop is a suggestion until you keep it — swap, move or change anything in your own words.",
  "nothing-fits":
    "Passport couldn't find enough within reach to sketch these days. Add ideas from Saved, or try a different town or kind of day below.",
  "atlas-unavailable":
    "Atlas couldn't be reached, so Passport couldn't sketch the days. Your adventure is saved — try “Sketch” on a day in a moment, or add things by hand.",
  "no-town":
    "Choose where it starts (open a day in Go Have a Day) and Passport can sketch it.",
  "no-dates": "Give it dates and Passport can sketch the days.",
};

function Panel({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[28px] bg-[var(--gh-cream)] px-6 py-16 text-center">
      <p className="ghad-display text-2xl font-extrabold">{title}</p>
      {children}
    </div>
  );
}

/**
 * **One adventure, as a travel journal** (ADR 012): where and when, who's
 * going, and the days — shaped in words or by hand, lived on the day, kept
 * in a guide, done again.
 *
 * Read as the signed-in person, so what they see is exactly what Postgres
 * lets them see. "Not found" covers missing and not-yours identically.
 */
export default async function AdventurePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const started = (await searchParams)?.["started"];
  const session = await adventureSession();

  let view: AdventureView | null = null;
  let invites: InviteView[] = [];
  let failed = false;
  if (session) {
    try {
      view = await adventureFor(session.db, id, session.user.id);
      // Only an owner may read links (RLS); nobody else is asked.
      if (view?.role === "owner") invites = await invitesOf(session.db, id);
    } catch {
      failed = true;
    }
  }

  const saved = view ? await loadSaved().catch(() => null) : null;
  const held = new Set(
    view?.items.flatMap((i) => (i.atlasRef ? [i.atlasRef] : [])) ?? [],
  );
  const savedHere =
    saved?.status === "ok"
      ? saved.experiences.filter((e) => !held.has(e.id))
      : [];
  const refs = view
    ? [
        ...held,
        ...(view.hockey?.arenaAtlasRef ? [view.hockey.arenaAtlasRef] : []),
      ]
    : [];
  const [stops, details] = await Promise.all([
    refs.length > 0
      ? atlasStopsFor(refs)
      : Promise.resolve<AtlasStops>({ names: {}, experiences: {} }),
    view
      ? dayDetails(view).catch(() => null)
      : Promise.resolve({} as Record<string, DayDetail>),
  ]);
  const { names: atlasNames, experiences } = stops;
  // Atlas answered for nothing the plan points at: say so, keep everything manual.
  const atlasDown =
    details === null ||
    (refs.length > 0 &&
      Object.keys(experiences).length === 0 &&
      Object.keys(atlasNames).length === 0);
  const today = todayIn(view?.timeZone ?? null);

  const ordered = view
    ? [...view.items]
        .filter((i) => i.atlasRef)
        .sort((a, b) =>
          a.onDay && b.onDay
            ? a.onDay.localeCompare(b.onDay) || a.position - b.position
            : a.onDay
              ? -1
              : b.onDay
                ? 1
                : a.position - b.position,
        )
    : [];
  const cover = ordered
    .map((i) => experiences[i.atlasRef!])
    .find(
      (e) => e && (e.heroMedia || e.presentationImage || e.contextualMedia),
    );
  const onDays = view?.items.filter((i) => i.onDay) ?? [];
  const status = view
    ? adventureStatus(
        view,
        {
          stops: onDays.length,
          undecided: onDays.filter((i) => i.status === "proposed").length,
        },
        today,
      )
    : null;
  const againHref = view
    ? `/adventures/new?${new URLSearchParams({
        with: ordered
          .map((i) => i.atlasRef!)
          .slice(0, 12)
          .join(","),
        ...(view.destinationTownId ? { at: view.destinationTownId } : {}),
        name: `${view.title} — again`,
      }).toString()}`
    : "";

  return (
    <>
      <PassportNav displayName={session?.user.displayName ?? null} />
      <ThemeProvider className="block">
        <main className="min-h-screen bg-white">
          {!view ? (
            <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
              <Link
                href="/adventures"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--gh-ink-soft)]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Adventures
              </Link>
              {!session ? (
                <Panel title="Sign in to open this">
                  <Link
                    href={`/auth?next=${encodeURIComponent(`/adventures/${id}`)}`}
                    className={pillClass("primary")}
                  >
                    Sign in
                  </Link>
                </Panel>
              ) : failed ? (
                <Panel title="Couldn't load this just now">
                  <p className="text-base text-[var(--gh-ink-soft)]">
                    Try again in a moment.
                  </p>
                </Panel>
              ) : (
                <Panel title="Not found">
                  <p className="max-w-sm text-base text-[var(--gh-ink-soft)]">
                    It may have been deleted, the link may be wrong, or it
                    isn&apos;t one you&apos;re in. If somebody invited you, open
                    the link they sent.
                  </p>
                </Panel>
              )}
            </div>
          ) : (
            <>
              <header className="relative isolate overflow-hidden bg-[var(--gh-forest)] text-white">
                <Picture
                  experience={cover}
                  priority
                  fallbackTitle=""
                  className="absolute inset-0 -z-10 h-full w-full"
                />
                <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />
                <div className="mx-auto flex min-h-[24rem] max-w-5xl flex-col justify-between gap-8 px-4 pt-5 pb-8 sm:min-h-[28rem] sm:px-6 sm:pb-12">
                  <Link
                    href="/saved"
                    className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-black/30 px-4 text-sm font-semibold backdrop-blur hover:bg-black/45"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden />
                    Saved
                  </Link>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {status && (
                        <StatusBadge
                          stage={status.stage}
                          label={status.label}
                        />
                      )}
                      <span className="text-sm font-semibold text-white/85">
                        {kindLabel(view.kind)}
                      </span>
                    </div>
                    <h1 className="ghad-display mt-3 text-[2.6rem] leading-[0.95] font-extrabold tracking-[-0.04em] text-balance sm:text-7xl">
                      {view.title}
                    </h1>
                    <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-base font-semibold text-white/95">
                      <li className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-5 w-5" aria-hidden />
                        {whenLabel(view.startsOn, view.endsOn) ?? "No date yet"}
                      </li>
                      {view.destinationLabel && (
                        <li className="inline-flex items-center gap-1.5">
                          <MapPin className="h-5 w-5" aria-hidden />
                          {view.destinationLabel}
                        </li>
                      )}
                      <li>
                        <a
                          href="#people"
                          className="inline-flex items-center gap-2 hover:underline"
                        >
                          <PeopleDots
                            names={view.members.map((m) => m.displayName)}
                          />
                          {view.members.length === 1
                            ? "Just you — invite people"
                            : `${view.members.length} going`}
                        </a>
                      </li>
                    </ul>
                    {view.hockey &&
                      (view.hockey.homeTeam ||
                        view.hockey.awayTeam ||
                        view.hockey.arenaLabel ||
                        view.hockey.arenaAtlasRef ||
                        view.hockey.puckDrop) && (
                        <p
                          className="mt-3 text-base"
                          data-testid="hockey-facts"
                        >
                          {[
                            view.hockey.homeTeam && view.hockey.awayTeam
                              ? `${view.hockey.homeTeam} vs ${view.hockey.awayTeam}`
                              : view.hockey.awayTeam
                                ? `vs ${view.hockey.awayTeam}`
                                : view.hockey.homeTeam,
                            view.hockey.arenaLabel ??
                              (view.hockey.arenaAtlasRef
                                ? atlasNames[view.hockey.arenaAtlasRef]
                                : null),
                            view.hockey.puckDrop
                              ? `puck drop ${momentLabel(view.hockey.puckDrop, view.timeZone)}`
                              : "puck drop not confirmed",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    <div className="mt-6 flex flex-wrap gap-2">
                      <Link
                        href={`/adventures/${view.id}/guide`}
                        data-testid="open-guide"
                        className={pillClass("light")}
                      >
                        <BookOpen className="h-4 w-4" aria-hidden />
                        {status?.stage === "done"
                          ? "The guide & memories"
                          : "Adventure guide"}
                      </Link>
                      <Link
                        href={`/saved?adventure=${encodeURIComponent(view.id)}`}
                        data-testid="add-from-saved"
                        className={pillClass(
                          "light",
                          "bg-white/15 text-white hover:bg-white/25",
                        )}
                      >
                        Add from Saved
                      </Link>
                      <Link
                        href={againHref}
                        data-testid="do-it-again"
                        className={pillClass(
                          "light",
                          "bg-white/15 text-white hover:bg-white/25",
                        )}
                      >
                        <Repeat className="h-4 w-4" aria-hidden />
                        Do it again
                      </Link>
                    </div>
                  </div>
                </div>
              </header>

              <div className="mx-auto max-w-5xl space-y-12 px-4 py-10 sm:px-6">
                {typeof started === "string" && STARTED[started] && (
                  <p
                    role="status"
                    data-testid="started-note"
                    className="rounded-3xl bg-[var(--gh-forest-soft)] p-5 text-base font-semibold text-[var(--gh-forest)]"
                  >
                    {STARTED[started]}
                  </p>
                )}
                {status?.stage === "done" && (
                  <section className="rounded-[28px] bg-[var(--gh-sand)] p-6 sm:p-8">
                    <p className="ghad-display text-3xl font-extrabold tracking-[-0.03em]">
                      How was it?
                    </p>
                    <p className="mt-2 max-w-xl text-base text-[var(--gh-ink-soft)]">
                      The guide has room to write down what actually happened.
                      And if it was one hell of a day — do it again.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/adventures/${view.id}/guide#afterwards`}
                        className={pillClass("primary")}
                      >
                        Write it down
                      </Link>
                      <Link href={againHref} className={pillClass("forest")}>
                        <Repeat className="h-4 w-4" aria-hidden />
                        Do it again
                      </Link>
                    </div>
                  </section>
                )}
                <AdventureJourney
                  adventureId={view.id}
                  isOwner={view.role === "owner"}
                  items={view.items}
                  atlasNames={atlasNames}
                  experiences={experiences}
                  startsOn={view.startsOn}
                  endsOn={view.endsOn}
                  days={view.days}
                  details={details ?? {}}
                  townId={view.destinationTownId}
                  today={today}
                  saved={savedHere}
                  atlasDown={atlasDown}
                />
                <div id="people">
                  <AdventurePeople
                    adventureId={view.id}
                    isOwner={view.role === "owner"}
                    members={view.members}
                    you={view.you}
                    invites={invites}
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </ThemeProvider>
    </>
  );
}

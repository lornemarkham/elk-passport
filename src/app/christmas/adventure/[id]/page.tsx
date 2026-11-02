import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Compass,
  MapPin,
} from "lucide-react";
import { PassportNav } from "@/components/shell/PassportNav";
import { ThemeProvider } from "@/components/ghad/theme";
import { AdventurePeople } from "@/components/adventures/AdventurePeople";
import { AdventureJourney } from "@/components/adventures/journey/AdventureJourney";
import { Picture } from "@/components/adventures/Picture";
import { PeopleDots, StatusBadge } from "@/components/adventures/kit";
import {
  Notices,
  type NoticeData,
  type StopOption,
} from "@/components/christmas/Notices";
import { Together } from "@/components/christmas/Together";
import styles from "@/components/christmas/christmas.module.css";
import { adventureSession } from "@/lib/adventures/server";
import {
  adventureFor,
  invitesOf,
  type AdventureView,
  type InviteView,
} from "@/lib/adventures/store";
import { atlasStopsFor, type AtlasStops } from "@/lib/adventures/atlas-names";
import { dayDetails } from "@/lib/adventures/propose";
import { todayIn } from "@/lib/adventures/overview";
import { adventureStatus, whenLabel } from "@/lib/adventures/present";
import { loadSaved } from "@/lib/data/loadSaved";
import { adventureFrame, savedFor } from "@/lib/adventures/fit";
import { dayPool } from "@/lib/go/pool";
import { pickChallenges } from "@/domain/christmas/challengePicks";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import type { Moment } from "@/domain/christmas/recap";
import { momentsOf, noticesOf, sharingOn } from "../../_server/together";

export const metadata: Metadata = {
  title: "Christmas adventure — Passport",
  robots: { index: false },
};

const STARTED: Readonly<Record<string, string>> = {
  ok: "Here's your first sketch, from real places Atlas knows, kept around the Christmas things you chose. Everything Passport added is a suggestion until you keep it — invite your people and let them vote.",
  "nothing-fits":
    "Passport couldn't find enough within reach to sketch these days. Add ideas from Saved, or find more Christmas things.",
  "atlas-unavailable":
    "Atlas couldn't be reached, so Passport couldn't sketch the days. Your adventure is saved — try again in a moment, or add things by hand.",
  "no-town": "Choose where it starts and Passport can sketch it.",
  "no-dates": "Give it dates and Passport can sketch the days.",
  manual: "Your Christmas adventure is ready. Add things, invite your people.",
};

function Panel({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[28px] bg-white px-6 py-16 text-center ring-1 ring-black/5">
      <p className="ghad-display text-2xl font-extrabold">{title}</p>
      {children}
    </div>
  );
}

/**
 * **A Christmas adventure** — Passport's one group core (ADR 009) composed
 * for Christmas: the plan and the vote are the core's own `AdventureJourney`,
 * invitations are `AdventurePeople`, the printable keepsake is the core's
 * guide. Christmas adds what the season needs on top: announcements when
 * plans change, challenges, shared memories and a recap.
 */
export default async function ChristmasAdventurePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const started = typeof query.started === "string" ? query.started : undefined;
  const offDates = Number(query.off) || 0;
  const session = await adventureSession();

  let view: AdventureView | null = null;
  let invites: InviteView[] = [];
  let failed = false;
  if (session) {
    try {
      view = await adventureFor(session.db, id, session.user.id);
      if (view?.role === "owner") invites = await invitesOf(session.db, id);
    } catch {
      failed = true;
    }
  }
  // Not a Christmas one: the generic page is its home.
  if (view && view.kind !== "christmas")
    redirect(`/adventures/${encodeURIComponent(id)}`);

  const here = `/christmas/adventure/${id}`;
  if (!view) {
    return (
      <>
        <PassportNav displayName={session?.user.displayName ?? null} />
        <ThemeProvider className="block">
          <main className={`${styles.page} min-h-screen`}>
            <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
              <Link
                href="/christmas"
                className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Christmas
              </Link>
              {!session ? (
                <Panel title="Sign in to open this Christmas adventure">
                  <Link
                    href={`/auth?next=${encodeURIComponent(here)}`}
                    className="inline-flex min-h-12 items-center rounded-full bg-[#b3242f] px-6 font-bold text-white"
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
                    It may have been deleted, or it isn&apos;t one you&apos;re
                    in. If somebody invited you, open the link they sent.
                  </p>
                </Panel>
              )}
            </div>
          </main>
        </ThemeProvider>
      </>
    );
  }

  const db = session!.db;
  const me = session!.user.id;
  const saved = await loadSaved().catch(() => null);
  const held = new Set(
    view.items.flatMap((i) => (i.atlasRef ? [i.atlasRef] : [])),
  );
  const savedHere =
    saved?.status === "ok"
      ? savedFor(view, saved.experiences)
      : { fits: [], elsewhere: [] };
  const sharing = await sharingOn(db, id).catch(() => false);
  const [stops, details, candidates, notices, moments] = await Promise.all([
    held.size > 0
      ? atlasStopsFor([...held])
      : Promise.resolve<AtlasStops>({ names: {}, experiences: {} }),
    dayDetails(view).catch(() => null),
    listDiscoveryCandidates(undefined, view.startsOn ?? undefined).catch(
      () => null,
    ),
    sharing ? noticesOf(db, id, me).catch(() => []) : Promise.resolve([]),
    sharing
      ? momentsOf(db, id, me).catch(() => [])
      : Promise.resolve([] as Moment[]),
  ]);
  const { names: atlasNames, experiences } = stops;
  const atlasDown = !candidates || details === null;
  // The few dares that lead, with somewhere real to do them (challengePicks).
  const picks =
    sharing && candidates
      ? pickChallenges({
          ...adventureFrame(view),
          pool: dayPool(candidates, []),
          held,
        })
      : [];
  const today = todayIn(view.timeZone ?? null);

  const ordered = [...view.items]
    .filter((i) => i.atlasRef)
    .sort((a, b) =>
      a.onDay && b.onDay
        ? a.onDay.localeCompare(b.onDay) || a.position - b.position
        : a.onDay
          ? -1
          : b.onDay
            ? 1
            : a.position - b.position,
    );
  const cover = ordered
    .map((i) => experiences[i.atlasRef!])
    .find(
      (e) => e && (e.heroMedia || e.presentationImage || e.contextualMedia),
    );
  const onDays = view.items.filter((i) => i.onDay);
  const status = adventureStatus(
    view,
    {
      stops: onDays.length,
      undecided: onDays.filter((i) => i.status === "proposed").length,
    },
    today,
  );
  const stopOptions: StopOption[] = ordered.flatMap((i) => {
    const e = experiences[i.atlasRef!];
    const label = atlasNames[i.atlasRef!] ?? e?.title;
    return label ? [{ id: i.atlasRef!, label, kind: e?.kind ?? "Place" }] : [];
  });
  const againHref = `/christmas/plan?${new URLSearchParams({
    with: ordered
      .map((i) => i.atlasRef!)
      .slice(0, 12)
      .join(","),
    ...(view.destinationTownId ? { at: view.destinationTownId } : {}),
    name: `${view.title} — again`,
  }).toString()}`;
  const tabs = [
    ["#plan", "The plan"],
    ["#people", "Who's coming"],
    ...(sharing ? [["#challenges", "Challenges"]] : []),
    ["#memories", "Memories"],
  ];

  return (
    <>
      <PassportNav displayName={session!.user.displayName ?? null} />
      <ThemeProvider className="block">
        <main className={`${styles.page} min-h-screen pb-16`}>
          <header className={styles.night}>
            {cover && (
              <Picture
                experience={cover}
                priority
                showLabel={false}
                fallbackTitle=""
                className="absolute inset-0 -z-10 h-full w-full opacity-35"
              />
            )}
            <div className="mx-auto flex min-h-[22rem] max-w-5xl flex-col justify-between gap-6 px-4 pt-5 pb-8 sm:px-6">
              <Link
                href="/christmas"
                className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-black/25 px-4 text-sm font-semibold backdrop-blur hover:bg-black/40"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Christmas
              </Link>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge stage={status.stage} label={status.label} />
                </div>
                <h1 className="ghad-display mt-3 text-[2.5rem] leading-[0.95] font-extrabold tracking-[-0.04em] text-balance sm:text-7xl">
                  {view.title}
                </h1>
                <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-base font-semibold">
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
                        ? "Just you — invite your people"
                        : `${view.members.length} going`}
                    </a>
                  </li>
                </ul>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    href={`/adventures/${view.id}/guide`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-bold text-[#082319]"
                    data-testid="open-guide"
                  >
                    <BookOpen className="h-4 w-4" aria-hidden />
                    {status.stage === "done"
                      ? "The guide & memories"
                      : "Printable guide"}
                  </Link>
                  <Link
                    href={`/christmas/discover${view.destinationTownId ? `?at=${view.destinationTownId}` : ""}`}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-semibold hover:bg-white/25"
                  >
                    <Compass className="h-4 w-4" aria-hidden />
                    Find more Christmas
                  </Link>
                  <Link
                    href={`/saved?adventure=${encodeURIComponent(view.id)}`}
                    className="inline-flex min-h-11 items-center rounded-full bg-white/15 px-4 text-sm font-semibold hover:bg-white/25"
                    data-testid="add-from-saved"
                  >
                    Add from Saved
                  </Link>
                </div>
              </div>
            </div>
            <div className={styles.lights} aria-hidden />
          </header>

          <nav
            aria-label="This adventure"
            className="sticky top-0 z-20 border-b border-black/5 bg-[#fbf6ec]/95 backdrop-blur"
          >
            <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 sm:px-5">
              {tabs.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="inline-flex min-h-12 shrink-0 items-center rounded-full px-4 text-sm font-bold hover:bg-black/5"
                >
                  {label}
                </a>
              ))}
            </div>
          </nav>

          <div className="mx-auto max-w-5xl space-y-12 px-4 py-8 sm:px-6">
            <Notices
              adventureId={view.id}
              isOwner={view.role === "owner"}
              memberCount={view.members.length}
              initial={notices as NoticeData[]}
              stops={stopOptions}
              enabled={sharing}
            />
            {started && STARTED[started] && (
              <p
                role="status"
                data-testid="started-note"
                className="rounded-3xl bg-[#e3ede5] p-5 text-base font-semibold text-[#1f4a35]"
              >
                {STARTED[started]}
                {offDates > 0 &&
                  ` ${offDates === 1 ? "One thing you chose is" : `${offDates} things you chose are`} dated by Atlas outside these days, so ${offDates === 1 ? "it's" : "they're"} waiting as ideas.`}
              </p>
            )}
            <section id="plan" className="scroll-mt-16">
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
            </section>
            <section id="people" className="scroll-mt-16">
              <AdventurePeople
                adventureId={view.id}
                isOwner={view.role === "owner"}
                members={view.members}
                you={view.you}
                invites={invites}
              />
            </section>
            <Together
              adventureId={view.id}
              initial={moments}
              enabled={sharing}
              againHref={againHref}
              picks={picks}
              done={status.stage === "done"}
            />
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}

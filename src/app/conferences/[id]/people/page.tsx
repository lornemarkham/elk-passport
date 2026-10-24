import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Coffee,
  Footprints,
  Grid3x3,
  MapPin,
  MessageSquare,
  PlaneLanding,
  UtensilsCrossed,
} from "lucide-react";
import { agendaEntry } from "@/domain/conference/agenda";
import { FindMyPeople } from "@/components/conference-together/FindMyPeople";
import {
  Avatar,
  Panel,
  PageHead,
  PanelHead,
  Pill,
  wrap,
} from "@/components/conference/kit";
import {
  arrivalClock,
  arrivalStatus,
} from "@/components/conference/overview/Panels";
import { timeCell } from "@/components/conference-arrivals/words";
import { safeAccent } from "@/domain/conference/branding";
import { KIND_WORDS } from "@/domain/conference/details";
import { arrivalsEnabled } from "@/lib/conference-arrivals/enabled";
import { arrivalsDeps } from "@/lib/conference-arrivals/request";
import { readArrivals } from "@/lib/conference-arrivals/service";
import { anchorsFor } from "@/lib/conference-explore/places";
import { conferenceSetup } from "@/lib/conference/config";
import { deps, readIdentity } from "@/lib/conference/request";
import { homeFor } from "@/lib/conference/service";
import { readPeople } from "@/lib/conference-people/service";
import { readPlans } from "@/lib/conference-plans/service";
import { togetherEnabled } from "@/lib/conference-together/enabled";
import { peopleDeps, plansDeps } from "@/lib/conference-together/request";

export const dynamic = "force-dynamic";

const chip =
  "border-cf-line text-cf-ink hover:border-cf-ink/30 inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border bg-white px-3.5 text-[13px] font-semibold whitespace-nowrap transition";

/**
 * **People: who's here, and finding them.** Everyone who chose to be seen,
 * with what they chose to share — a flight on the board, where they are
 * right now — and an honest count of everyone who didn't. Then, when the
 * organiser switched it on, Find my people (ADR 011): share where you are
 * for a while, and see who else is.
 */
export default async function PeoplePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const setup = conferenceSetup();
  if (!setup.open) notFound();
  const identity = await readIdentity(setup.config);
  if (!identity) notFound();
  const d = deps();
  const now = d.now;
  const home = await homeFor(d, identity, (await params).id);
  if (!home) notFound();
  const { conference: c, you, people } = home;
  const words = KIND_WORDS[c.kind];
  const together = togetherEnabled();
  const findOn = c.modules.includes("people") && together;
  const arrivalsOn = c.modules.includes("arrivals") && arrivalsEnabled();
  const chatOn = c.modules.includes("community") && together;
  const base = `/conferences/${c.id}`;

  const [arrivals, sharing, board] = await Promise.all([
    arrivalsOn
      ? readArrivals(arrivalsDeps(), identity, c.id, false).catch(() => null)
      : null,
    findOn ? readPeople(peopleDeps(), identity, c.id).catch(() => null) : null,
    findOn && c.modules.includes("plans")
      ? readPlans(await plansDeps(c, 1500), identity, c.id).catch(() => null)
      : null,
  ]);
  const rows = arrivals?.board?.rows ?? [];
  const here = new Set((sharing?.people ?? []).map((p) => p.memberId));
  const listed = [
    { memberId: you.memberId, name: you.displayName ?? "You", you: true },
    ...people.visible
      .filter((p) => p.memberId !== you.memberId && p.displayName)
      .map((p) => ({ memberId: p.memberId, name: p.displayName!, you: false })),
  ];
  const quiet = people.total - listed.length;
  const plansOn = c.modules.includes("plans") && together;
  const bingoOn = c.modules.includes("bingo");
  // Walk & talk is offered at the next published break — the agenda's own
  // free minutes, not a time Passport made up.
  const nextBreak = (c.agenda ?? [])
    .filter(
      (i) =>
        i.kind === "break" &&
        Date.parse(agendaEntry(i, c.timeZone).startsAt) > now.getTime(),
    )
    .sort((a, b) =>
      `${a.day}${a.start}`.localeCompare(`${b.day}${b.start}`),
    )[0];
  const plansHref = (q: Record<string, string>) =>
    `${base}/plans?${new URLSearchParams(q)}`;
  const together4 = [
    {
      title: "Coffee crew",
      line: "Say when; whoever's around comes along.",
      Icon: Coffee,
      href: plansHref({ kind: "coffee", title: "Coffee crew" }),
    },
    {
      title: "Walk & talk",
      line: nextBreak
        ? `At the next break, ${nextBreak.start}. A lap outside and back.`
        : "A lap outside and back, between sessions.",
      Icon: Footprints,
      href: plansHref({
        kind: "morning-walk",
        title: "Walk & talk",
        ...(nextBreak
          ? {
              day: nextBreak.day,
              time: nextBreak.start,
              meeting: "Hotel lobby",
            }
          : {}),
      }),
    },
    {
      title: "Dinner plans",
      line: "Suggest a place, vote, go together.",
      Icon: UtensilsCrossed,
      href: plansHref({ kind: "dinner", title: "Dinner together" }),
    },
  ];
  const anchor = anchorsFor(c)[0];
  const pins = (board?.plans ?? [])
    .filter((p) => p.next && p.meeting?.place?.at)
    .map((p) => ({
      id: p.id,
      name: p.meeting!.label,
      at: p.meeting!.place!.at!,
    }));

  return (
    <>
      <PageHead
        eyebrow="People"
        title={`Who's here · ${people.total}`}
        lede="Only people who chose to be seen are listed, located or shown on the board."
      />
      <div className={`${wrap} pt-4 pb-16 sm:pt-6`}>
        {chatOn || findOn || arrivalsOn ? (
          <nav
            aria-label="Get together"
            className="cf-shelf -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
            data-testid="people-actions"
          >
            {chatOn ? (
              <Link href={`${base}/chat`} className={chip}>
                <MessageSquare className="h-4 w-4" strokeWidth={1.8} />
                Message the group
              </Link>
            ) : null}
            {findOn && sharing ? (
              <a href="#find" className={chip}>
                <MapPin className="h-4 w-4" strokeWidth={1.8} />
                Find my people
              </a>
            ) : null}
            {arrivalsOn ? (
              <Link href={`${base}/arrivals`} className={chip}>
                <PlaneLanding className="h-4 w-4" strokeWidth={1.8} />
                Meet at arrivals
              </Link>
            ) : null}
          </nav>
        ) : null}
        {plansOn || bingoOn ? (
          <section className="mt-5" data-testid="get-together">
            <p className="cf-eyebrow text-cf-mist">Meet someone new</p>
            <ul className="cf-shelf -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0">
              {bingoOn ? (
                <li className="w-[200px] shrink-0 snap-start sm:w-auto">
                  <Link
                    href={`${base}/bingo`}
                    className="bg-cf-sage flex h-full min-h-[124px] flex-col rounded-2xl p-4 text-white"
                    data-testid="bingo-link"
                  >
                    <Grid3x3
                      aria-hidden="true"
                      className="h-5 w-5"
                      strokeWidth={1.8}
                    />
                    <span className="cf-serif mt-3 text-[18px] leading-tight">
                      Get-to-know-you Bingo
                    </span>
                    <span className="mt-1 text-[13px] text-white/80">
                      Nine ways to meet someone. Just for fun.
                    </span>
                  </Link>
                </li>
              ) : null}
              {plansOn
                ? together4.map((t) => (
                    <li
                      key={t.title}
                      className="w-[200px] shrink-0 snap-start sm:w-auto"
                    >
                      <Link
                        href={t.href}
                        className="border-cf-line hover:border-cf-ink/30 flex h-full min-h-[124px] flex-col rounded-2xl border bg-white p-4"
                      >
                        <t.Icon
                          aria-hidden="true"
                          className="text-cf-brass h-5 w-5"
                          strokeWidth={1.8}
                        />
                        <span className="cf-serif text-cf-ink mt-3 text-[18px] leading-tight">
                          {t.title}
                        </span>
                        <span className="text-cf-slate mt-1 text-[13px]">
                          {t.line}
                        </span>
                      </Link>
                    </li>
                  ))
                : null}
            </ul>
          </section>
        ) : null}
        <Panel as="div" className="mt-4 overflow-hidden">
          <ul
            className="divide-cf-line grid grid-cols-1 divide-y lg:grid-cols-2 lg:divide-y-0"
            data-testid="people-directory"
          >
            {listed.map((p) => {
              const row = rows.find((r) => r.memberId === p.memberId);
              const t = row ? timeCell(row, c.timeZone) : null;
              const s = row ? arrivalStatus(row, now, c.timeZone) : null;
              const from = row?.from?.city ?? row?.from?.name;
              return (
                <li
                  key={p.memberId}
                  className="lg:border-cf-line flex min-h-16 min-w-0 items-center gap-3 px-4 py-3 sm:px-5 lg:border-b lg:last:border-b-0 lg:odd:border-r lg:[&:nth-last-child(2):nth-child(odd)]:border-b-0"
                >
                  <span className="relative shrink-0">
                    <Avatar
                      name={p.you ? (you.displayName ?? "You") : p.name}
                      you={p.you}
                      size={40}
                    />
                    {here.has(p.memberId) ? (
                      <span
                        aria-hidden="true"
                        className="bg-cf-sage absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full ring-2 ring-white"
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="text-cf-ink min-w-0 flex-1 truncate text-[15px] font-semibold">
                        {p.name}
                        {p.you ? (
                          <span className="text-cf-mist font-normal">
                            {" "}
                            · you
                          </span>
                        ) : null}
                      </p>
                      {s ? (
                        <Pill
                          tone={s.tone}
                          dot={s.tone === "live"}
                          className="shrink-0 max-[369px]:hidden"
                        >
                          {s.label}
                        </Pill>
                      ) : null}
                    </div>
                    {row && t && s ? (
                      <p className="text-cf-slate truncate text-[13px]">
                        {row.flight}
                        {from ? ` from ${from}` : ""} ·{" "}
                        {t.tag.toLowerCase() === "leaves" ? "leaves" : "lands"}{" "}
                        {arrivalClock(row, now, c.timeZone, t.time)}
                      </p>
                    ) : (
                      <p className="text-cf-mist truncate text-[13px]">
                        {p.you && !you.displayName
                          ? "Not seen by others yet"
                          : "No flight shared"}
                      </p>
                    )}
                    {s ? (
                      // On the narrowest phones the name keeps the line.
                      <Pill
                        tone={s.tone}
                        dot={s.tone === "live"}
                        className="mt-1 min-[370px]:hidden"
                      >
                        {s.label}
                      </Pill>
                    ) : null}
                    {here.has(p.memberId) ? (
                      <p className="text-cf-sage text-[12px] font-semibold">
                        Sharing location
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
        <p className="text-cf-mist mt-4 text-[13px]">
          {quiet > 0
            ? `${quiet === 1 ? "One more person is" : `${quiet} more people are`} in this ${words.noun} without being listed. Organisers can see who has joined; nobody else can.`
            : "Everyone here has chosen to be seen."}
          {!you.displayName || you.visibility !== "members"
            ? " You can choose how you appear under your profile."
            : ""}
        </p>

        {findOn && sharing ? (
          <section id="find" className="mt-10 scroll-mt-24 sm:mt-14">
            <PanelHead
              eyebrow="Find my people"
              title="Meet up without a group text"
            />
            <p className="text-cf-slate mt-1 max-w-[60ch] text-[14px]">
              Lost the group between the hotel and the restaurant? Share where
              you are for a while, see who else is, and walk over. It stops on
              its own, or the moment you say so.
            </p>
            <div className="-mx-4 sm:-mx-8">
              <FindMyPeople
                conferenceId={c.id}
                initial={sharing}
                centre={anchor?.at ?? sharing.people[0]?.at ?? null}
                pins={pins}
                accent={safeAccent(c.branding.accent)}
              />
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

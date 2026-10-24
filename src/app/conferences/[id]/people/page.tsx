import { notFound } from "next/navigation";
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

  const [arrivals, sharing, board] = await Promise.all([
    c.modules.includes("arrivals") && arrivalsEnabled()
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
        lede={`Everyone in ${c.name} who chose to be seen. Nobody is listed, located or shown on the board unless they decided to be.`}
      />
      <div className={`${wrap} pt-6 pb-16`}>
        <ul
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="people-directory"
        >
          {listed.map((p) => {
            const row = rows.find((r) => r.memberId === p.memberId);
            const t = row ? timeCell(row, c.timeZone) : null;
            const s = row ? arrivalStatus(row, now, c.timeZone) : null;
            const from = row?.from?.city ?? row?.from?.name;
            return (
              <li key={p.memberId}>
                <Panel as="div" className="flex h-full items-start gap-4 p-5">
                  <Avatar
                    name={p.you ? (you.displayName ?? "You") : p.name}
                    you={p.you}
                    size={44}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-cf-ink truncate text-[16px] font-semibold">
                      {p.name}
                      {p.you ? (
                        <span className="text-cf-mist font-normal"> · you</span>
                      ) : null}
                    </p>
                    {row && t && s ? (
                      <p className="text-cf-slate mt-1 text-[13px]">
                        {row.flight}
                        {from ? ` from ${from}` : ""} ·{" "}
                        {t.tag.toLowerCase() === "leaves" ? "leaves" : "lands"}{" "}
                        {arrivalClock(row, now, c.timeZone, t.time)}
                      </p>
                    ) : (
                      <p className="text-cf-mist mt-1 text-[13px]">
                        {p.you && !you.displayName
                          ? "Not seen by others yet"
                          : "No flight shared"}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s ? (
                        <Pill tone={s.tone} dot={s.tone === "live"}>
                          {s.label}
                        </Pill>
                      ) : null}
                      {here.has(p.memberId) ? (
                        <Pill tone="live" dot>
                          Sharing location
                        </Pill>
                      ) : null}
                    </div>
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
        <p className="text-cf-mist mt-4 text-[13px]">
          {quiet > 0
            ? `${quiet === 1 ? "One more person is" : `${quiet} more people are`} in this ${words.noun} without being listed. Organisers can see who has joined; nobody else can.`
            : "Everyone here has chosen to be seen."}
          {!you.displayName || you.visibility !== "members"
            ? " You can choose how you appear under your profile."
            : ""}
        </p>

        {findOn && sharing ? (
          <section id="find" className="mt-14 scroll-mt-24">
            <PanelHead
              eyebrow="Find my people"
              title="Meet up without a group text"
            />
            <p className="text-cf-slate mt-1 max-w-[60ch] text-[14px]">
              Lost the group between the hotel and the restaurant? Share where
              you are for a while, see who else is, and walk over. It stops on
              its own, or the moment you say so.
            </p>
            <div className="-mx-5 sm:-mx-8">
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

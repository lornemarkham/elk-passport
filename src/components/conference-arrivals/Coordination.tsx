import Link from "next/link";
import type {
  ArrivalsDigest,
  DigestEntry,
} from "@/domain/conference-arrivals/digest";
import { clock, dayWords } from "@/domain/conference-plans/time";
import {
  Avatar,
  AvatarStack,
  btn,
  PanelHead,
} from "@/components/conference/kit";

const when = (e: DigestEntry, timeZone: string) =>
  e.at
    ? `${e.kind === "estimated" ? "~" : ""}${clock(new Date(e.at), timeZone)}${
        e.kind === "scheduled"
          ? " (scheduled)"
          : e.kind === "estimated"
            ? " (estimate)"
            : e.inferred
              ? " (landed?)"
              : ""
      }`
    : "time not shared";

/**
 * **Who's here, who's next, when everyone lands, and who can wait for whom.**
 * Read from the board's own rows (`digest.ts`), so every time keeps its kind.
 * Coordinating is a plan, not a new system: "Meet at arrivals" opens Plans
 * already filled in, and the plan's thread is where people say "I'm at
 * carousel 7".
 */
export function Coordination({
  conferenceId,
  digest: d,
  timeZone,
  now,
  plansOn,
}: {
  conferenceId: string;
  digest: ArrivalsDigest;
  timeZone: string;
  now: Date;
  plansOn: boolean;
}) {
  const meetHref = (g: ArrivalsDigest["together"][number]) => {
    const last = new Date(Date.parse(g.to) + 15 * 60_000);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
    }).format(last);
    return `/conferences/${conferenceId}/plans?${new URLSearchParams({
      kind: "custom",
      title: `Ride in from ${d.airport} together`,
      meeting: `${d.airport} arrivals hall`,
      day: g.day,
      time: parts,
    })}`;
  };
  return (
    <div data-testid="arrivals-coordination" className="space-y-10">
      <section>
        <PanelHead eyebrow="Who's here" title={`${d.landed.length} landed`} />
        {d.landed.length ? (
          <ul className="mt-4 flex flex-wrap gap-2" data-testid="landed">
            {d.landed.map((e) => (
              <li
                key={e.memberId}
                className="border-cf-line flex items-center gap-2 rounded-full border bg-white py-1 pr-3 pl-1 text-[14px]"
              >
                <Avatar name={e.name} you={e.you} size={26} />
                <span className="text-cf-ink font-semibold">{e.name}</span>
                <span className="text-cf-mist">{when(e, timeZone)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-cf-slate mt-3 text-[14px]">
            Nobody has landed yet.
          </p>
        )}
      </section>

      <section>
        <PanelHead
          eyebrow="Arriving next"
          title={d.next ? d.next.name : "No times shared yet"}
        />
        {d.next ? (
          <p
            className="text-cf-slate mt-2 text-[15px]"
            data-testid="arriving-next"
          >
            {d.next.flight} · {dayWords(new Date(d.next.at!), timeZone, now)}{" "}
            {when(d.next, timeZone)}
          </p>
        ) : (
          <p className="text-cf-slate mt-2 text-[14px]">
            Arrival times appear when people add them from their bookings.
          </p>
        )}
      </section>

      {d.together.length ? (
        <section>
          <PanelHead eyebrow="Landing together" title="Share the ride in" />
          <p className="text-cf-slate mt-1 text-[14px]">
            Close enough to wait for each other at {d.airport}.
          </p>
          <ul
            className="mt-4 grid gap-3 sm:grid-cols-2"
            data-testid="landing-together"
          >
            {d.together.map((g) => (
              <li
                key={g.from}
                className="border-cf-line rounded-2xl border bg-white p-5"
              >
                <div className="flex items-center gap-3">
                  <AvatarStack
                    names={g.people.map((p) => (p.you ? "You" : p.name))}
                    size={28}
                  />
                  <p className="text-cf-ink text-[15px] font-semibold">
                    {g.people.map((p) => (p.you ? "You" : p.name)).join(" & ")}
                  </p>
                </div>
                <p className="text-cf-slate mt-2 text-[13px]">
                  {dayWords(new Date(g.from), timeZone, now)},{" "}
                  {clock(new Date(g.from), timeZone)}–
                  {clock(new Date(g.to), timeZone)} at {d.airport}
                </p>
                {plansOn ? (
                  <Link href={meetHref(g)} className={`${btn.primary} mt-4`}>
                    Meet at arrivals
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

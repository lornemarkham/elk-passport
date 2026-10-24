import Link from "next/link";
import type {
  ArrivalsDigest,
  DigestEntry,
} from "@/domain/conference-arrivals/digest";
import { clock, dayWords, utcToZoned } from "@/domain/conference-plans/time";
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
  const meetHref = (
    g: { to: string; day: string },
    title = `Ride in from ${d.airport} together`,
  ) => {
    const last = new Date(Date.parse(g.to) + 15 * 60_000);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hourCycle: "h23",
      hour: "2-digit",
      minute: "2-digit",
    }).format(last);
    return `/conferences/${conferenceId}/plans?${new URLSearchParams({
      kind: "custom",
      title,
      meeting: `${d.airport} arrivals hall`,
      day: g.day,
      time: parts,
    })}`;
  };
  // Your own landing still to come, and nobody near it: offer a ride anyway.
  const yours = d.timeline
    .flatMap((t) => t.entries)
    .find((e) => e.you && e.at && e.kind !== "landed");
  const offer =
    plansOn &&
    yours &&
    Date.parse(yours.at!) > now.getTime() &&
    !d.together.some((g) => g.people.some((p) => p.you))
      ? { to: yours.at!, day: utcToZoned(new Date(yours.at!), timeZone).ymd }
      : null;
  return (
    <div
      data-testid="arrivals-coordination"
      className="space-y-8 sm:space-y-10"
    >
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

      <section data-testid="arriving-next">
        <PanelHead
          eyebrow="Arriving next"
          title={d.next ? d.next.name : "No times shared yet"}
        />
        {d.next ? (
          <p className="text-cf-slate mt-2 text-[15px]">
            {d.next.flight} · {dayWords(new Date(d.next.at!), timeZone, now)}{" "}
            {when(d.next, timeZone)}
          </p>
        ) : (
          <p className="text-cf-slate mt-2 text-[14px]">
            Arrival times appear when people add them from their bookings.
          </p>
        )}
      </section>

      {offer ? (
        <section data-testid="offer-ride">
          <PanelHead eyebrow="Getting in" title="Share the ride in" />
          <p className="text-cf-slate mt-1 text-[14px] leading-relaxed">
            Nobody else lands close to you yet. Offer a ride from {d.airport}
            {" — "}it becomes a plan colleagues can join, with its own thread.
          </p>
          <Link
            href={meetHref(offer, `Ride in from ${d.airport}`)}
            className={`${btn.secondary} mt-4`}
          >
            Offer a ride from {d.airport}
          </Link>
        </section>
      ) : null}

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
                className="border-cf-line rounded-2xl border bg-white p-4 sm:p-5"
              >
                <div className="flex items-center gap-3">
                  <AvatarStack
                    names={g.people.map((p) => (p.you ? "You" : p.name))}
                    size={28}
                  />
                  <p className="text-cf-ink text-[15px] font-semibold">
                    {g.people.map((p) => (p.you ? "You" : p.name)).join(", ")}
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

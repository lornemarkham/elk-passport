import Link from "next/link";
import type {
  ArrivalsDigest,
  DigestEntry,
} from "@/domain/conference-arrivals/digest";
import { clock, dayWords } from "@/domain/conference-plans/time";
import { Section } from "@/components/conference/ui";

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
    <div data-testid="arrivals-coordination">
      <Section title={`Who's here · ${d.landed.length}`}>
        {d.landed.length ? (
          <ul className="flex flex-wrap gap-2" data-testid="landed">
            {d.landed.map((e) => (
              <li
                key={e.memberId}
                className="rounded-full bg-black/5 px-3 py-1.5 text-[15px]"
              >
                ✅ {e.name}{" "}
                <span className="text-black/50">· {when(e, timeZone)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px] text-black/55">Nobody has landed yet.</p>
        )}
      </Section>

      <Section title="Arriving next">
        {d.next ? (
          <p className="text-[18px] font-bold" data-testid="arriving-next">
            ✈️ {d.next.name} · {d.next.flight} ·{" "}
            {dayWords(new Date(d.next.at!), timeZone, now)}{" "}
            {when(d.next, timeZone)}
          </p>
        ) : (
          <p className="text-[15px] text-black/55">
            No arrival times shared yet.
          </p>
        )}
      </Section>

      {d.together.length ? (
        <Section
          title="Landing together"
          hint="Close enough to wait for each other and share a ride."
        >
          <ul className="flex flex-col gap-2" data-testid="landing-together">
            {d.together.map((g) => (
              <li
                key={g.from}
                className="rounded-2xl border border-black/10 p-4"
              >
                <p className="text-[16px] font-bold">
                  {g.people.map((p) => p.name).join(", ")}
                </p>
                <p className="text-[14px] text-black/60">
                  {dayWords(new Date(g.from), timeZone, now)},{" "}
                  {clock(new Date(g.from), timeZone)}–
                  {clock(new Date(g.to), timeZone)} at {d.airport}
                </p>
                {plansOn ? (
                  <Link
                    href={meetHref(g)}
                    className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-black px-3 text-[14px] font-bold text-white"
                  >
                    Meet at arrivals
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {d.timeline.length ? (
        <Section title="Arrival timeline">
          <ol className="flex flex-col gap-4" data-testid="arrival-timeline">
            {d.timeline.map((t) => (
              <li key={t.day}>
                <p className="text-[15px] font-black">
                  {dayWords(new Date(`${t.day}T20:00:00Z`), timeZone, now)}
                </p>
                <ol className="mt-1 border-l-2 border-black/15 pl-3">
                  {t.entries.map((e) => (
                    <li key={e.memberId} className="py-1 text-[15px]">
                      <span className="font-semibold">{when(e, timeZone)}</span>{" "}
                      · {e.name} ·{" "}
                      <span className="text-black/55">{e.flight}</span>
                      {e.kind === "landed" ? " ✅" : ""}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
    </div>
  );
}

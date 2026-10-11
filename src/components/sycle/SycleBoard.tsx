"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type {
  AdventureInterest,
  Board,
  BoardArrival,
  Participant,
} from "@/domain/sycle/board";
import { ArrivalMap } from "./ArrivalMap";
import { Demo, MyFlight } from "./MyFlight";
import {
  ago,
  clock,
  countdown,
  dayOf,
  delayLine,
  landsAt,
  progressLabel,
  statusLine,
} from "./words";

export interface AdventureCard {
  readonly id: string;
  readonly title: string;
  readonly locality: string | null;
  readonly picture: string | null;
  readonly href: string | null;
  readonly because: string;
}

export interface BoardPayload {
  readonly board: Board;
  readonly me: Omit<Participant, "id"> | null;
  readonly interest: Readonly<Record<string, AdventureInterest>>;
  readonly expiresAt: string;
}

/**
 * **The Sycle arrival board.**
 *
 * Top to bottom, in the order a traveller's attention actually goes: *when do
 * I land*, *who else is coming*, *what are we doing when we get there*. The
 * last one belongs to GO HAVE A DAY — this page hands over to `/go` rather
 * than growing its own idea of Vancouver.
 *
 * Polls the board every minute. That cannot cost money: viewers read a
 * shared cache, and only a stale flight is ever re-asked (`refresh.ts`).
 */
export function SycleBoard({
  initial,
  adventures,
  doors,
  lookupConnected,
  today,
  renderedAt,
}: {
  readonly initial: BoardPayload;
  /** The server's clock, so the first paint's countdowns match on hydration. */
  readonly renderedAt: string;
  readonly adventures: readonly AdventureCard[] | null;
  readonly doors: readonly { label: string; href: string }[];
  readonly lookupConnected: boolean;
  readonly today: string;
}) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(() => new Date(renderedAt));

  const reload = useCallback(async () => {
    const r = await fetch("/api/sycle/board", { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30_000);
    const poll = setInterval(reload, 60_000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [reload]);

  const { board, me } = data;
  const mine = board.arrivals.find((a) => a.isYou) ?? null;
  const others = board.arrivals.filter((a) => !a.isYou);
  const next = others.find(
    (a) => a.phase !== "landed" && a.phase !== "cancelled" && a.lands,
  );
  const anyDemo = board.arrivals.some((a) => a.demo);

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-8 pb-24 sm:px-8">
      <style>{STYLE}</style>
      {anyDemo ? (
        <p className="mb-4 rounded-lg bg-[#ff7a59] px-3 py-2 text-[13px] font-bold text-black">
          DEMO FLIGHTS — invented by a pretend airline for building this page.
          Not real aircraft, not real times.
        </p>
      ) : null}

      <header>
        <p className="text-[12px] font-bold tracking-[0.18em] text-[#ffd27a] uppercase">
          Sycle · Vancouver
        </p>
        <Hero mine={mine} next={next ?? null} now={now} counts={board.counts} />
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ArrivalMap arrivals={board.arrivals} now={now} />
        </div>
        <div className="flex flex-col gap-6">
          <MyFlight
            me={me}
            lookupConnected={lookupConnected}
            onChanged={reload}
            today={today}
          />
          <Arrivals arrivals={board.arrivals} now={now} />
        </div>
      </div>

      <Welcome
        landed={mine?.phase === "landed"}
        doors={doors}
        adventures={adventures}
        interest={data.interest}
        onChanged={reload}
      />

      <footer className="mt-16 border-t border-white/10 pt-6 text-[12px] leading-relaxed text-white/40">
        <p>
          Only people with the conference code can see this page. Nobody appears
          on it unless they choose to, nobody else ever sees your flight number,
          and everything here is erased on {dayOf(data.expiresAt)}{" "}
          {new Date(data.expiresAt).getFullYear()}.
        </p>
        <p className="mt-1">
          Flight times come from the airline data provider and are checked a few
          times an hour near take-off and landing. Positions on the map are
          worked out from those times — Passport can&apos;t see aeroplanes.
        </p>
      </footer>
    </div>
  );
}

function Hero({
  mine,
  next,
  now,
  counts,
}: {
  mine: BoardArrival | null;
  next: BoardArrival | null;
  now: Date;
  counts: Board["counts"];
}) {
  const until = (a: BoardArrival) => Date.parse(a.lands!.at) - now.getTime();
  let headline: React.ReactNode;
  let sub: string;
  if (mine?.phase === "landed") {
    headline = "You made it. Welcome to Vancouver.";
    sub = `It's ${clock(now.toISOString())} here. Shake off the flight — the good part starts now.`;
  } else if (
    mine &&
    mine.lands &&
    mine.phase !== "cancelled" &&
    mine.phase !== "diverted"
  ) {
    headline = (
      <>
        You land in{" "}
        <span className="text-[#ffd27a]">{countdown(until(mine))}</span>
      </>
    );
    sub = `${mine.from.city} → Vancouver · ${landsAt(mine.lands, now)}${
      mine.phase === "airborne" && mine.estimated
        ? ` · ${progressLabel(mine.estimated.fraction)}`
        : ""
    }`;
  } else if (mine?.phase === "cancelled" || mine?.phase === "diverted") {
    headline = "Your flight's having a day.";
    sub = statusLine(mine, now);
  } else {
    headline = "Everyone's coming to Vancouver.";
    sub =
      "Add your flight to see your countdown — and, if you like, to wave at everyone else on the way in.";
  }
  return (
    <>
      <h1
        className="mt-2 max-w-[22ch] text-[40px] leading-[0.95] font-black tracking-[-0.04em] text-white sm:text-[68px]"
        data-testid="sycle-headline"
      >
        {headline}
      </h1>
      <p className="mt-4 max-w-[60ch] text-[16px] text-white/65">{sub}</p>
      <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-white">
        <Stat label="on the way" value={counts.onTheWay} />
        <Stat label="in Vancouver" value={counts.inVancouver} />
        <Stat
          label={counts.cities === 1 ? "city" : "cities"}
          value={counts.cities}
        />
        {next?.lands ? (
          <div>
            <dt className="text-[12px] text-white/50">
              next colleague lands in
            </dt>
            <dd className="text-[26px] font-black tabular-nums">
              {countdown(until(next))}
            </dd>
          </div>
        ) : null}
      </dl>
    </>
  );
}

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div>
    <dt className="text-[12px] text-white/50">{label}</dt>
    <dd className="text-[26px] font-black tabular-nums">{value}</dd>
  </div>
);

function Arrivals({
  arrivals,
  now,
}: {
  arrivals: readonly BoardArrival[];
  now: Date;
}) {
  if (arrivals.length === 0)
    return (
      <p className="text-[14px] text-white/50">
        Nobody on the board yet. Somebody has to be first — it could be you.
      </p>
    );
  return (
    <section>
      <h2 className="text-[13px] font-bold tracking-[0.14em] text-[#ffd27a] uppercase">
        Arrivals
      </h2>
      <ol
        className="mt-3 flex flex-col divide-y divide-white/10"
        data-testid="sycle-arrivals"
      >
        {arrivals.map((a) => {
          const late = delayLine(a);
          return (
            <li
              key={a.id}
              className="flex items-start gap-3 py-3"
              data-phase={a.phase}
            >
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[a.phase]}`}
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-bold text-white">
                  {a.isYou ? "You" : (a.name ?? "A colleague")}
                  <span className="font-normal text-white/50">
                    from {a.from.city}
                  </span>
                  {a.demo ? <Demo /> : null}
                </p>
                <p className="text-[13px] text-white/65">
                  {statusLine(a, now)}
                </p>
                {a.phase === "airborne" && a.estimated ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 w-32 overflow-hidden rounded bg-white/10">
                      <div
                        className="h-full bg-[#ffd27a]"
                        style={{ width: `${a.estimated.fraction * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-white/45">
                      {progressLabel(a.estimated.fraction)}
                    </span>
                  </div>
                ) : null}
                <p className="mt-0.5 text-[11px] text-white/35">
                  {late ? (
                    <span className="mr-2 text-[#ffb59e]">{late}</span>
                  ) : null}
                  {a.km ? `${a.km.toLocaleString("en-CA")} km · ` : ""}checked{" "}
                  {ago(a.checkedAt, now)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const DOT: Record<BoardArrival["phase"], string> = {
  scheduled: "border border-white/40",
  "due-out": "border border-[#ffd27a]",
  airborne: "bg-[#ffd27a] sycle-blink",
  landed: "bg-[#7fe0a8]",
  cancelled: "bg-[#ff7a59]",
  diverted: "bg-[#ff7a59]",
};

function Welcome({
  landed,
  doors,
  adventures,
  interest,
  onChanged,
}: {
  landed: boolean;
  doors: readonly { label: string; href: string }[];
  adventures: readonly AdventureCard[] | null;
  interest: Readonly<Record<string, AdventureInterest>>;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const toggle = async (id: string, isIn: boolean) => {
    setPending(id);
    await fetch("/api/sycle/adventures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adventureId: id, in: isIn }),
    });
    setPending(null);
    onChanged();
  };

  return (
    <section
      className={`mt-16 rounded-3xl p-6 sm:p-10 ${landed ? "bg-[#ffd27a] text-black" : "bg-white text-black"}`}
      data-testid="sycle-welcome"
    >
      <p className="text-[12px] font-bold tracking-[0.18em] text-black/50 uppercase">
        {landed ? "You're here" : "When you land"}
      </p>
      <h2 className="mt-2 text-[34px] leading-[0.95] font-black tracking-[-0.04em] sm:text-[52px]">
        What do you want to do in Vancouver?
      </h2>
      <p className="mt-3 max-w-[56ch] text-[16px] text-black/60">
        Say it the way you&apos;d say it to a friend and Go have a day will
        build it out of real places. Or say you&apos;re in on something below,
        and see who else is.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {doors.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-2.5 text-[14px] font-bold text-white transition hover:bg-black/80"
          >
            {d.label} <ArrowRight size={14} />
          </Link>
        ))}
      </div>

      <h3 className="mt-10 text-[13px] font-bold tracking-[0.14em] text-black/50 uppercase">
        Shared adventures
      </h3>
      {adventures === null ? (
        <p className="mt-3 text-[14px] text-black/60">
          Passport couldn&apos;t reach Atlas just now, so there&apos;s nothing
          to be in on yet. The buttons above still open Go have a day.
        </p>
      ) : adventures.length === 0 ? (
        <p className="mt-3 text-[14px] text-black/60">
          Nothing to suggest yet — try one of the doors above.
        </p>
      ) : (
        <ul
          className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="sycle-adventures"
        >
          {adventures.map((a) => {
            const who = interest[a.id];
            const youreIn = who?.youreIn ?? false;
            const others = (who?.count ?? 0) - (youreIn ? 1 : 0);
            const named = (who?.names ?? []).filter((n) => n !== "you");
            const anon = others - named.length;
            return (
              <li
                key={a.id}
                className="overflow-hidden rounded-2xl border border-black/10 bg-white"
              >
                {a.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted, outside the Next image pipeline
                  <img
                    src={a.picture}
                    alt=""
                    loading="lazy"
                    className="aspect-[16/9] w-full object-cover"
                  />
                ) : (
                  <div className="aspect-[16/9] w-full bg-gradient-to-br from-[#123a5c] to-[#1f4a6b]" />
                )}
                <div className="p-4">
                  <p className="text-[17px] leading-tight font-extrabold">
                    {a.href ? (
                      <Link href={a.href} className="hover:underline">
                        {a.title}
                      </Link>
                    ) : (
                      a.title
                    )}
                  </p>
                  {a.locality ? (
                    <p className="text-[12px] text-black/50">{a.locality}</p>
                  ) : null}
                  <p className="mt-2 line-clamp-2 text-[13px] text-black/60">
                    {a.because}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[12px] text-black/55">
                      {others === 0
                        ? youreIn
                          ? "You're the first. Bring someone."
                          : "Nobody yet."
                        : [named.join(", "), anon > 0 ? `${anon} more` : ""]
                            .filter(Boolean)
                            .join(" + ") +
                          (others === 1 ? " is in" : " are in")}
                    </span>
                    <button
                      disabled={pending === a.id}
                      onClick={() => toggle(a.id, !youreIn)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition ${
                        youreIn
                          ? "bg-black text-white"
                          : "border border-black/20 hover:border-black"
                      }`}
                    >
                      {youreIn ? "I'm in ✓" : "I'm in"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-[12px] text-black/45">
        &ldquo;I&apos;m in&rdquo; shows your name only if you&apos;re on the
        board by name. Otherwise you&apos;re counted, not named.
      </p>
    </section>
  );
}

const STYLE = `
.sycle-input{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:.7rem .9rem;color:#fff;font-size:16px;outline:none}
.sycle-input:focus{border-color:#ffd27a}
.sycle-input::placeholder{color:rgba(255,255,255,.35)}
.sycle-button{background:#ffd27a;color:#111;font-weight:800;border-radius:12px;padding:.7rem 1.2rem;transition:transform .15s}
.sycle-button:hover:not(:disabled){transform:translateY(-1px)}
.sycle-button:disabled{opacity:.45}
.sycle-chip{border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:.4rem .85rem;font-size:13px;font-weight:600}
.sycle-chip:hover{border-color:#fff}
@keyframes sycle-pulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(1.6);opacity:0}}
.sycle-pulse{transform-box:fill-box;transform-origin:center;animation:sycle-pulse 2.6s ease-out infinite}
@keyframes sycle-blink{50%{opacity:.35}}
.sycle-blink{animation:sycle-blink 1.6s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.sycle-pulse,.sycle-blink{animation:none}}
`;

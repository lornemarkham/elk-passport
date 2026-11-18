"use client";

import { useMemo, useState } from "react";
import { kindOf, type Pulse } from "@/lib/pulse/model";
import type { Breakdown, Results as R, Share } from "@/lib/pulse/results";
import { AskCircle } from "./AskCircle";
import {
  NormalView,
  RankingView,
  ReasonsView,
  VerdictBanner,
} from "./ModeResults";
import { Bars, Legend, StackRow, n } from "./parts";
import { PulseMap } from "./PulseMap";
import { ResultsCard } from "./ResultsCard";
import { Shifts } from "./Shifts";
import { Spread } from "./Spread";

type Group = {
  key: string;
  name: string;
  b: Breakdown;
  kind: "circle" | "place";
};

/**
 * **Compare a group with everyone.** Your circle first (the people your link
 * reached), then provinces and cities that have enough votes to show.
 */
function Compare({ results }: { results: R }) {
  const groups: Group[] = useMemo(
    () => [
      ...(results.circle
        ? [
            {
              key: "circle",
              name: "Your circle",
              b: results.circle,
              kind: "circle" as const,
            },
          ]
        : []),
      ...results.provinces.map((p) => ({
        key: `p:${p.key}`,
        name: p.name,
        b: p,
        kind: "place" as const,
      })),
      ...results.cities.map((c) => ({
        key: `c:${c.key}`,
        name: c.name,
        b: c,
        kind: "place" as const,
      })),
    ],
    [results],
  );
  const [pick, setPick] = useState(groups[0]?.key ?? "");
  const chosen = groups.find((g) => g.key === pick) ?? groups[0];
  const everyone = {
    total: results.total,
    counted: results.total,
    shares: results.everyone,
  };
  return (
    <section
      aria-labelledby="pulse-compare"
      className="rounded-2xl border border-[#e7e3da] bg-white p-4"
      data-testid="pulse-compare"
    >
      <h2 id="pulse-compare" className="text-[15px] font-semibold">
        Compare
      </h2>
      <div
        role="tablist"
        aria-label="Group to compare"
        className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {groups.map((g) => (
          <button
            key={g.key}
            role="tab"
            type="button"
            aria-selected={chosen?.key === g.key}
            onClick={() => setPick(g.key)}
            data-testid={`pulse-group-${g.key}`}
            className={`min-h-10 shrink-0 rounded-full border px-4 text-[14px] font-medium ${
              chosen?.key === g.key
                ? "border-[#14161a] bg-[#14161a] text-white"
                : "border-[#d9d4c8] bg-white text-[#3f4550]"
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-4" role="tabpanel">
        <StackRow name="Everyone" b={everyone} testId="pulse-row-everyone" />
        {chosen ? (
          chosen.b.shares ? (
            <StackRow
              name={chosen.name}
              b={chosen.b as Breakdown & { shares: readonly Share[] }}
              testId="pulse-row-group"
            />
          ) : (
            <p
              className="rounded-xl bg-[#f3f1ec] p-3 text-[14px] text-[#3f4550]"
              data-testid="pulse-row-hidden"
            >
              {chosen.kind === "circle"
                ? `Your circle has ${chosen.b.total} vote${chosen.b.total === 1 ? "" : "s"} so far. Its answers appear at ${results.minGroup}, so no one's vote can be picked out.`
                : `Fewer than ${results.minGroup} votes here so far.`}
            </p>
          )
        ) : null}
        <Legend shares={results.everyone} />
        {results.circle ? (
          <p
            className="text-[13px] text-[#5c6370]"
            data-testid="pulse-circle-count"
          >
            {results.circle.joinedViaYou === 0
              ? "No one has voted through your link yet."
              : `${results.circle.joinedViaYou} ${results.circle.joinedViaYou === 1 ? "person has" : "people have"} voted through your link${results.circle.total - results.circle.joinedViaYou > 0 ? `, ${results.circle.total} in your circle counting you and who they shared with` : ""}.`}
          </p>
        ) : null}
        <p className="text-[12.5px] text-[#5c6370]">
          Groups show only with {results.minGroup}+ votes and update in steps of{" "}
          {results.minGroup}. Places are self-reported, not verified.
          {results.otherPlaces > 0
            ? ` ${results.otherPlaces} vote${results.otherPlaces === 1 ? "" : "s"} from provinces with too few to show.`
            : ""}
          {results.unplaced > 0
            ? ` ${results.unplaced} didn't say where they are.`
            : ""}
        </p>
      </div>
    </section>
  );
}

/** ORIGINAL CLAIM vs PEOPLE'S PULSE PARTICIPANTS, with the honest caveat. */
function Claim({ c }: { c: NonNullable<R["claim"]> }) {
  return (
    <section
      aria-labelledby="pulse-claim"
      className="rounded-2xl border border-[#e7e3da] bg-white p-4"
      data-testid="pulse-claim"
    >
      <h2 id="pulse-claim" className="text-[15px] font-semibold">
        The claim, beside these responses
      </h2>
      <p className="mt-1 text-[14px] text-[#3f4550]">“{c.text}”</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#f3f1ec] p-3">
          <p className="text-[11.5px] font-semibold tracking-[0.12em] text-[#5c6370] uppercase">
            Original claim
          </p>
          <p
            className="mt-1 text-[34px] leading-none font-bold tabular-nums"
            data-testid="pulse-claim-original"
          >
            {c.claimed}%
          </p>
          <p className="mt-1 text-[12.5px] text-[#5c6370]">said “{c.label}”</p>
        </div>
        <div className="rounded-xl bg-[#f3f1ec] p-3">
          <p className="text-[11.5px] font-semibold tracking-[0.12em] text-[#5c6370] uppercase">
            People&apos;s Pulse participants
          </p>
          <p
            className="mt-1 text-[34px] leading-none font-bold tabular-nums"
            data-testid="pulse-claim-pulse"
          >
            {c.pulse === null ? "—" : `${c.pulse}%`}
          </p>
          <p className="mt-1 text-[12.5px] text-[#5c6370]">
            {c.pulse === null ? "shown after 5 votes" : `said “${c.label}”`}
          </p>
        </div>
      </div>
      {c.published || c.measures || c.method ? (
        <dl
          className="mt-3 grid gap-1 text-[13px] text-[#3f4550]"
          data-testid="pulse-claim-notes"
        >
          {c.published ? (
            <div>
              <dt className="inline font-semibold">Published: </dt>
              <dd className="inline">{c.published}</dd>
            </div>
          ) : null}
          {c.measures ? (
            <div>
              <dt className="inline font-semibold">It measures: </dt>
              <dd className="inline">{c.measures}</dd>
            </div>
          ) : null}
          {c.method ? (
            <div>
              <dt className="inline font-semibold">How it was gathered: </dt>
              <dd className="inline">{c.method}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <p className="mt-3 text-[13px] text-[#3f4550]">
        Source:{" "}
        <a
          href={c.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="font-semibold underline underline-offset-2"
        >
          {c.source}
        </a>
        . Added by the person who created this Pulse, including the notes above;
        People&apos;s Pulse has not checked any of it.
      </p>
      <p className="mt-2 text-[13px] text-[#5c6370]">
        These are voluntary responses from whoever chose to answer. They
        can&apos;t confirm or disprove a representative survey — a difference
        may say more about who answered than about what people think.
      </p>
    </section>
  );
}

/** Cumulative votes over time, one line, with a hover/focus readout. */
function Timeline({ t }: { t: R["timeline"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = t.points;
  const W = 600;
  const H = 120;
  const max = Math.max(1, pts.at(-1)?.total ?? 1);
  const x = (i: number) => (pts.length <= 1 ? W : (i / (pts.length - 1)) * W);
  const y = (v: number) => H - 6 - (v / max) * (H - 16);
  const via = pts
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.referred).toFixed(1)}`,
    )
    .join("");
  const line = pts
    .map(
      (p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`,
    )
    .join("");
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(
      "en-CA",
      t.bucket === "hour"
        ? { weekday: "short", hour: "numeric" }
        : { month: "short", day: "numeric" },
    );
  const shown = hover ?? pts.length - 1;
  return (
    <section
      aria-labelledby="pulse-time"
      className="rounded-2xl border border-[#e7e3da] bg-white p-4"
      data-testid="pulse-timeline"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="pulse-time" className="text-[15px] font-semibold">
          Participation over time
        </h2>
        {pts[shown] ? (
          <p
            className="text-[13px] text-[#5c6370] tabular-nums"
            aria-live="polite"
          >
            {n(pts[shown]!.total)} by {fmt(pts[shown]!.t)}
          </p>
        ) : null}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 h-28 w-full touch-none"
        role="img"
        aria-label={`Cumulative votes: ${n(pts.at(-1)?.total ?? 0)} so far`}
        preserveAspectRatio="none"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.round(
            ((e.clientX - r.left) / r.width) * (pts.length - 1),
          );
          setHover(Math.max(0, Math.min(pts.length - 1, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        <line
          x1="0"
          x2={W}
          y1={H - 6}
          y2={H - 6}
          stroke="#e7e3da"
          strokeWidth="1"
        />
        <path
          d={`${line}L${W},${H - 6}L0,${H - 6}Z`}
          fill="#2a78d6"
          opacity="0.08"
        />
        <path
          d={via}
          fill="none"
          stroke="#14161a"
          strokeWidth="2"
          strokeDasharray="5 4"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          data-testid="pulse-timeline-referred"
        />
        <path
          d={line}
          fill="none"
          stroke="#2a78d6"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
        />
        {hover !== null && pts[hover] ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1="0"
            y2={H - 6}
            stroke="#14161a"
            strokeOpacity="0.25"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {pts[shown] ? (
        <p className="mt-2 flex flex-wrap gap-x-4 text-[12.5px] text-[#3f4550]">
          <span>
            <span className="font-semibold text-[#2a78d6]">━</span> everyone
          </span>
          <span>
            <span className="font-semibold">╍</span> through a shared link (
            {n(pts[shown]!.referred)})
          </span>
        </p>
      ) : null}
    </section>
  );
}

/** The same numbers as a table, for screen readers and anyone who prefers it. */
function Table({ results }: { results: R }) {
  const rows: { name: string; b: Breakdown }[] = [
    {
      name: "Everyone",
      b: {
        total: results.total,
        counted: results.total,
        shares: results.everyone,
      },
    },
    ...(results.circle ? [{ name: "Your circle", b: results.circle }] : []),
    ...results.provinces.map((p) => ({ name: p.name, b: p as Breakdown })),
    ...results.cities.map((c) => ({ name: c.name, b: c as Breakdown })),
  ];
  return (
    <details className="rounded-2xl border border-[#e7e3da] bg-white p-4">
      <summary className="cursor-pointer text-[14px] font-medium text-[#5c6370]">
        See results as a table
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-[13.5px] tabular-nums">
          <thead>
            <tr className="border-b border-[#e7e3da]">
              <th scope="col" className="py-2 pr-3">
                Group
              </th>
              <th scope="col" className="py-2 pr-3">
                Votes
              </th>
              {results.everyone.map((s) => (
                <th key={s.optionId} scope="col" className="py-2 pr-3">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b border-[#f0ede6]">
                <th scope="row" className="py-2 pr-3 font-medium">
                  {r.name}
                </th>
                <td className="py-2 pr-3">{r.b.total}</td>
                {results.everyone.map((s) => (
                  <td key={s.optionId} className="py-2 pr-3">
                    {r.b.shares
                      ? `${r.b.shares.find((x) => x.optionId === s.optionId)?.pct ?? 0}%`
                      : "hidden"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * **One results page, shaped by the Pulse's kind.** People's Pulse shows
 * everything V1 and V2 built; the Quick Ideas modes lead with their own view
 * and keep only the parts that make sense for them.
 */
export function Results({
  results,
  mine,
  pulse,
  circle,
  shareUrl,
  ai = false,
}: {
  results: R;
  mine: string | null;
  pulse: Pulse;
  /** This browser's own referral code, and the link that carries it. */
  circle: string;
  shareUrl: string;
  ai?: boolean;
}) {
  const kind = kindOf(pulse);
  const m = results.modes;
  const everyone = (
    <section
      aria-labelledby="pulse-everyone"
      className="rounded-2xl border border-[#e7e3da] bg-white p-4"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="pulse-everyone" className="text-[15px] font-semibold">
          {kind === "rank" ? "First choices" : "Everyone"}
        </h2>
        <p className="flex items-center gap-1.5 text-[13px] text-[#5c6370]">
          <span aria-hidden className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e5484d] opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#e5484d]" />
          </span>
          <span data-testid={kind === "rank" ? undefined : "pulse-total"}>
            {n(results.total)}
          </span>{" "}
          votes · live
        </p>
      </div>
      <div className="mt-4">
        <Bars shares={results.everyone} mine={mine} />
      </div>
    </section>
  );
  const card = (
    <ResultsCard
      pulseId={pulse.id}
      question={pulse.question}
      circle={circle}
      results={results}
      pulseUrl={shareUrl.split("?")[0] ?? shareUrl}
      kind={kind}
    />
  );
  const ask = (
    <AskCircle
      results={results}
      url={shareUrl}
      question={pulse.question}
      pulseId={pulse.id}
    />
  );
  const reasons = m.reasons ? (
    <ReasonsView reasons={m.reasons} pulse={pulse} ai={ai} />
  ) : null;

  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)] gap-4"
      data-testid="pulse-results"
      data-kind={kind}
    >
      {kind === "rank" && m.ranking ? (
        <>
          <RankingView ranking={m.ranking} />
          {card}
        </>
      ) : kind === "normal" && m.normal ? (
        <>
          <NormalView
            normal={m.normal}
            pulse={pulse}
            mine={mine}
            total={results.total}
          />
          {ask}
          {card}
        </>
      ) : kind === "decide" ? (
        <>
          {everyone}
          {reasons}
          {ask}
          {card}
          {results.total > 0 ? <Timeline t={results.timeline} /> : null}
        </>
      ) : (
        <>
          {m.verdict ? <VerdictBanner v={m.verdict} /> : null}
          {everyone}
          {reasons}
          {ask}
          {results.claim ? <Claim c={results.claim} /> : null}
          <PulseMap results={results} />
          <Compare results={results} />
          <Shifts results={results} />
          {results.total > 0 ? <Timeline t={results.timeline} /> : null}
          <Spread results={results} />
          {card}
          <Table results={results} />
        </>
      )}
    </div>
  );
}

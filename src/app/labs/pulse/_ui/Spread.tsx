"use client";

import type { Results as R } from "@/lib/pulse/results";
import { StackRow, n } from "./parts";

const NAME = (gen: number) =>
  gen === 0
    ? "Came straight to the Pulse"
    : gen === 1
      ? "One link away"
      : gen === 2
        ? "Two links away"
        : `${gen} links away`;

/**
 * Circles sized by how many people, left to right by how many shares it took
 * to reach them. Area, not radius, carries the count, so a bigger circle is
 * honestly more people. It is a picture of the shape of the spread; it names
 * nobody and says nothing about what anyone answered.
 */
function Ripple({
  gens,
  testId,
}: {
  gens: readonly { gen: number; votes: number }[];
  testId: string;
}) {
  const max = Math.max(1, ...gens.map((g) => g.votes));
  const R_MAX = 30;
  const step = 76;
  const width = Math.max(1, gens.length) * step;
  return (
    <svg
      viewBox={`0 0 ${width} 96`}
      className="mt-2 w-full max-w-[28rem]"
      role="img"
      data-testid={testId}
      aria-label={gens.map((g) => `${NAME(g.gen)}: ${g.votes}`).join(", ")}
    >
      {gens.map((g, i) => {
        const r = Math.max(4, Math.sqrt(g.votes / max) * R_MAX);
        const cx = i * step + step / 2;
        return (
          <g key={g.gen}>
            {i > 0 ? (
              <line
                x1={
                  cx -
                  step +
                  Math.max(4, Math.sqrt(gens[i - 1]!.votes / max) * R_MAX)
                }
                x2={cx - r}
                y1="38"
                y2="38"
                stroke="#bdb7aa"
                strokeWidth="2"
                strokeDasharray="3 3"
              />
            ) : null}
            <circle
              cx={cx}
              cy="38"
              r={r}
              fill="#14161a"
              fillOpacity={0.12 + 0.6 * (g.votes / max)}
              stroke="#14161a"
            />
            <text
              x={cx}
              y="43"
              textAnchor="middle"
              fontSize="13"
              fontWeight="700"
              fill="#14161a"
            >
              {g.votes}
            </text>
            <text
              x={cx}
              y="90"
              textAnchor="middle"
              fontSize="11"
              fill="#5c6370"
            >
              {g.gen === 0
                ? "direct"
                : `${g.gen} link${g.gen === 1 ? "" : "s"}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** How the Pulse spread, in counts only: no names, no contacts, no one's answer. */
export function Spread({ results }: { results: R }) {
  const { spread } = results.insights;
  if (results.total === 0) return null;
  const everyone = {
    total: results.total,
    counted: results.total,
    shares: results.everyone,
  };
  return (
    <section
      aria-labelledby="pulse-spread"
      className="rounded-2xl border border-[#e7e3da] bg-white p-4"
      data-testid="pulse-spread"
    >
      <h2 id="pulse-spread" className="text-[15px] font-semibold">
        How it spread
      </h2>
      <p
        className="mt-2 text-[14px] text-[#3f4550]"
        data-testid="pulse-spread-summary"
      >
        <strong>{n(spread.referred)}</strong> of {n(results.total)} came through
        a shared link
        {spread.generations.length > 1
          ? `, up to ${spread.generations.at(-1)!.gen} link${spread.generations.at(-1)!.gen === 1 ? "" : "s"} from where it started`
          : ""}
        {spread.provincesReached > 0
          ? `, across ${spread.provincesReached} province${spread.provincesReached === 1 ? "" : "s"} that can be named`
          : ""}
        .
      </p>
      <Ripple gens={spread.generations} testId="pulse-ripple" />

      {spread.mine && spread.mine.length > 0 ? (
        <div className="mt-3" data-testid="pulse-my-spread">
          <p className="text-[13px] font-semibold">Your link reached</p>
          <Ripple gens={spread.mine} testId="pulse-my-ripple" />
        </div>
      ) : null}

      <h3 className="mt-5 text-[14px] font-semibold">
        Do different networks think differently?
      </h3>
      {spread.networks.length === 0 ? (
        <p
          className="mt-1 text-[13.5px] text-[#3f4550]"
          data-testid="pulse-networks-empty"
        >
          A network shows once {results.minGroup} people have joined through the
          same start. Until then the shares are pooled.
        </p>
      ) : (
        <div className="mt-3 grid gap-4" data-testid="pulse-networks">
          <StackRow name="Everyone" b={everyone} testId="pulse-net-everyone" />
          {spread.networks.map((nw, i) =>
            nw.shares ? (
              <StackRow
                key={nw.label}
                name={nw.mine ? `${nw.label} (yours)` : nw.label}
                b={{ ...nw, shares: nw.shares }}
                testId={`pulse-net-${i + 1}`}
              />
            ) : null,
          )}
          {spread.pooled > 0 ? (
            <p className="text-[12.5px] text-[#5c6370]">
              {n(spread.pooled)} more arrived directly or through networks too
              small to show.
            </p>
          ) : null}
        </div>
      )}
      <p className="mt-3 text-[12.5px] text-[#5c6370]">
        Networks are people who joined through the same chain of shares. They
        are numbered by size, never named. Groups show from {results.minGroup}{" "}
        people. Networks differ partly because friends tend to think alike, so a
        difference isn&apos;t proof of anything else.
      </p>
    </section>
  );
}

"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { Pulse } from "@/lib/pulse/model";
import type {
  Distribution,
  Normal,
  Ranked,
  Ranking,
  Reasons,
  Verdict,
} from "@/lib/pulse/modes";
import { answerColor } from "./brand";
import { n } from "./parts";

const box = "rounded-2xl border border-[#e7e3da] bg-white p-4";

/** Settle This: who won, or plainly that nobody has yet. */
export function VerdictBanner({ v }: { v: Verdict }) {
  const [head, sub] =
    v.status === "early"
      ? [
          "Not settled yet",
          `${v.needed} more ${v.needed === 1 ? "vote" : "votes"} before anyone can call it.`,
        ]
      : v.status === "tie"
        ? [
            "Dead even",
            `${v.labels.join(" and ")} are tied. Send it to one more person.`,
          ]
        : v.status === "close"
          ? [
              `Too close to call`,
              `${v.winner} leads with ${v.pct}%, only ${v.margin} points ahead.`,
            ]
          : [
              `${v.winner} wins`,
              `${v.pct}% picked it — ${v.margin} points clear.`,
            ];
  return (
    <section
      className="rounded-2xl bg-[#14161a] p-5 text-white"
      data-testid="pulse-verdict"
      data-status={v.status}
    >
      <p className="text-[12px] font-bold tracking-[0.16em] text-white/60 uppercase">
        The verdict, so far
      </p>
      <p className="font-heading mt-1 text-[30px] leading-tight font-bold">
        {head}
      </p>
      <p className="mt-1 text-[15px] text-white/80">{sub}</p>
    </section>
  );
}

/** Should I Do It?: the reasons, what keeps coming up, and your circle's advice. */
export function ReasonsView({
  reasons,
  pulse,
  ai,
}: {
  reasons: Reasons;
  pulse: Pulse;
  ai: boolean;
}) {
  const [summary, setSummary] = useState<{
    lines: { answer: string; summary: string }[];
    basedOn: number;
  } | null>(null);
  const [aiNote, setAiNote] = useState("");
  const [busy, setBusy] = useState(false);
  const written = reasons.groups?.reduce((a, g) => a + g.written, 0) ?? 0;

  async function summarise() {
    setBusy(true);
    setAiNote("");
    const res = await fetch(`/api/pulse/${pulse.id}/summary`, {
      method: "POST",
    }).catch(() => null);
    if (res?.ok) setSummary(await res.json());
    else
      setAiNote(
        res?.status === 429
          ? "Too many summaries just now — try later."
          : "No summary yet: it needs at least five reasons.",
      );
    setBusy(false);
  }

  return (
    <section
      aria-labelledby="pulse-reasons"
      className={box}
      data-testid="pulse-reasons"
    >
      <h2 id="pulse-reasons" className="text-[15px] font-semibold">
        Why people said what they said
      </h2>
      {!reasons.groups ? (
        <p
          className="mt-2 text-[14px] text-[#3f4550]"
          data-testid="pulse-reasons-hidden"
        >
          Reasons appear once {5 - (reasons.total % 5)} more{" "}
          {5 - (reasons.total % 5) === 1 ? "person answers" : "people answer"},
          so no one&apos;s can be matched to them.
        </p>
      ) : written === 0 ? (
        <p className="mt-2 text-[14px] text-[#3f4550]">
          No one has written a reason yet.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-[#5c6370]">
            {written} written reason{written === 1 ? "" : "s"} from the first{" "}
            {reasons.counted} answers. Newer ones appear in fives.
          </p>
          <div className="mt-4 grid gap-5">
            {reasons.groups.map((g, i) =>
              g.written === 0 ? null : (
                <div
                  key={g.optionId}
                  data-testid={`pulse-reasons-${g.optionId}`}
                >
                  <p className="flex items-center gap-2 text-[15px] font-semibold">
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: answerColor(i) }}
                    />
                    {g.label}
                    <span className="font-normal text-[#5c6370]">
                      · {g.written}
                    </span>
                  </p>
                  {g.words.length ? (
                    <p
                      className="mt-1.5 flex flex-wrap gap-1.5"
                      aria-label="Words that come up most"
                    >
                      {g.words.map((w) => (
                        <span
                          key={w.word}
                          className="rounded-full bg-[#f3f1ec] px-2.5 py-1 text-[13px] text-[#3f4550]"
                          data-testid="pulse-common-word"
                        >
                          {w.word}{" "}
                          <span className="text-[#8a909a]">×{w.n}</span>
                        </span>
                      ))}
                    </p>
                  ) : null}
                  <ul className="mt-2 grid gap-1.5">
                    {g.quotes.slice(0, 6).map((q, j) => (
                      <li
                        key={j}
                        className="border-l-[3px] pl-3 text-[15px] leading-snug text-[#14161a]"
                        style={{ borderColor: answerColor(i) }}
                      >
                        “{q}”
                      </li>
                    ))}
                  </ul>
                  {g.quotes.length > 6 ? (
                    <details className="mt-1.5 text-[14px]">
                      <summary className="cursor-pointer text-[#2a78d6]">
                        {g.quotes.length - 6} more
                      </summary>
                      <ul className="mt-1.5 grid gap-1.5">
                        {g.quotes.slice(6).map((q, j) => (
                          <li
                            key={j}
                            className="border-l-[3px] border-[#e7e3da] pl-3"
                          >
                            “{q}”
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
              ),
            )}
          </div>
          <p className="mt-3 text-[12.5px] text-[#5c6370]">
            Chips count how many reasons used each word — a plain count, not
            advice.
          </p>
          {ai ? (
            <div className="mt-3">
              {summary ? (
                <div
                  className="rounded-xl bg-[#f3f1ec] p-3"
                  data-testid="pulse-ai-summary"
                >
                  <p className="text-[12px] font-bold tracking-[0.12em] text-[#5c6370] uppercase">
                    AI summary of {summary.basedOn} reasons · may be wrong
                  </p>
                  <ul className="mt-1.5 grid gap-1 text-[14px]">
                    {summary.lines.map((l) => (
                      <li key={l.answer}>
                        <strong>{l.answer}:</strong> {l.summary}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={summarise}
                  disabled={busy}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d9d4c8] px-4 text-[14px] font-semibold"
                >
                  <Sparkles className="h-4 w-4" aria-hidden />
                  {busy ? "Summarising…" : "Summarise the reasons (AI)"}
                </button>
              )}
              {aiNote ? (
                <p className="mt-1.5 text-[13px] text-[#5c6370]">{aiNote}</p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
      {reasons.circle && reasons.circle.length > 0 ? (
        <div
          className="mt-5 border-t border-[#efece5] pt-4"
          data-testid="pulse-circle-advice"
        >
          <h3 className="text-[14px] font-semibold">From your circle</h3>
          <p className="text-[12.5px] text-[#5c6370]">
            People your link reached, without their answers, in no particular
            order.
          </p>
          <ul className="mt-2 grid gap-1.5">
            {reasons.circle.map((q, j) => (
              <li
                key={j}
                className="border-l-[3px] border-[#14161a] pl-3 text-[15px]"
              >
                “{q}”
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function DistBars({
  d,
  mine,
  pulse,
}: {
  d: Distribution;
  mine: string | null;
  pulse: Pulse;
}) {
  if (!d.shares) return null;
  const max = Math.max(1, ...d.shares.map((s) => s.pct));
  return (
    <ul className="grid gap-2" data-testid="pulse-distribution">
      {d.shares.map((s, i) => (
        <li
          key={s.optionId}
          className="grid grid-cols-[minmax(6.5rem,38%)_1fr_2.75rem] items-center gap-2 text-[14px]"
        >
          <span
            className={`truncate ${s.optionId === mine ? "font-bold" : ""}`}
          >
            {pulse.options[i]?.label}
            {s.optionId === mine ? " · you" : ""}
          </span>
          <span className="h-6 overflow-hidden rounded-md bg-[#f3f1ec]">
            <span
              className="block h-full rounded-md"
              style={{
                width: `${(s.pct / max) * 100}%`,
                background: s.optionId === mine ? "#14161a" : "#2a78d6",
              }}
            />
          </span>
          <span className="text-right font-semibold tabular-nums">
            {s.pct}%
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Is This Normal?: the spread of ranges, where you sit, and groups that have 5. */
export function NormalView({
  normal,
  pulse,
  mine,
  total,
}: {
  normal: Normal;
  pulse: Pulse;
  mine: string | null;
  total: number;
}) {
  const e = normal.everyone;
  return (
    <section
      aria-labelledby="pulse-normal"
      className={box}
      data-testid="pulse-normal"
    >
      <h2 id="pulse-normal" className="text-[15px] font-semibold">
        What people said{pulse.unit ? ` (${pulse.unit})` : ""}
      </h2>
      {!e.shares ? (
        <p
          className="mt-2 text-[14px] text-[#3f4550]"
          data-testid="pulse-normal-hidden"
        >
          {total} answer{total === 1 ? "" : "s"} so far. Results appear at 5 and
          then move in steps of 5, so nobody&apos;s answer can be picked out.
        </p>
      ) : (
        <>
          <p className="mt-1 text-[13px] text-[#5c6370]">
            {e.counted === total
              ? `${n(total)} answers`
              : `First ${n(e.counted)} of ${n(total)} answers`}
            {e.median ? (
              <>
                {" "}
                · the middle answer is{" "}
                <strong className="text-[#14161a]">{e.median}</strong>
              </>
            ) : null}
          </p>
          {normal.you ? (
            <p
              className="mt-3 rounded-xl bg-[#14161a] p-3 text-[15px] text-white"
              data-testid="pulse-normal-you"
            >
              {normal.you.below}% picked a lower range, {normal.you.same}% the
              same as you, {normal.you.above}% higher.
            </p>
          ) : null}
          <div className="mt-4">
            <DistBars d={e} mine={mine} pulse={pulse} />
          </div>
          {normal.groupLabel ? (
            <div className="mt-5 border-t border-[#efece5] pt-4">
              <h3 className="text-[14px] font-semibold">
                By {normal.groupLabel.toLowerCase()}
              </h3>
              {normal.groups.length === 0 ? (
                <p className="mt-1 text-[13.5px] text-[#5c6370]">
                  No group has 5 answers yet.
                </p>
              ) : (
                <ul
                  className="mt-2 grid gap-2"
                  data-testid="pulse-normal-groups"
                >
                  {normal.groups.map((g) => (
                    <li
                      key={g.key}
                      className="flex items-baseline justify-between gap-3 text-[14px]"
                    >
                      <span className="font-medium">{g.name}</span>
                      <span className="text-[#3f4550]">
                        middle: <strong>{g.median}</strong>{" "}
                        <span className="text-[#8a909a]">({g.counted})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {normal.hiddenGroups > 0 ? (
                <p className="mt-1.5 text-[12.5px] text-[#5c6370]">
                  {normal.hiddenGroups} answer
                  {normal.hiddenGroups === 1 ? "" : "s"} in groups too small to
                  show.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
      <p
        className="mt-4 text-[12.5px] leading-relaxed text-[#5c6370]"
        data-testid="pulse-normal-note"
      >
        These are the people who chose to answer this link — not a
        representative sample of Canadians, and not population statistics. Only
        ranges are stored.
      </p>
    </section>
  );
}

function RankList({
  items,
  testId,
}: {
  items: readonly Ranked[];
  testId: string;
}) {
  return (
    <ol className="grid gap-2" data-testid={testId}>
      {items.map((r, i) => (
        <li
          key={r.optionId}
          className="flex min-h-12 items-center gap-3 rounded-xl border border-[#e7e3da] px-3"
          data-testid="pulse-ranking-item"
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold ${
              i === 0
                ? "bg-[#e5484d] text-white"
                : "bg-[#f3f1ec] text-[#14161a]"
            }`}
          >
            {i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">
            {r.label}
          </span>
          <span className="text-right text-[12.5px] leading-tight text-[#5c6370]">
            avg #{r.average}
            <br />
            {r.firstPct}% put it first
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Rank These: the group's order by points, and your circle's once it has 5. */
export function RankingView({ ranking }: { ranking: Ranking }) {
  return (
    <section
      aria-labelledby="pulse-ranking"
      className={box}
      data-testid="pulse-ranking"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="pulse-ranking" className="text-[15px] font-semibold">
          The group&apos;s ranking
        </h2>
        <p className="text-[13px] text-[#5c6370]">
          <span data-testid="pulse-total">{n(ranking.total)}</span> rankings ·
          live
        </p>
      </div>
      <div className="mt-3">
        <RankList items={ranking.items} testId="pulse-ranking-everyone" />
      </div>
      {ranking.circle ? (
        <div className="mt-5 border-t border-[#efece5] pt-4">
          <h3 className="text-[14px] font-semibold">
            Your circle&apos;s ranking
          </h3>
          <div className="mt-2">
            <RankList items={ranking.circle} testId="pulse-ranking-circle" />
          </div>
        </div>
      ) : null}
      <p className="mt-3 text-[12.5px] text-[#5c6370]">
        Ordered by points: first place scores the most, last scores none. Your
        circle&apos;s order shows once 5 people in it have ranked.
      </p>
    </section>
  );
}

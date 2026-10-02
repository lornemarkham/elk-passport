"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Heart, Loader2, RotateCcw } from "lucide-react";
import type { Possibility } from "@/lib/labs/october/possibility";
import { fitFor, type Context } from "@/lib/labs/october/fit";
import { stableJitter } from "@/lib/labs/october/intents";
import { useKeeping } from "@/components/october/save/keeping";
import { addToTray } from "./tray";
import { CardWhen, Shot } from "./atoms";

const HERE = "/labs/october/discovery/c";

/**
 * **Experiment C — October deals, you react, it adjusts.**
 *
 * The discovery model is *conversational*. A and B both put a page in front of
 * somebody and ask them to scan it. This one refuses to: it shows exactly one
 * thing at a time, full width, and the only way forward is to have an opinion
 * about it. That is a real trade — it is slower per possibility than a feed,
 * and it is the only one of the three where a person cannot accidentally skim
 * past the thing they would have loved.
 *
 * ## Two questions, then it stops asking
 *
 * The forks exist because the first deal is otherwise a coin toss, and a bad
 * first card is where somebody decides a prototype is not for them. Two
 * questions is the most it is allowed: beyond that it stops being *trust me*
 * and becomes a form.
 *
 * ## It learns in the open
 *
 * Every reaction moves weights on **facets** the possibility actually has —
 * its source, its setting, how frightening it is, its tags. Nothing is stored,
 * nothing follows anybody between sessions, and the panel at the bottom shows
 * the current reading in plain words, because a recommender a person cannot
 * inspect is one they have to take on faith twice.
 */

type Stage = "trust" | "fork" | "deal" | "done";
type Verdict = "yes" | "maybe" | "no" | "more";

interface Fork {
  readonly id: string;
  readonly question: string;
  readonly options: readonly {
    readonly label: string;
    readonly under: string;
    /** Facet weights applied when chosen. */
    readonly weights: Readonly<Record<string, number>>;
  }[];
}

const FORKS: readonly Fork[] = [
  {
    id: "where",
    question: "Inside, or outside?",
    options: [
      {
        label: "Inside",
        under: "A roof, a sofa, a kitchen table.",
        weights: {
          "set:indoor": 7,
          "set:outdoor-night": -7,
          "set:outdoor-day": -7,
          // Atlas has classified a minority of this corpus, and an
          // unclassified subject cannot answer the question just asked. It
          // waits behind the ones that can rather than winning by default,
          // which is what it did the first time this was walked through.
          "set:unknown": -3,
        },
      },
      {
        label: "Outside",
        under: "Coat on. Whatever the sky is doing.",
        // Deliberately heavier than anything the weather applies. A person who
        // has just answered "outside" has overruled the forecast, and a
        // dealer that keeps offering films after that is not listening.
        weights: {
          "set:outdoor-night": 9,
          "set:outdoor-day": 8,
          "set:astronomy": 8,
          "set:indoor": -8,
          "set:unknown": -3,
        },
      },
    ],
  },
  {
    id: "long",
    question: "An hour, or the whole evening?",
    options: [
      {
        label: "An hour",
        under: "Something that starts and finishes.",
        weights: { "len:short": 6, "len:long": -5 },
      },
      {
        label: "The whole evening",
        under: "Make a thing of it.",
        weights: { "len:long": 6, "len:short": -3 },
      },
    ],
  },
];

/** The handles a reaction can pull. Every one is a field, never a guess. */
function facetsOf(p: Possibility): readonly string[] {
  const minutes = p.minutes ?? 0;
  // **Going out is an evening even when nobody published a duration.** Only
  // films and one shelf of Doings carry minutes, so keying "the whole
  // evening" on `minutes` alone meant that answer reliably produced films —
  // the exact opposite of what somebody choosing it wants. A thing with a
  // start time that you travel to is a night out, and says so here.
  const anEvening = minutes >= 100 || p.availability.shape === "fixed";
  return [
    `src:${p.source}`,
    `set:${p.setting}`,
    ...(p.scare !== undefined ? [`scare:${p.scare}`] : []),
    ...(minutes > 0 && minutes <= 75 ? ["len:short"] : []),
    ...(anEvening ? ["len:long"] : []),
    // **When it is on is not a taste.** These were learnable facets, and
    // saying "not tonight" to four things taught the dealer to avoid things
    // that are on tonight — which it then announced, to a person who had just
    // asked what to do tonight. Availability belongs to `fitFor`, which reads
    // it from evidence, and not to the part that learns what somebody likes.
    ...p.tags.map((t) => `tag:${t}`),
  ];
}

export function Dealer({
  possibilities,
  ctx,
  signedIn,
  kept,
}: {
  readonly possibilities: readonly Possibility[];
  readonly ctx: Context;
  readonly signedIn: boolean;
  readonly kept: readonly string[];
}) {
  const [stage, setStage] = useState<Stage>("trust");
  const [fork, setFork] = useState(0);
  const [weights, setWeights] = useState<Readonly<Record<string, number>>>({});
  const [seen, setSeen] = useState<readonly string[]>([]);
  const [yes, setYes] = useState<readonly Possibility[]>([]);
  const [maybe, setMaybe] = useState<readonly Possibility[]>([]);
  const keptSet = useMemo(() => new Set(kept), [kept]);

  const nudge = useCallback((deltas: Readonly<Record<string, number>>) => {
    setWeights((w) => {
      const next = { ...w };
      for (const [k, d] of Object.entries(deltas)) next[k] = (next[k] ?? 0) + d;
      return next;
    });
  }, []);

  const score = useCallback(
    (p: Possibility) =>
      fitFor(p, ctx).score +
      facetsOf(p).reduce((sum, f) => sum + (weights[f] ?? 0), 0) +
      // A little wobble so two evenings with the same answers are not the
      // same deck. Stable per id, so a re-render never swaps the card out
      // from under a click.
      stableJitter(p.id, 3),
    [ctx, weights],
  );

  const deck = useMemo(() => {
    const gone = new Set(seen);
    return [...possibilities]
      .filter((p) => !gone.has(p.id))
      .sort(
        (a, b) =>
          score(b) - score(a) ||
          stableJitter(a.id, 997) - stableJitter(b.id, 997),
      );
  }, [possibilities, seen, score]);

  /**
   * **The run cap has to be applied to what was dealt, not to the deck.**
   *
   * A list surface can compose its whole page at once; this one only ever
   * shows `deck[0]`, so the ordinary mixing rule — which rearranges positions
   * three and beyond — never touched the only position that exists. Measured:
   * one "More like this" on a film produced six films in a row, each of them
   * correctly ranked and the sequence useless.
   *
   * So the last two cards actually shown decide the next one. Two in a row
   * from one catalogue is a theme; three is a rut.
   */
  const card = useMemo(() => {
    if (deck.length === 0) return undefined;
    const bySource = new Map(possibilities.map((p) => [p.id, p.source]));
    const last = seen.slice(-2).map((id) => bySource.get(id));
    if (last.length === 2 && last[0] === last[1]) {
      const other = deck.find((p) => p.source !== last[0]);
      if (other) return other;
    }
    return deck[0];
  }, [deck, seen, possibilities]);

  const react = useCallback(
    (verdict: Verdict) => {
      if (!card) return;
      const facets = facetsOf(card);
      const weigh = (d: number) =>
        Object.fromEntries(facets.map((f) => [f, d]));

      if (verdict === "yes") {
        setYes((y) => [...y, card]);
        nudge(weigh(2));
      }
      if (verdict === "maybe") setMaybe((m) => [...m, card]);
      if (verdict === "no") nudge(weigh(-4));
      if (verdict === "more") nudge(weigh(5));

      setSeen((s) => [...s, card.id]);
    },
    [card, nudge],
  );

  // ------------------------------------------------------------ the stages

  if (stage === "trust") {
    return (
      <Centre>
        <p className="text-[11px] tracking-[0.22em] text-[#d09a4e] uppercase">
          October
        </p>
        <h1 className="font-heading mt-3 text-5xl leading-none text-[#f3efe4] sm:text-7xl">
          Trust me.
        </h1>
        <p className="mt-4 max-w-sm leading-relaxed text-[#e9e6da]/50">
          Two questions, then I start showing you things. Say yes to what you
          like and I will keep going in that direction.
        </p>
        <button
          type="button"
          onClick={() => setStage("fork")}
          className="font-heading mt-8 inline-flex min-h-12 items-center rounded-full bg-[#d09a4e] px-7 text-lg text-[#15100a] transition-colors hover:bg-[#e0ad63]"
        >
          Go on then
        </button>
      </Centre>
    );
  }

  if (stage === "fork") {
    const f = FORKS[fork];
    return (
      <Centre>
        <p className="text-[11px] tracking-[0.22em] text-[#d09a4e] uppercase">
          {fork + 1} of {FORKS.length}
        </p>
        <h1 className="font-heading mt-3 text-4xl leading-tight text-[#f3efe4] sm:text-6xl">
          {f.question}
        </h1>
        <div className="mt-9 grid w-full max-w-xl gap-3 sm:grid-cols-2">
          {f.options.map((o) => (
            <button
              key={o.label}
              type="button"
              data-testid="fork-option"
              onClick={() => {
                nudge(o.weights);
                if (fork + 1 < FORKS.length) setFork(fork + 1);
                else setStage("deal");
              }}
              className="group rounded-xl border border-[#e9e6da]/15 p-6 text-left transition-colors hover:border-[#d09a4e] hover:bg-[#d09a4e]/[0.06]"
            >
              <p className="font-heading text-2xl text-[#f3efe4]">{o.label}</p>
              <p className="mt-1 text-sm text-[#e9e6da]/50">{o.under}</p>
            </button>
          ))}
        </div>
      </Centre>
    );
  }

  if (stage === "done" || !card) {
    return <Night yes={yes} maybe={maybe} onAgain={() => reset()} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <DealCard
        key={card.id}
        p={card}
        because={fitFor(card, ctx).because}
        saved={keptSet.has(card.id)}
        signedIn={signedIn}
        onVerdict={react}
        dealt={seen.length}
      />

      <Reading weights={weights} yes={yes.length} maybe={maybe.length} />

      <button
        type="button"
        onClick={() => setStage("done")}
        className="self-start text-sm text-[#e9e6da]/40 underline-offset-4 hover:text-[#e9e6da] hover:underline"
      >
        That is enough — show me my night
      </button>
    </div>
  );

  function reset() {
    setStage("trust");
    setFork(0);
    setWeights({});
    setSeen([]);
    setYes([]);
    setMaybe([]);
  }
}

/**
 * One possibility, big, with four ways to answer it.
 *
 * `yes` is not a UI state — it writes the row. The button waits for the server
 * before moving on, which is why it can say *In My October* without lying, and
 * why a failed save stops the deal rather than quietly losing the thing the
 * person just chose.
 */
function DealCard({
  p,
  because,
  saved,
  signedIn,
  onVerdict,
  dealt,
}: {
  readonly p: Possibility;
  readonly because?: string;
  readonly saved: boolean;
  readonly signedIn: boolean;
  readonly onVerdict: (v: Verdict) => void;
  readonly dealt: number;
}) {
  const keepable = p.keepAs
    ? {
        entityId: p.id,
        entityKind: p.keepAs,
        name: p.title,
        startsAt: p.startsAt ?? null,
      }
    : undefined;
  // Hooks cannot be conditional, so an unkeepable possibility still builds a
  // thing — and `yes` below never calls `toggle` for one, so that placeholder
  // is never sent anywhere. Every possibility in the current pool is keepable;
  // this is the guard for the day one is not.
  const {
    saved: isSaved,
    state,
    toggle,
  } = useKeeping(
    keepable ?? { entityId: p.id, entityKind: "Event", name: p.title },
    saved,
  );

  const yes = async () => {
    if (keepable && signedIn && !isSaved) {
      await toggle();
      addToTray({ id: p.id, name: p.title, when: p.availability.label });
    }
    onVerdict("yes");
  };

  return (
    <article
      data-testid="deal-card"
      data-source={p.source}
      className="overflow-hidden rounded-2xl border border-[#e9e6da]/12"
    >
      <Link href={p.href} className="block">
        <Shot p={p} className="aspect-[16/10] w-full sm:aspect-[21/9]" />
      </Link>
      <div className="p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <CardWhen p={p} />
          <span className="text-[10px] tracking-[0.18em] text-[#e9e6da]/20 uppercase">
            card {dealt + 1}
          </span>
        </div>
        <h2 className="font-heading mt-2 text-3xl leading-tight text-balance text-[#f3efe4] sm:text-5xl">
          {p.title}
        </h2>
        {p.line ? (
          <p className="mt-3 max-w-xl leading-relaxed text-[#e9e6da]/60">
            {clip(p.line, 200)}
          </p>
        ) : null}
        {because ? (
          <p className="mt-3 text-sm text-[#d09a4e]/85">{because}</p>
        ) : null}

        <div className="mt-7 flex flex-wrap gap-2">
          <Act onClick={yes} tone="yes" busy={state === "saving"}>
            {state === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : signedIn ? (
              <Heart className="h-4 w-4" aria-hidden />
            ) : (
              <Check className="h-4 w-4" aria-hidden />
            )}
            Yes
          </Act>
          <Act onClick={() => onVerdict("more")} tone="more">
            More like this
          </Act>
          <Act onClick={() => onVerdict("maybe")} tone="plain">
            Maybe
          </Act>
          <Act onClick={() => onVerdict("no")} tone="plain">
            Not tonight
          </Act>
        </div>

        {state === "failed" ? (
          <p className="mt-3 text-sm text-[#e98f6a]">
            That did not save. It is still here — try Yes again.
          </p>
        ) : null}
        {!signedIn ? (
          <p className="mt-3 text-xs text-[#e9e6da]/30">
            Yes keeps it for this session.{" "}
            <Link
              href={`/signin?returnTo=${encodeURIComponent(HERE)}`}
              className="underline underline-offset-2 hover:text-[#e9e6da]"
            >
              Sign in
            </Link>{" "}
            and it goes into My October properly.
          </p>
        ) : null}
      </div>
    </article>
  );
}

function Act({
  children,
  onClick,
  tone,
  busy,
}: {
  readonly children: React.ReactNode;
  readonly onClick: () => void;
  readonly tone: "yes" | "more" | "plain";
  readonly busy?: boolean;
}) {
  const skin =
    tone === "yes"
      ? "bg-[#d09a4e] text-[#15100a] hover:bg-[#e0ad63]"
      : tone === "more"
        ? "border border-[#d09a4e]/50 text-[#f0c88a] hover:bg-[#d09a4e]/10"
        : "border border-[#e9e6da]/18 text-[#e9e6da]/60 hover:border-[#e9e6da]/40 hover:text-[#e9e6da]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm transition-colors disabled:opacity-60 ${skin}`}
    >
      {children}
    </button>
  );
}

/** What it currently thinks you want, in words rather than numbers. */
function Reading({
  weights,
  yes,
  maybe,
}: {
  readonly weights: Readonly<Record<string, number>>;
  readonly yes: number;
  readonly maybe: number;
}) {
  const top = Object.entries(weights)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 3);
  if (top.length === 0 && yes === 0) return null;
  return (
    <p
      data-testid="reading"
      className="text-xs leading-relaxed text-[#e9e6da]/30"
    >
      {yes > 0 ? `${yes} yes${maybe > 0 ? `, ${maybe} maybe` : ""}. ` : ""}
      {top.length > 0 ? (
        <>
          Currently leaning:{" "}
          {top
            .map(([k, v]) => `${v > 0 ? "" : "away from "}${plain(k)}`)
            .join(", ")}
          .
        </>
      ) : null}
    </p>
  );
}

const plain = (facet: string) =>
  facet
    .replace("src:atlas", "what is on")
    .replace("src:movie", "films")
    .replace("src:doing", "making things")
    .replace("set:", "")
    .replace("len:short", "short ones")
    .replace("len:long", "long ones")
    .replace("when:", "")
    .replace("tag:", "")
    .replace(/-/g, " ");

/** The end state: the night somebody actually built. */
function Night({
  yes,
  maybe,
  onAgain,
}: {
  readonly yes: readonly Possibility[];
  readonly maybe: readonly Possibility[];
  readonly onAgain: () => void;
}) {
  return (
    <div data-testid="night">
      <h1 className="font-heading text-4xl leading-tight text-[#f3efe4] sm:text-5xl">
        {yes.length === 0 ? "Nothing yet." : "Here is your night."}
      </h1>
      {yes.length === 0 ? (
        <p className="mt-3 max-w-md leading-relaxed text-[#e9e6da]/50">
          You said no to everything, which is a result too. Start again and
          answer the two questions differently.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {yes.map((p) => (
            <li
              key={p.id}
              data-testid="night-item"
              className="flex items-center gap-4 rounded-xl border border-[#d09a4e]/25 p-3"
            >
              <Link href={p.href} className="shrink-0">
                <Shot p={p} className="h-16 w-24 rounded-lg" />
              </Link>
              <div className="min-w-0">
                <CardWhen p={p} />
                <p className="font-heading truncate text-lg text-[#f3efe4]">
                  <Link href={p.href}>{p.title}</Link>
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {maybe.length > 0 ? (
        <>
          <h2 className="font-heading mt-10 text-xl text-[#e9e6da]/70">
            You said maybe
          </h2>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-[#e9e6da]/45">
            {maybe.map((p) => (
              <li key={p.id}>
                <Link href={p.href} className="hover:text-[#e9e6da]">
                  {p.title}
                </Link>{" "}
                <span className="text-[#e9e6da]/25">
                  · {p.availability.label}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="mt-10 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={onAgain}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#e9e6da]/20 px-5 text-sm text-[#e9e6da]/70 hover:border-[#d09a4e]/50 hover:text-[#e9e6da]"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Deal again
        </button>
        <Link
          href="/october/mine"
          className="inline-flex min-h-11 items-center text-sm text-[#e9e6da]/45 underline-offset-4 hover:underline"
        >
          Open My October →
        </Link>
      </div>
    </div>
  );
}

function Centre({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      {children}
    </div>
  );
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "));
  return `${cut.slice(0, stop > max * 0.5 ? stop : max).trim()}…`;
}

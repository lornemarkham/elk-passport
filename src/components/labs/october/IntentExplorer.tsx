"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import type { Possibility } from "@/lib/labs/october/possibility";
import { byIntent, INTENTS, type Intent } from "@/lib/labs/october/intents";
import {
  fitFor,
  mixSources,
  sayOnce,
  type Context,
} from "@/lib/labs/october/fit";
import { search } from "@/lib/labs/october/search";
import { CardWhen, Shot } from "./atoms";
import { LabKeep } from "./LabKeep";

const HERE = "/labs/october/discovery/b";

/**
 * **Experiment B — you finish the sentence, and the page becomes the answer.**
 *
 * The discovery model is *declarative*. A filter bar asks which table you
 * want; this asks what you feel like, which is a different question with a
 * different shape. It is one sentence with a missing ending, and the endings
 * are set at the size of a headline rather than shrunk into chips — because
 * the choice **is** the page at that moment, and making it small would make it
 * feel like a setting rather than a decision.
 *
 * ## An intention reorders, it never filters
 *
 * `Intent.weigh` returns a number that is added to the evening's fit. Choosing
 * "be frightened" lifts the haunt and the two nightmare films to the top; it
 * does not delete the pumpkin patch, which is still down the page where
 * somebody can change their mind about what they wanted. Nothing is ever
 * hidden because of a mood, and the count at the bottom says so out loud.
 *
 * ## The search box is the same question, typed
 *
 * It sits in the same place and produces the same panels. `search` reads the
 * whole of what is written about a possibility, plus a small authored table
 * of what a few words mean in this corpus, so `scary` finds a haunted house
 * that never uses the word and `pumpkin` finds a farm whose name does not say
 * it.
 */
export function IntentExplorer({
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
  const [intent, setIntent] = useState<Intent | null>(null);
  const [query, setQuery] = useState("");
  const keptSet = useMemo(() => new Set(kept), [kept]);
  const typed = query.trim().length > 1;

  const hits = useMemo(
    () => (typed ? search(possibilities, query) : []),
    [typed, query, possibilities],
  );

  const ranked = useMemo(() => {
    if (!intent) return [];
    // Ranked, then composed: the sort decides what is good, `mixSources`
    // decides that you do not get the same catalogue four times running.
    return mixSources([...possibilities].sort(byIntent(intent, ctx)));
  }, [intent, possibilities, ctx]);

  const shown = typed
    ? mixSources(hits.map((h) => h.possibility))
    : ranked.slice(0, 12);
  // Rebuilt on every render, which is what makes it stable: the same list
  // always suppresses the same repeats.
  const once = sayOnce();
  const termsFor = (id: string) =>
    hits.find((h) => h.possibility.id === id)?.on;

  return (
    <>
      {/* ------------------------------------------------ the sentence */}
      <section data-testid="sentence">
        {intent === null && !typed ? (
          <>
            <p className="font-heading text-3xl leading-tight text-[#e9e6da]/45 sm:text-4xl">
              Tonight I want to —
            </p>
            <ul className="mt-5 flex flex-col items-start gap-1">
              {INTENTS.map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    data-testid="intent"
                    onClick={() => setIntent(i)}
                    className="font-heading cursor-pointer py-1 text-left text-3xl leading-[1.12] text-[#f3efe4]/75 transition-colors hover:text-[#d09a4e] sm:text-5xl"
                  >
                    {i.phrase}
                    <span className="text-[#e9e6da]/20">.</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
            <p className="font-heading text-3xl leading-tight text-[#f3efe4] sm:text-5xl">
              {typed ? (
                <>
                  <span className="text-[#e9e6da]/40">Tonight I want —</span>{" "}
                  {query.trim()}
                </>
              ) : (
                <>
                  <span className="text-[#e9e6da]/40">Tonight I want to</span>{" "}
                  {intent!.phrase}
                  <span className="text-[#e9e6da]/25">.</span>
                </>
              )}
            </p>
            <button
              type="button"
              onClick={() => {
                setIntent(null);
                setQuery("");
              }}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm text-[#e9e6da]/40 underline-offset-4 hover:text-[#e9e6da] hover:underline"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              start again
            </button>
          </div>
        )}

        {intent && !typed ? (
          <p className="mt-3 text-lg text-[#d09a4e]/90">{intent.answer}</p>
        ) : null}
      </section>

      {/* --------------------------------------------------- the search */}
      <section className="mt-8">
        <label className="flex items-center gap-3 rounded-full border border-[#e9e6da]/15 px-4 py-3 transition-colors focus-within:border-[#d09a4e]/60">
          <Search className="h-4 w-4 shrink-0 text-[#e9e6da]/35" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="or just say it — pumpkin, scary, something with the kids"
            className="min-w-0 flex-1 bg-transparent text-[#e9e6da] placeholder:text-[#e9e6da]/30 focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear"
              className="shrink-0 text-[#e9e6da]/35 hover:text-[#e9e6da]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </label>

        {typed ? (
          <p className="mt-2 px-1 text-xs text-[#e9e6da]/35" data-testid="hits">
            {hits.length === 0
              ? "Nothing in October matches that."
              : `${hits.length} across films, things to make and what is on.`}
          </p>
        ) : null}
      </section>

      {/* -------------------------------------------------- the answers */}
      {shown.length > 0 ? (
        <section className="mt-10 flex flex-col gap-4" data-testid="answers">
          {shown.map((p, index) => (
            <Panel
              key={p.id}
              p={p}
              flip={index % 2 === 1}
              saved={keptSet.has(p.id)}
              signedIn={signedIn}
              terms={termsFor(p.id)}
              note={
                typed
                  ? undefined
                  : intent?.id === "surprise"
                    ? undefined
                    : once(fitFor(p, ctx).because)
              }
            />
          ))}
        </section>
      ) : null}

      {intent && !typed ? (
        <p
          className="mt-8 text-sm text-[#e9e6da]/30"
          data-testid="nothing-hidden"
        >
          Nothing was removed. The other {possibilities.length - shown.length}{" "}
          possibilities are still in there — they just are not what you asked
          for.
        </p>
      ) : null}
    </>
  );
}

/**
 * A wide panel, image bleeding to one side and alternating down the column.
 *
 * Deliberately not the card grid in Experiment A: a declared intention
 * deserves answers that read as answers, one after another, rather than a
 * board of options to scan. Which side the picture sits on alternates purely
 * so a long column has a rhythm.
 */
function Panel({
  p,
  flip,
  saved,
  signedIn,
  terms,
  note,
}: {
  readonly p: Possibility;
  readonly flip: boolean;
  readonly saved: boolean;
  readonly signedIn: boolean;
  readonly terms?: readonly string[];
  readonly note?: string;
}) {
  return (
    <article
      data-testid="panel"
      data-source={p.source}
      className={`flex flex-col overflow-hidden rounded-xl border border-[#e9e6da]/10 transition-colors hover:border-[#d09a4e]/35 sm:flex-row ${
        flip ? "sm:flex-row-reverse" : ""
      }`}
    >
      <Link href={p.href} className="sm:w-2/5 sm:shrink-0">
        <Shot p={p} className="aspect-[16/9] w-full sm:aspect-auto sm:h-full" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-center p-5">
        <CardWhen p={p} />
        <h3 className="font-heading mt-1.5 text-2xl leading-tight text-balance text-[#f3efe4]">
          <Link href={p.href} className="hover:text-white">
            {p.title}
          </Link>
        </h3>
        {p.line ? (
          <p className="mt-2 max-w-prose leading-relaxed text-[#e9e6da]/55">
            {clip(p.line, 150)}
          </p>
        ) : null}
        {note ? <p className="mt-2 text-sm text-[#d09a4e]/85">{note}</p> : null}
        {terms && terms.length > 0 ? (
          <p className="mt-2 text-xs text-[#e9e6da]/30" data-testid="matched">
            matched {terms.slice(0, 4).join(", ")}
          </p>
        ) : null}
        <div className="mt-4">
          <LabKeep p={p} saved={saved} signedIn={signedIn} returnTo={HERE} />
        </div>
      </div>
    </article>
  );
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(" "));
  return `${cut.slice(0, stop > max * 0.5 ? stop : max).trim()}…`;
}

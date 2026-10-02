"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Heart, Loader2, X } from "lucide-react";
import type { Possibility } from "@/lib/labs/october/possibility";
import { merge, type DiscoveryIntent } from "@/lib/labs/discovery/intent";
import { FORKS } from "@/lib/labs/october/voice";
import { useKeeping } from "@/components/october/save/keeping";
import { addToTray } from "../tray";
import { Shot, When } from "../atoms";
import { clip, HERE } from "./cards";

/**
 * **Trust Me, kept as play and demoted from a product.**
 *
 * Experiment C's good idea was that October can deal with you rather than
 * display at you. Its bad idea — the one this version refuses — was being a
 * separate place with its own results, its own ranking and its own notion of
 * what you like.
 *
 * Here it is a panel over the one surface, and everything it learns is
 * expressed as a `DiscoveryIntent`:
 *
 * - each fork answer **is** an intent patch, the same object a chip produces
 * - **More like this** reads the card's own kind and adds that key, so it is
 *   just one more way of saying `{ feel: ["watch"] }`
 * - the deck is `resolve()`, not a second ranking model
 * - closing it leaves that intent on the page, so the session continues
 *   instead of ending
 *
 * Two questions is the limit. Past that it stops being *trust me* and becomes
 * a form, which is the thing the brief explicitly refuses.
 */

/**
 * What a card's own fields say about the kind of thing it is.
 *
 * Read off real fields, never guessed: the source decides the medium, the
 * authored fear level decides whether frightening was the point, and Atlas's
 * own classification decides whether the sky was. Saying "more like this" to
 * the Orionids used to add nothing at all, because only the source was read
 * and every Atlas subject looks the same through that one field.
 */
function moreLikeThis(p: Possibility): DiscoveryIntent {
  return {
    ...(p.source === "movie"
      ? { doing: ["watch" as const] }
      : p.source === "doing"
        ? { doing: ["make" as const] }
        : { feel: ["go-out" as const] }),
    ...((p.scare ?? 0) >= 2 ? { looking: ["scary" as const] } : {}),
    ...(p.setting === "astronomy" ? { where: ["sky" as const] } : {}),
  };
}

export function TrustMe({
  deck,
  intent,
  onIntent,
  onClose,
  signedIn,
  kept,
}: {
  /** Already resolved by the engine with the current intent. */
  readonly deck: readonly Possibility[];
  readonly intent: DiscoveryIntent;
  readonly onIntent: (next: DiscoveryIntent) => void;
  readonly onClose: () => void;
  readonly signedIn: boolean;
  readonly kept: ReadonlySet<string>;
}) {
  const [fork, setFork] = useState(0);
  const [seen, setSeen] = useState<readonly string[]>([]);
  const [said, setSaid] = useState<readonly string[]>([]);

  const asking = fork < FORKS.length;
  const card = deck.find((p) => !seen.includes(p.id));

  const answer = (means: DiscoveryIntent) => {
    onIntent(merge(intent, means));
    setFork((f) => f + 1);
  };

  return (
    <div
      data-testid="trust-me"
      className="fixed inset-0 z-40 overflow-y-auto bg-[#0c0a0c]/97 backdrop-blur-sm"
    >
      <div className="mx-auto flex min-h-full max-w-2xl flex-col px-5 py-8 sm:px-6">
        <button
          type="button"
          onClick={onClose}
          className="mb-6 inline-flex min-h-11 items-center gap-2 self-start text-sm text-[#e9e6da]/45 hover:text-[#e9e6da]"
        >
          <X className="h-4 w-4" aria-hidden />
          {said.length > 0 ? "That is enough — take me back" : "Never mind"}
        </button>

        {asking ? (
          <div className="flex flex-1 flex-col justify-center text-center">
            <p className="text-[11px] tracking-[0.22em] text-[#d09a4e] uppercase">
              {fork + 1} of {FORKS.length}
            </p>
            <h2 className="font-heading mt-3 text-4xl leading-tight text-[#f3efe4] sm:text-5xl">
              {FORKS[fork].asks}
            </h2>
            <div className="mx-auto mt-9 grid w-full max-w-lg gap-3 sm:grid-cols-2">
              {FORKS[fork].options.map((o) => (
                <button
                  key={o.label}
                  type="button"
                  data-testid="fork-option"
                  onClick={() => answer(o.means)}
                  className="rounded-xl border border-[#e9e6da]/15 p-6 text-left transition-colors hover:border-[#d09a4e] hover:bg-[#d09a4e]/[0.06]"
                >
                  <p className="font-heading text-2xl text-[#f3efe4]">
                    {o.label}
                  </p>
                  <p className="mt-1 text-sm text-[#e9e6da]/50">{o.under}</p>
                </button>
              ))}
            </div>
          </div>
        ) : card ? (
          <Deal
            key={card.id}
            p={card}
            saved={kept.has(card.id)}
            signedIn={signedIn}
            dealt={seen.length}
            onYes={() => {
              setSaid((s) => [...s, card.id]);
              setSeen((s) => [...s, card.id]);
            }}
            onMore={() => {
              onIntent(merge(intent, moreLikeThis(card)));
              setSeen((s) => [...s, card.id]);
            }}
            onSkip={() => setSeen((s) => [...s, card.id])}
          />
        ) : (
          <div className="flex flex-1 flex-col justify-center text-center">
            <h2 className="font-heading text-3xl text-[#f3efe4]">
              That is everything that fits.
            </h2>
            <p className="mt-3 text-[#e9e6da]/50">
              Go back and loosen it — October will have more.
            </p>
          </div>
        )}

        {!asking ? (
          <p className="mt-8 text-center text-xs text-[#e9e6da]/25">
            {said.length > 0
              ? `${said.length} in your Choices. Everything you said is still on the page behind this.`
              : "Whatever you pick stays on the page behind this."}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** One possibility, large, with three ways to answer it. */
function Deal({
  p,
  saved,
  signedIn,
  dealt,
  onYes,
  onMore,
  onSkip,
}: {
  readonly p: Possibility;
  readonly saved: boolean;
  readonly signedIn: boolean;
  readonly dealt: number;
  readonly onYes: () => void;
  readonly onMore: () => void;
  readonly onSkip: () => void;
}) {
  const keepable = p.keepAs
    ? {
        entityId: p.id,
        entityKind: p.keepAs,
        name: p.title,
        startsAt: p.startsAt ?? null,
      }
    : undefined;
  // Hooks cannot be conditional. `yes` never calls `toggle` without a real
  // keepable, so this placeholder is never sent anywhere.
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
    onYes();
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
          <When p={p} />
          <span className="text-[10px] tracking-[0.18em] text-[#e9e6da]/20 uppercase">
            card {dealt + 1}
          </span>
        </div>
        <h2 className="font-heading mt-2 text-3xl leading-tight text-balance text-[#f3efe4] sm:text-4xl">
          {p.title}
        </h2>
        {p.line ? (
          <p className="mt-3 max-w-xl leading-relaxed text-[#e9e6da]/60">
            {clip(p.line, 200)}
          </p>
        ) : null}

        <div className="mt-7 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={yes}
            disabled={state === "saving"}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#d09a4e] px-5 text-sm text-[#15100a] transition-colors hover:bg-[#e0ad63] disabled:opacity-60"
          >
            {state === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : isSaved ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Heart className="h-4 w-4" aria-hidden />
            )}
            Yes
          </button>
          <button
            type="button"
            onClick={onMore}
            className="inline-flex min-h-11 items-center rounded-full border border-[#d09a4e]/50 px-5 text-sm text-[#f0c88a] hover:bg-[#d09a4e]/10"
          >
            More like this
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex min-h-11 items-center rounded-full border border-[#e9e6da]/18 px-5 text-sm text-[#e9e6da]/60 hover:border-[#e9e6da]/40 hover:text-[#e9e6da]"
          >
            Not this
          </button>
        </div>

        {state === "failed" ? (
          <p className="mt-3 text-sm text-[#e98f6a]">
            That did not save. It is still here — try Yes again.
          </p>
        ) : null}
        {!signedIn ? (
          <p className="mt-3 text-xs text-[#e9e6da]/30">
            <Link
              href={`/signin?returnTo=${encodeURIComponent(HERE)}`}
              className="underline underline-offset-2 hover:text-[#e9e6da]"
            >
              Sign in
            </Link>{" "}
            and Yes puts it in your Choices properly.
          </p>
        ) : null}
      </div>
    </article>
  );
}

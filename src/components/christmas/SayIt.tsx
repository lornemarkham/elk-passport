"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { planHref, readSentence } from "@/domain/christmas/sentence";

const EXAMPLES = [
  "We have Saturday afternoon, two kids and $100",
  "Make us a romantic Christmas evening",
  "Friends, a market, hot chocolate, Sunday",
] as const;

/**
 * **Say it in a sentence.** "We have Saturday afternoon, two kids, and $100."
 * is read (`sentence.ts`) into the planner's own answers and the planner
 * opens already filled, the words kept for the Day Builder — which is what
 * reads the budget. No form stands between the sentence and the plan.
 */
export function SayIt({
  today,
  town,
}: {
  readonly today: string;
  readonly town?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");

  const go = (said: string) => {
    const read = readSentence(said, today);
    router.push(planHref(read, town ? { at: town } : {}));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go(text);
      }}
      aria-label="Tell Passport about your Christmas"
      data-testid="say-it"
    >
      <label
        htmlFor="say-it-input"
        className="ghad-display block text-3xl leading-[1] font-extrabold tracking-[-0.03em] text-balance sm:text-4xl"
      >
        What does your Christmas look like?
      </label>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          id="say-it-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Saturday afternoon, two kids, $100"
          maxLength={200}
          autoComplete="off"
          enterKeyHint="go"
          className="min-h-14 w-full rounded-full border-2 border-black/10 bg-white px-5 text-lg shadow-[0_6px_24px_rgba(8,35,25,0.07)] focus:border-[#0f3b2b] focus:outline-none"
        />
        <button
          type="submit"
          className="inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-full bg-[#b3242f] px-7 text-lg font-bold text-white hover:brightness-110"
          data-testid="say-it-go"
        >
          Make it a plan
          <ArrowRight className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <li key={example}>
            <button
              type="button"
              onClick={() => go(example)}
              className="min-h-11 rounded-full bg-white px-4 text-left text-sm font-semibold ring-1 ring-black/10 hover:ring-black/30"
            >
              {example}
            </button>
          </li>
        ))}
      </ul>
    </form>
  );
}

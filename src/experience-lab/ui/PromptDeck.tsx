"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PromptCard } from "./PromptCard";
import type { LivePrompt } from "../core/engine";
import type { Participant, ResponseValue } from "../core/types";

/**
 * **One question at a time.**
 *
 * Round 1's honest complaint was that seven prediction cards in a column read
 * as a form. This is the contained experiment in fixing that, and it is a
 * *presentation* choice on an existing block rather than a new kind of thing —
 * the same prompts, the same cards, stacked instead of listed.
 *
 * The two details that turned out to matter more than the stacking itself:
 *
 * 1. **It opens on the first thing you have not answered.** A deck that opens
 *    at card one makes an eight-tap job feel like an eight-tap job.
 * 2. **Answering advances it.** The reward for having an opinion is the next
 *    question, immediately, which is what turns it from a form into a run.
 */
export function PromptDeck({
  prompts,
  me,
  people,
  onRespond,
  onAddOption,
  onCue,
  onConsent,
}: {
  prompts: readonly LivePrompt[];
  me: Participant | null;
  people: readonly Participant[];
  onRespond: (promptId: string, value: ResponseValue) => void;
  onAddOption: (promptId: string, label: string) => void;
  onCue: (promptId: string) => void;
  onConsent: (promptId: string, agreed: boolean) => void;
}) {
  const firstUnanswered = Math.max(
    0,
    prompts.findIndex((p) => p.myResponse === undefined),
  );
  const [index, setIndex] = useState(firstUnanswered);
  const [touched, setTouched] = useState(false);

  if (prompts.length === 0) return null;

  // Until somebody moves it themselves, the deck keeps following them.
  const at = touched ? Math.min(index, prompts.length - 1) : firstUnanswered;
  const current = prompts[at];
  const done = prompts.filter((p) => p.myResponse !== undefined).length;

  const go = (next: number) => {
    setTouched(true);
    setIndex(Math.max(0, Math.min(prompts.length - 1, next)));
  };

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-1.5">
        {prompts.map((prompt, i) => (
          <button
            key={prompt.prompt.id}
            type="button"
            aria-label={`Question ${i + 1}`}
            onClick={() => go(i)}
            className={`h-1.5 flex-1 rounded-full transition ${
              i === at
                ? "bg-white"
                : prompt.myResponse !== undefined
                  ? "bg-white/45"
                  : "bg-white/15"
            }`}
          />
        ))}
      </div>

      <PromptCard
        key={current.prompt.id}
        live={current}
        me={me}
        people={people}
        onRespond={(value) => {
          onRespond(current.prompt.id, value);
          if (at < prompts.length - 1) go(at + 1);
        }}
        onAddOption={(label) => onAddOption(current.prompt.id, label)}
        onCue={onCue}
        onConsent={onConsent}
      />

      <div className="mt-2.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(at - 1)}
          disabled={at === 0}
          className="inline-flex items-center gap-1 rounded-full border border-white/12 px-3 py-1.5 text-[12.5px] text-white/55 transition hover:border-white/35 disabled:opacity-25"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <span className="text-[12.5px] text-white/40 tabular-nums">
          {done} of {prompts.length} in
        </span>
        <button
          type="button"
          onClick={() => go(at + 1)}
          disabled={at === prompts.length - 1}
          className="inline-flex items-center gap-1 rounded-full border border-white/12 px-3 py-1.5 text-[12.5px] text-white/55 transition hover:border-white/35 disabled:opacity-25"
        >
          {current.myResponse === undefined ? "Skip" : "Next"}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

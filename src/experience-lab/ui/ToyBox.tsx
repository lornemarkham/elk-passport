"use client";

import { useMemo, useState } from "react";
import { Dices, Sparkles, X } from "lucide-react";
import { Avatar } from "./atoms";
import { offeredToys, type Toy, type ToyInput } from "../core/toybox";
import type {
  Edge,
  ExperienceDefinition,
  Participant,
  Starter,
  ToyFamily,
} from "../core/types";

/**
 * **"Make this interesting 👀"**
 *
 * Round 1's finding was that the best question of the night is the one
 * Passport did not write. The obvious trap is to conclude "so give people a
 * text box" — which is a blank page, and a blank page is where enthusiasm
 * goes to die.
 *
 * This is the attempt at the middle: Passport offers a *specific* idea, and
 * the three things you can do with it are all one tap — **take it**,
 * **reroll it**, or **write your own instead**. The idea is not the product;
 * it is the thing that gets a person past the blank page and into writing
 * their own, which is when it gets good.
 *
 * Everything here compiles down to `Prompt`s. There is no toy runtime.
 */
export function ToyBox({
  definition,
  edge,
  appetite,
  people,
  me,
  phaseId,
  lockPhaseId,
  onAdd,
  onClose,
}: {
  definition: ExperienceDefinition;
  edge: Edge;
  appetite: "watch" | "some" | "lots";
  people: readonly Participant[];
  me: Participant;
  phaseId: string;
  lockPhaseId?: string;
  onAdd: (family: ToyFamily, input: Omit<ToyInput, "id" | "askedBy">) => void;
  onClose: () => void;
}) {
  const offers = useMemo(
    () => offeredToys(definition, edge, appetite),
    [definition, edge, appetite],
  );
  const [openFamily, setOpenFamily] = useState<ToyFamily | null>(null);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end bg-black/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close"
        className="flex-1"
        onClick={onClose}
      />
      <div className="max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[oklch(0.17_0.02_260)] px-5 pt-5 pb-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-bold tracking-tight text-white">
                Make this interesting 👀
              </h2>
              <p className="mt-1 text-[13.5px] text-white/50">
                Passport has ideas. Yours will be better.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-white/45 hover:text-white"
              aria-label="Close toy box"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <ul className="mt-5 flex flex-col gap-2.5">
            {offers.map(({ toy, starters }) => (
              <li key={toy.family}>
                <ToyRow
                  toy={toy}
                  starters={starters}
                  people={people}
                  me={me}
                  open={openFamily === toy.family}
                  onToggle={() =>
                    setOpenFamily(openFamily === toy.family ? null : toy.family)
                  }
                  onAdd={(text, targetId, points, starterEdge) => {
                    onAdd(toy.family, {
                      text,
                      targetId,
                      phaseId,
                      locksAtPhaseId: lockPhaseId,
                      points,
                      edge: starterEdge,
                    });
                    setOpenFamily(null);
                    onClose();
                  }}
                />
              </li>
            ))}
          </ul>

          {offers.length === 0 && (
            <p className="mt-6 text-[14px] text-white/45">
              Nothing to suggest for this kind of night — which is the right
              answer for some of them.
            </p>
          )}

          <p className="mt-6 text-[11.5px] leading-relaxed text-white/25">
            Only ideas at or below the night&apos;s setting are shown, and
            anything aimed at one person needs them to opt in first. Nobody is
            told who opted out of what.
          </p>
        </div>
      </div>
    </div>
  );
}

function ToyRow({
  toy,
  starters,
  people,
  me,
  open,
  onToggle,
  onAdd,
}: {
  toy: Toy;
  starters: readonly Starter[];
  people: readonly Participant[];
  me: Participant;
  open: boolean;
  onToggle: () => void;
  onAdd: (
    text: string,
    targetId: string | undefined,
    points: number,
    edge: Edge,
  ) => void;
}) {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * starters.length),
  );
  const [draft, setDraft] = useState("");
  const [writing, setWriting] = useState(false);
  const [target, setTarget] = useState<string | undefined>(undefined);

  const starter = starters[index % starters.length];
  const needsTarget = toy.needsTarget || starter.needsTarget;
  const others = people.filter((p) => p.id !== me.id);
  const text = writing ? draft : starter.text;
  const ready = text.trim().length > 0 && (!needsTarget || target);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-left transition hover:border-white/35"
      >
        <span className="text-[15px] font-semibold text-white">
          {toy.label}
        </span>
        <span className="mt-0.5 block text-[12.5px] text-white/45">
          {toy.blurb}
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-white/30 bg-white/[0.06] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold text-white">
          {toy.label}
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="text-[12.5px] text-white/40 hover:text-white"
        >
          close
        </button>
      </div>

      {writing ? (
        <textarea
          autoFocus
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            toy.family === "consequence"
              ? "Pick a side | what the losing side owes"
              : starter.text
          }
          className="mt-3 w-full resize-none rounded-xl border border-white/15 bg-black/25 px-3.5 py-2.5 text-[15px] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none"
        />
      ) : (
        <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-[15px] leading-snug text-white/90">
          {starter.text}
        </p>
      )}

      {needsTarget && (
        <div className="mt-3">
          <p className="text-[12px] tracking-wide text-white/40 uppercase">
            Who gets it?
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {others.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => setTarget(person.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12.5px] transition ${
                  target === person.id
                    ? "border-white/60 bg-white/10 text-white"
                    : "border-white/12 text-white/55 hover:border-white/35"
                }`}
              >
                <Avatar person={person} size={18} />
                {person.name}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-white/30">
            They see it privately, and they can decline without anyone knowing.
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={() =>
            onAdd(text.trim(), target, starter.points ?? 5, starter.edge)
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-black disabled:opacity-30"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Add it
        </button>
        {!writing && starters.length > 1 && (
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % starters.length)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] text-white/65 transition hover:border-white/40"
          >
            <Dices className="h-3.5 w-3.5" />
            Another
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setWriting((w) => !w);
            setDraft(writing ? "" : starter.text);
          }}
          className="rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] text-white/65 transition hover:border-white/40"
        >
          {writing ? "Use Passport's" : "Write my own"}
        </button>
      </div>
    </div>
  );
}

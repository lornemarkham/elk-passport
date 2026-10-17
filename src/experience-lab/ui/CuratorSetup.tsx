"use client";

import { useState } from "react";
import { EDGE_LABELS, type Brief, type Edge } from "../core/types";

/**
 * **"What kind of night are we making?"**
 *
 * Four taps and an optional sentence, and it appears once, to the person who
 * made the thing. The rule it was built against: **if this ever stops
 * visibly changing what Passport offers, delete it rather than expand it.**
 * An onboarding questionnaire that only produces a stored preference is the
 * exact failure mode — so every answer here has a job:
 *
 * - **who** and **vibe** colour the wording Passport suggests;
 * - **how far** sets the night's ceiling, which filters what can be aimed at
 *   anyone;
 * - **appetite** decides how heavy a toy Passport will even offer — somebody
 *   who says "we mostly want to watch the game" is never shown the
 *   three-part ones.
 *
 * The free-text box is honest about being a stand-in: nothing reads it today.
 * It is here because it is the input a real Passport would want most, and
 * pretending otherwise would make the lab less useful.
 */

const AUDIENCES = [
  "Friends",
  "Coworkers, off duty",
  "Family",
  "A date",
  "Mixed group",
];
const VIBES = ["Chill", "Social", "Silly", "Competitive", "Adventurous"];
const APPETITES: {
  id: Brief["appetite"];
  label: string;
  detail: string;
}[] = [
  {
    id: "watch",
    label: "We're here for the thing",
    detail: "A couple of small moments, nothing more",
  },
  {
    id: "some",
    label: "Give us a few things",
    detail: "Something to do in the gaps",
  },
  {
    id: "lots",
    label: "Make it interactive",
    detail: "We will absolutely get carried away",
  },
];

export function CuratorSetup({
  title,
  onDone,
  onSkip,
}: {
  title: string;
  onDone: (brief: Brief) => void;
  onSkip: () => void;
}) {
  const [audience, setAudience] = useState("Coworkers, off duty");
  const [vibe, setVibe] = useState("Silly");
  const [edge, setEdge] = useState<Edge>(1);
  const [appetite, setAppetite] = useState<Brief["appetite"]>("some");
  const [note, setNote] = useState("");

  return (
    <div className="mx-auto max-w-2xl px-5 pb-10">
      <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-5">
        <p className="text-[15.5px] text-white/75">
          You&apos;re making{" "}
          <span className="font-semibold text-white">{title}</span>.
        </p>
        <p className="mt-1 text-[14px] text-white/50">
          Four taps so Passport knows what to suggest. You can change any of it
          later.
        </p>

        <Row label="Who is this?">
          {AUDIENCES.map((option) => (
            <Chip
              key={option}
              on={audience === option}
              onClick={() => setAudience(option)}
            >
              {option}
            </Chip>
          ))}
        </Row>

        <Row label="What's the vibe?">
          {VIBES.map((option) => (
            <Chip
              key={option}
              on={vibe === option}
              onClick={() => setVibe(option)}
            >
              {option}
            </Chip>
          ))}
        </Row>

        <Row label="How far can Passport push?">
          {([0, 1, 2, 3] as Edge[]).map((level) => (
            <Chip
              key={level}
              on={edge === level}
              onClick={() => setEdge(level)}
            >
              {EDGE_LABELS[level]}
            </Chip>
          ))}
        </Row>
        <p className="mt-1.5 text-[12px] text-white/35">
          This is a ceiling for the night. Anyone can set themselves lower and
          nobody is told who did.
        </p>

        <Row label="How much do you want to be doing?">
          {APPETITES.map((option) => (
            <Chip
              key={option.id}
              on={appetite === option.id}
              onClick={() => setAppetite(option.id)}
              detail={option.detail}
            >
              {option.label}
            </Chip>
          ))}
        </Row>

        <label className="mt-5 block">
          <span className="text-[12px] tracking-wide text-white/40 uppercase">
            Anything Passport should know?
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="Six coworkers. Not a work event. We like giving each other shit."
            className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-[14.5px] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none"
          />
        </label>
        <p className="mt-1 text-[11.5px] text-white/25">
          Stored, not read. This is the input a real Passport would want most,
          and the lab is not pretending to use it yet.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() =>
              onDone({
                audience,
                vibe,
                edge,
                appetite,
                note: note.trim() || undefined,
              })
            }
            className="rounded-full bg-white px-5 py-2 text-[14px] font-semibold text-black"
          >
            Make the night
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="text-[13px] text-white/40 underline-offset-4 hover:text-white/70 hover:underline"
          >
            Skip — I&apos;ll wing it
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <p className="text-[12px] tracking-wide text-white/40 uppercase">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  children,
  detail,
  on,
  onClick,
}: {
  children: React.ReactNode;
  detail?: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-left transition ${
        on
          ? "border-white/60 bg-white/10 text-white"
          : "border-white/12 text-white/60 hover:border-white/35"
      }`}
    >
      <span className="block text-[14px] font-medium">{children}</span>
      {detail && (
        <span className="mt-0.5 block text-[11.5px] text-white/40">
          {detail}
        </span>
      )}
    </button>
  );
}

/**
 * The other half of the consent model, and deliberately not part of the
 * curator's flow: your own ceiling is yours. Rendered small, near you, and
 * changeable at any moment without telling anybody.
 */
export function MyLimit({
  nightEdge,
  mine,
  onChange,
}: {
  nightEdge: Edge;
  mine: Edge | null;
  onChange: (edge: Edge | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const effective = Math.min(nightEdge, mine ?? nightEdge) as Edge;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-10 text-left text-[12px] text-white/35 underline-offset-4 hover:text-white/70 hover:underline"
      >
        You&apos;re set to “{EDGE_LABELS[effective]}” — change
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/12 p-3">
      <p className="text-[12.5px] text-white/55">
        How much are <span className="text-white">you</span> up for? Nobody is
        told what you pick, and nothing above it gets aimed at you.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {([0, 1, 2, 3] as Edge[])
          .filter((level) => level <= nightEdge)
          .map((level) => (
            <Chip
              key={level}
              on={effective === level}
              onClick={() => {
                onChange(level);
                setOpen(false);
              }}
            >
              {EDGE_LABELS[level]}
            </Chip>
          ))}
      </div>
      {nightEdge < 3 && (
        <p className="mt-2 text-[11.5px] text-white/30">
          The night is capped at “{EDGE_LABELS[nightEdge]}”. You can go lower,
          never higher.
        </p>
      )}
    </div>
  );
}

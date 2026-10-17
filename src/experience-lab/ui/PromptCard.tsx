"use client";

import { useState } from "react";
import {
  Camera,
  Check,
  Eye,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Vault,
} from "lucide-react";
import {
  getPhoto,
  photoKey,
  putPhoto,
  readFileAsDataUrl,
  tileFor,
} from "./photos";
import { Avatar, AvatarRow, Pill, personColor } from "./atoms";
import type { LivePrompt } from "../core/engine";
import type { Participant, ResponseValue } from "../core/types";

/**
 * **One question, any shape.**
 *
 * This component is the practical test of whether `Prompt` is really one
 * primitive. It renders a pub vote, a sealed score prediction, a dare about a
 * friend, a scavenger-hunt tick and a private sentence with no branching
 * beyond `kind`, and no fixture ever tells it how to look.
 *
 * The interaction rule it is built around: **answering is one tap.** There is
 * no submit button on anything except free text, because the moment a person
 * has to confirm an opinion, they stop giving you opinions.
 */
export function PromptCard({
  live,
  me,
  people,
  onRespond,
  onAddOption,
  onCue,
  onConsent,
}: {
  live: LivePrompt;
  me: Participant | null;
  people: readonly Participant[];
  onRespond: (value: ResponseValue) => void;
  onAddOption?: (label: string, detail?: string) => void;
  onCue?: (promptId: string) => void;
  onConsent?: (promptId: string, agreed: boolean) => void;
}) {
  const { prompt, myResponse, locked, revealed, responses } = live;
  const asker = prompt.askedBy
    ? people.find((p) => p.id === prompt.askedBy)
    : undefined;
  const resolved = prompt.resolution !== undefined && live.showResolution;
  const canAnswer = Boolean(me) && live.open;
  const hidden = prompt.requiresConsent && me !== null && !live.consented;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[17px] leading-snug font-semibold text-white">
            {prompt.question}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {asker && (
              <span className="inline-flex items-center gap-1 text-[12px] text-white/45">
                <Avatar person={asker} size={16} />
                {asker.name} asked this
              </span>
            )}
            {prompt.scoring && (
              <Pill tone="hot">
                <Sparkles className="h-3 w-3" />
                {prompt.scoring.label ?? "Points"} +{prompt.scoring.points}
              </Pill>
            )}
            {locked && (
              <Pill tone="locked">
                <Lock className="h-3 w-3" />
                Locked
              </Pill>
            )}
            {prompt.reveal === "never" && <Pill>Only you see this</Pill>}
            {prompt.audience?.only && (
              <Pill>
                <Eye className="h-3 w-3" />
                Only you know about this
              </Pill>
            )}
            {prompt.reveal === "onCue" && !revealed && (
              <Pill tone="locked">
                <Vault className="h-3 w-3" />
                In the vault
              </Pill>
            )}
            {prompt.reveal === "onLock" && !locked && !myResponse && (
              <Pill>Sealed until everyone&apos;s in</Pill>
            )}
          </div>
        </div>
      </div>

      {/* A mission's briefing is the interesting half; the question under it is
          just "did you do it". */}
      {prompt.brief && (
        <p className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-[15px] leading-snug text-white/90">
          {prompt.brief}
        </p>
      )}

      {prompt.requiresConsent && me && !live.consented && onConsent && (
        <ConsentGate
          prompt={prompt}
          onAgree={() => onConsent(prompt.id, true)}
          onPass={() => onConsent(prompt.id, false)}
        />
      )}

      <div
        className={`mt-3.5 ${hidden ? "pointer-events-none opacity-30" : ""}`}
      >
        {prompt.kind === "photo" && (
          <PhotoBody
            live={live}
            me={me}
            people={people}
            canAnswer={canAnswer}
            onRespond={onRespond}
          />
        )}
        {prompt.optionsFrom?.as === "submissions" && (
          <VaultVoteBody
            live={live}
            me={me}
            people={people}
            canAnswer={canAnswer}
            onRespond={onRespond}
          />
        )}
        {!prompt.optionsFrom &&
          (prompt.kind === "choice" || prompt.kind === "person") && (
            <ChoiceBody
              live={live}
              me={me}
              people={people}
              revealed={revealed}
              canAnswer={canAnswer}
              onRespond={onRespond}
            />
          )}
        {prompt.optionsFrom?.as === "authors" && (
          <ChoiceBody
            live={live}
            me={me}
            people={people}
            revealed={revealed}
            canAnswer={canAnswer}
            onRespond={onRespond}
          />
        )}
        {prompt.kind === "boolean" && (
          <BooleanBody
            live={live}
            revealed={revealed}
            canAnswer={canAnswer}
            people={people}
            onRespond={onRespond}
          />
        )}
        {prompt.kind === "number" && (
          <NumberBody live={live} canAnswer={canAnswer} onRespond={onRespond} />
        )}
        {prompt.kind === "pair" && (
          <PairBody live={live} canAnswer={canAnswer} onRespond={onRespond} />
        )}
        {prompt.kind === "text" && (
          <TextBody live={live} canAnswer={canAnswer} onRespond={onRespond} />
        )}
      </div>

      {/* Only once you have committed. Repeating "4 in, hidden" under seven
          unanswered cards turned a set of questions into a form — the pill
          already says the card is sealed, and the group's progress belongs to
          the group, not to each individual question. */}
      {!revealed && myResponse !== undefined && (
        <p className="mt-3 text-[12px] text-white/40">
          Yours is in
          {responses.length > 1 && `, with ${responses.length - 1} others`}.
        </p>
      )}

      {live.awaitingCue && onCue && me && (
        <button
          type="button"
          onClick={() => onCue(prompt.id)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300/50 px-4 py-1.5 text-[13px] font-semibold text-amber-200 transition hover:bg-amber-300/10"
        >
          <Vault className="h-3.5 w-3.5" />
          {live.responses.length > 0 && live.prompt.kind !== "person"
            ? `Open it — ${live.responses.length} inside`
            : "Reveal the answer"}
        </button>
      )}

      {live.owed && (
        <p className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/[0.07] px-3.5 py-2.5 text-[13.5px] text-amber-100">
          You owe: {live.owed}
        </p>
      )}

      {resolved && <Resolution live={live} people={people} />}

      {prompt.openToSuggestions && canAnswer && onAddOption && (
        <AddOption hint={prompt.hint} onAdd={onAddOption} />
      )}

      {!me && (
        <p className="mt-3 text-[12px] text-white/40">
          Join to answer — takes one tap.
        </p>
      )}
    </div>
  );
}

function ChoiceBody({
  live,
  me,
  people,
  revealed,
  canAnswer,
  onRespond,
}: {
  live: LivePrompt;
  me: Participant | null;
  people: readonly Participant[];
  revealed: boolean;
  canAnswer: boolean;
  onRespond: (value: ResponseValue) => void;
}) {
  const mine = live.myResponse?.value;
  return (
    <ul className="flex flex-col gap-2">
      {live.tally.map((option) => {
        const chosen = mine === option.optionId;
        const correct =
          live.showResolution &&
          live.prompt.resolution !== undefined &&
          live.prompt.resolution === option.optionId;
        return (
          <li key={option.optionId}>
            <button
              type="button"
              disabled={!canAnswer}
              onClick={() => onRespond(option.optionId)}
              className={`relative w-full overflow-hidden rounded-xl border px-3.5 py-3 text-left transition ${
                chosen
                  ? "border-white/60 bg-white/[0.1]"
                  : "border-white/10 hover:border-white/30"
              } ${canAnswer ? "cursor-pointer" : "cursor-default"} ${
                correct ? "ring-1 ring-emerald-400/60" : ""
              }`}
            >
              {revealed && option.share > 0 && (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 transition-[width] duration-500"
                  style={{
                    width: `${Math.round(option.share * 100)}%`,
                    background: option.leading
                      ? "oklch(1 0 0 / 0.16)"
                      : "oklch(1 0 0 / 0.08)",
                  }}
                />
              )}
              <span className="relative flex items-center gap-3">
                {option.emoji && (
                  <span className="text-lg leading-none">{option.emoji}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-medium text-white">
                    {option.label}
                    {chosen && <Check className="h-3.5 w-3.5 text-white/70" />}
                    {correct && (
                      <span className="text-[11px] font-semibold text-emerald-300">
                        that&apos;s what happened
                      </span>
                    )}
                  </span>
                  {option.detail && (
                    <span className="mt-0.5 block text-[12.5px] text-white/45">
                      {option.detail}
                    </span>
                  )}
                  {option.addedBy && (
                    <span className="mt-0.5 block text-[11px] text-white/35">
                      {people.find((p) => p.id === option.addedBy)?.name ??
                        "Someone"}{" "}
                      added this
                    </span>
                  )}
                </span>
                {revealed && option.voters.length > 0 && (
                  <AvatarRow people={option.voters} size={22} max={5} />
                )}
              </span>
            </button>
          </li>
        );
      })}
      {!revealed && me && live.myResponse !== undefined && (
        <li className="text-[12px] text-white/45">
          Your pick is in and hidden.
        </li>
      )}
    </ul>
  );
}

function BooleanBody({
  live,
  revealed,
  canAnswer,
  people,
  onRespond,
}: {
  live: LivePrompt;
  revealed: boolean;
  canAnswer: boolean;
  people: readonly Participant[];
  onRespond: (value: ResponseValue) => void;
}) {
  const mine = live.myResponse?.value;
  const voters = (value: boolean) =>
    live.responses
      .filter((r) => r.value === value)
      .map((r) => people.find((p) => p.id === r.participantId))
      .filter((p): p is Participant => Boolean(p));

  return (
    <div className="grid grid-cols-2 gap-2">
      {[true, false].map((value) => {
        const chosen = mine === value;
        const correct = live.showResolution && live.prompt.resolution === value;
        return (
          <button
            key={String(value)}
            type="button"
            disabled={!canAnswer}
            onClick={() => onRespond(value)}
            className={`rounded-xl border px-3 py-3.5 text-center transition ${
              chosen
                ? "border-white/60 bg-white/[0.1]"
                : "border-white/10 hover:border-white/30"
            } ${correct ? "ring-1 ring-emerald-400/60" : ""}`}
          >
            <span className="block text-[15px] font-semibold text-white">
              {value ? "Yes" : "No"}
            </span>
            {revealed && (
              <span className="mt-1.5 flex justify-center">
                <AvatarRow people={voters(value)} size={20} max={6} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function NumberBody({
  live,
  canAnswer,
  onRespond,
}: {
  live: LivePrompt;
  canAnswer: boolean;
  onRespond: (value: ResponseValue) => void;
}) {
  const answered = typeof live.myResponse?.value === "number";
  const value = answered ? (live.myResponse!.value as number) : 5;
  return (
    <div className="flex items-center gap-3">
      <Stepper
        value={value}
        answered={answered}
        disabled={!canAnswer}
        onChange={(next) => onRespond(next)}
      />
      <span className="text-[13px] text-white/45">
        {live.prompt.unit}
        {!answered && canAnswer && (
          <span className="block text-white/35">
            Nudge it and it&apos;s yours
          </span>
        )}
      </span>
    </div>
  );
}

function PairBody({
  live,
  canAnswer,
  onRespond,
}: {
  live: LivePrompt;
  canAnswer: boolean;
  onRespond: (value: ResponseValue) => void;
}) {
  const answered = Array.isArray(live.myResponse?.value);
  const current: readonly number[] = answered
    ? (live.myResponse!.value as readonly number[])
    : [2, 2];
  const labels = live.prompt.pairLabels ?? ["A", "B"];
  const set = (index: 0 | 1, next: number) => {
    const pair: [number, number] = [current[0] ?? 0, current[1] ?? 0];
    pair[index] = next;
    onRespond(pair);
  };
  return (
    <div>
      <div className="flex items-end justify-center gap-5 py-1">
        {[0, 1].map((index) => (
          <div key={index} className="flex flex-col items-center gap-2">
            <span className="text-[12px] font-medium tracking-wide text-white/50 uppercase">
              {labels[index]}
            </span>
            <Stepper
              value={current[index] ?? 0}
              answered={answered}
              disabled={!canAnswer}
              onChange={(next) => set(index as 0 | 1, next)}
              large
            />
          </div>
        ))}
      </div>
      {!answered && canAnswer && (
        <p className="mt-1 text-center text-[12px] text-white/35">
          Nudge a number and the pick is yours
        </p>
      )}
    </div>
  );
}

function Stepper({
  value,
  onChange,
  disabled,
  answered = true,
  large = false,
}: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  answered?: boolean;
  large?: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl border p-1 ${
        answered ? "border-white/45 bg-white/[0.07]" : "border-white/10"
      }`}
    >
      <StepButton
        label="−"
        disabled={disabled || value <= 0}
        onClick={() => onChange(Math.max(0, value - 1))}
      />
      <span
        className={`min-w-10 text-center font-semibold tabular-nums ${
          answered ? "text-white" : "text-white/35"
        } ${large ? "text-3xl" : "text-2xl"}`}
      >
        {value}
      </span>
      <StepButton
        label="+"
        disabled={disabled || value >= 20}
        onClick={() => onChange(Math.min(20, value + 1))}
      />
    </div>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-9 w-9 rounded-lg text-lg text-white/70 transition hover:bg-white/10 disabled:opacity-25"
    >
      {label}
    </button>
  );
}

function TextBody({
  live,
  canAnswer,
  onRespond,
}: {
  live: LivePrompt;
  canAnswer: boolean;
  onRespond: (value: ResponseValue) => void;
}) {
  const [draft, setDraft] = useState(
    typeof live.myResponse?.value === "string" ? live.myResponse.value : "",
  );
  const saved =
    typeof live.myResponse?.value === "string" ? live.myResponse.value : "";
  return (
    <div>
      <textarea
        value={draft}
        disabled={!canAnswer}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={live.prompt.placeholder ?? "Say something."}
        rows={2}
        className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3.5 py-2.5 text-[15px] text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
      />
      {draft !== saved && canAnswer && (
        <button
          type="button"
          onClick={() => onRespond(draft)}
          className="mt-2 rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-black"
        >
          Keep it
        </button>
      )}
      {live.revealed && live.responses.length > 1 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {live.responses
            .filter((r) => typeof r.value === "string" && r.value.trim())
            .map((r) => (
              <li key={r.participantId} className="text-[14px] text-white/70">
                &ldquo;{String(r.value)}&rdquo;
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function Resolution({
  live,
  people,
}: {
  live: LivePrompt;
  people: readonly Participant[];
}) {
  const { prompt } = live;
  let text: string;
  if (prompt.kind === "pair" && Array.isArray(prompt.resolution)) {
    const pair = prompt.resolution as readonly number[];
    text = `${prompt.pairLabels?.[0]} ${pair[0]} – ${pair[1]} ${prompt.pairLabels?.[1]}`;
  } else if (prompt.kind === "boolean") {
    text = prompt.resolution ? "Yes." : "No.";
  } else if (prompt.kind === "person") {
    text =
      people.find((p) => p.id === prompt.resolution)?.name ??
      String(prompt.resolution);
  } else if (prompt.kind === "choice") {
    text =
      prompt.options?.find((o) => o.id === prompt.resolution)?.label ??
      String(prompt.resolution);
  } else {
    text = String(prompt.resolution);
  }

  const winners = live.responses
    .filter(
      (r) => JSON.stringify(r.value) === JSON.stringify(prompt.resolution),
    )
    .map((r) => people.find((p) => p.id === r.participantId))
    .filter((p): p is Participant => Boolean(p));

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.07] px-3 py-2">
      <span className="text-[13px] font-semibold text-emerald-200">{text}</span>
      {winners.length > 0 ? (
        <span className="flex items-center gap-1.5 text-[12px] text-white/55">
          <AvatarRow people={winners} size={20} max={6} /> called it
        </span>
      ) : (
        <span className="text-[12px] text-white/45">Nobody called it.</span>
      )}
    </div>
  );
}

function AddOption({
  hint,
  onAdd,
}: {
  hint?: string;
  onAdd: (label: string, detail?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex min-h-10 items-center gap-1.5 text-[13px] font-medium text-white/55 transition hover:text-white"
      >
        <Plus className="h-3.5 w-3.5" />
        Suggest somewhere else
      </button>
    );
  }

  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onAdd(label);
        setLabel("");
        setOpen(false);
      }}
    >
      <input
        autoFocus
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder={hint ?? "Your suggestion"}
        className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/20 px-3.5 py-2 text-[14px] text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black disabled:opacity-30"
        disabled={!label.trim()}
      >
        Add
      </button>
    </form>
  );
}

export { personColor };

/**
 * **Opting in, before anything can bind you.**
 *
 * Two things this deliberately does not do: it does not tell anybody you
 * passed, and it does not make passing feel like losing. "Not tonight" closes
 * the card and that is the end of it — the thing that makes a dare safe is not
 * a rating, it is that declining costs nothing socially.
 */
function ConsentGate({
  prompt,
  onAgree,
  onPass,
}: {
  prompt: LivePrompt["prompt"];
  onAgree: () => void;
  onPass: () => void;
}) {
  const forfeit = prompt.options?.find((o) => o.consequence)?.consequence;
  return (
    <div className="mt-3 rounded-xl border border-white/20 bg-white/[0.05] p-3.5">
      <p className="flex items-start gap-2 text-[13.5px] leading-snug text-white/75">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-white/50" />
        <span>
          {forfeit
            ? `If you're wrong you've agreed to: ${forfeit}`
            : "This one's aimed at you. In or out?"}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onAgree}
          className="rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-black"
        >
          I&apos;m in
        </button>
        <button
          type="button"
          onClick={onPass}
          className="rounded-full border border-white/15 px-4 py-1.5 text-[13px] text-white/60 transition hover:border-white/40"
        >
          Not tonight
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-white/30">
        Nobody is told either way.
      </p>
    </div>
  );
}

/**
 * A photo submission, and the tile that stands in for it.
 *
 * The caption is the answer — it persists, it is what the vault votes on, and
 * it is what ends up in the recap. A real picked image is a session-only
 * bonus. See `photos.ts` for why that is the right trade for this lab.
 */
function PhotoBody({
  live,
  me,
  people,
  canAnswer,
  onRespond,
}: {
  live: LivePrompt;
  me: Participant | null;
  people: readonly Participant[];
  canAnswer: boolean;
  onRespond: (value: ResponseValue) => void;
}) {
  const saved =
    typeof live.myResponse?.value === "string" ? live.myResponse.value : "";
  const [draft, setDraft] = useState(saved);
  const [image, setImage] = useState<string | undefined>(() =>
    me ? getPhoto(photoKey(live.prompt.id, me.id)) : undefined,
  );

  const submitted = saved.length > 0;

  return (
    <div>
      {submitted && me && <PhotoTile caption={saved} image={image} by={me} />}

      {canAnswer && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Caption it."
            className="w-full rounded-xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-[15px] text-white placeholder:text-white/25 focus:border-white/40 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-[13px] text-white/65 transition hover:border-white/40">
              <Camera className="h-3.5 w-3.5" />
              {image ? "Change photo" : "Add a photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file || !me) return;
                  const url = await readFileAsDataUrl(file);
                  putPhoto(photoKey(live.prompt.id, me.id), url);
                  setImage(url);
                }}
              />
            </label>
            {draft.trim() !== saved && (
              <button
                type="button"
                onClick={() => onRespond(draft.trim())}
                className="rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-black"
              >
                {submitted ? "Update" : "Submit"}
              </button>
            )}
          </div>
        </div>
      )}

      {live.revealed && live.responses.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {live.responses
            .filter((r) => r.participantId !== me?.id)
            .map((r) => {
              const who = people.find((p) => p.id === r.participantId);
              if (!who) return null;
              return (
                <li key={r.participantId}>
                  <PhotoTile
                    caption={String(r.value)}
                    image={getPhoto(photoKey(live.prompt.id, r.participantId))}
                    by={who}
                  />
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}

function PhotoTile({
  caption,
  image,
  by,
}: {
  caption: string;
  image?: string;
  by?: Participant;
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-white/10">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={caption} className="h-28 w-full object-cover" />
      ) : (
        <div className="h-28 w-full" style={{ background: tileFor(caption) }} />
      )}
      <figcaption className="flex items-center gap-1.5 bg-black/30 px-2.5 py-2 text-[12.5px] text-white/75">
        {by && <Avatar person={by} size={16} />}
        <span className="truncate">{caption}</span>
      </figcaption>
    </figure>
  );
}

/**
 * **Voting on what everybody put in the vault.**
 *
 * The options here did not exist when the question was written — they are the
 * answers to another question. Rendered as tiles rather than as a list
 * because the whole point is that you are looking at each other's stuff, and
 * a radio list of captions loses that completely.
 *
 * Authors stay hidden while voting is open, so nobody votes for a friend.
 */
function VaultVoteBody({
  live,
  me,
  people,
  canAnswer,
  onRespond,
}: {
  live: LivePrompt;
  me: Participant | null;
  people: readonly Participant[];
  canAnswer: boolean;
  onRespond: (value: ResponseValue) => void;
}) {
  const mine = live.myResponse?.value;
  const everyoneVoted = live.responses.length >= live.tally.length;
  const sourceId = live.prompt.optionsFrom?.promptId ?? live.prompt.id;
  const top = Math.max(0, ...live.tally.map((t) => t.voters.length));

  return (
    <ul className="grid grid-cols-2 gap-2">
      {live.tally.map((option) => {
        const author = people.find((p) => p.id === option.optionId);
        const isMine = option.optionId === me?.id;
        const won = everyoneVoted && option.voters.length === top && top > 0;
        return (
          <li key={option.optionId}>
            <button
              type="button"
              disabled={!canAnswer || isMine}
              onClick={() => onRespond(option.optionId)}
              className={`w-full overflow-hidden rounded-xl border text-left transition ${
                mine === option.optionId
                  ? "border-white/60"
                  : won
                    ? "border-amber-300/60"
                    : "border-white/10 hover:border-white/35"
              } ${isMine ? "opacity-60" : ""}`}
            >
              {(() => {
                const image = getPhoto(photoKey(sourceId, option.optionId));
                return image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt={option.label}
                    className="h-28 w-full object-cover"
                  />
                ) : (
                  <span
                    className="block h-28 w-full"
                    style={{ background: tileFor(option.label) }}
                  />
                );
              })()}
              <span className="block bg-black/30 px-2.5 py-2">
                <span className="block truncate text-[12.5px] text-white/85">
                  {option.label}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-white/45">
                  {isMine
                    ? "yours"
                    : everyoneVoted && author
                      ? author.name
                      : "?"}
                  {option.voters.length > 0 && (
                    <span className="ml-auto tabular-nums">
                      {option.voters.length}
                    </span>
                  )}
                  {won && <span className="text-amber-200">🏆</span>}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

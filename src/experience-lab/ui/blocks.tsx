"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, Check, Copy, Plus, Repeat, Send, Trophy } from "lucide-react";
import {
  Avatar,
  AvatarRow,
  Pill,
  SectionHead,
  Surface,
  VoiceLine,
  personColor,
} from "./atoms";
import { grantAwards } from "../core/scoring";
import { shareStandings } from "../core/share";
import type { LiveExperience } from "../core/engine";
import type { Block, Moment, Participant, Prompt } from "../core/types";

/** Who is here, who hasn't shown up, and what they're like. */
export function RosterBlock({
  live,
  onBecome,
}: {
  live: LiveExperience;
  onBecome: (id: string) => void;
}) {
  const here = live.participants.filter((p) => p.present);
  const missing = live.participants.filter((p) => !p.present);
  return (
    <Surface>
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {here.map((person) => (
          <div key={person.id} className="flex items-center gap-2">
            <Avatar
              person={person}
              size={34}
              ring={person.id === live.me?.id}
            />
            <div className="leading-tight">
              <p className="text-[14px] font-medium text-white">
                {person.name}
                {person.id === live.definition.hostId && (
                  <span className="ml-1.5 text-[11px] text-white/40">host</span>
                )}
              </p>
              {person.vibe && (
                <p className="text-[12px] text-white/45">{person.vibe}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
          <span className="text-[12px] text-white/40">
            Invited, hasn&apos;t opened it:
          </span>
          {missing.map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => onBecome(person.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-white/20 px-2.5 py-1 text-[12px] text-white/55 transition hover:border-white/50 hover:text-white"
            >
              <Avatar person={person} size={18} dim />
              {person.name}
              <span className="text-white/30">— that&apos;s me</span>
            </button>
          ))}
        </div>
      )}
    </Surface>
  );
}

/**
 * Bragging rights. Rendered only when something is actually at stake — a
 * fixture with no scored prompts produces no rows, so this block silently
 * disappears rather than showing everyone on zero.
 */
export function LeaderboardBlock({ live }: { live: LiveExperience }) {
  const table = live.standings;
  if (table.length === 0) return null;
  const top = table[0].points;
  const anyPoints = top > 0;
  const awards =
    live.settled && anyPoints
      ? grantAwards(
          live.definition.awards,
          table,
          live.prompts.flatMap((p) => p.responses),
        )
      : [];

  return (
    <div className="flex flex-col gap-3">
      <Surface className="p-0">
        <ul>
          {table.map((row, index) => (
            <li
              key={row.participant.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                index > 0 ? "border-t border-white/[0.07]" : ""
              }`}
            >
              <span className="w-5 text-center text-[13px] font-semibold text-white/35 tabular-nums">
                {row.rank}
              </span>
              <Avatar
                person={row.participant}
                size={30}
                ring={row.participant.id === live.me?.id}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-white">
                  {row.participant.name}
                </span>
                {row.lines.length > 0 && (
                  <span className="block truncate text-[12px] text-white/45">
                    {row.lines.map((l) => l.note).join(" · ")}
                  </span>
                )}
              </span>
              <span
                className="text-[19px] font-bold tabular-nums"
                style={{ color: personColor(row.participant.hue) }}
              >
                {row.points}
              </span>
            </li>
          ))}
        </ul>
      </Surface>

      {!anyPoints && (
        <p className="text-[13px] text-white/40">
          Nothing has happened yet. Everyone is equally correct.
        </p>
      )}

      <ShareStandings live={live} />

      {awards.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {awards.map(({ award, participant, detail }) => (
            <div
              key={award.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-3.5"
            >
              <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
                <span className="text-lg">{award.emoji}</span>
                {award.label}
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-white/60">
                <Avatar person={participant} size={20} />
                {participant.name} — {detail}
              </p>
              <p className="mt-1 text-[12px] text-white/40">{award.blurb}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One tap turns the standings into something pasteable.
 *
 * The copy is shown, not hidden behind the button, because the whole value is
 * that a person can see it is funny before they decide to send it — and
 * because a share button whose output you cannot see is a share button nobody
 * presses twice.
 */
function ShareStandings({ live }: { live: LiveExperience }) {
  const [copied, setCopied] = useState(false);
  const text = shareStandings(live.definition, live.standings, live.settled);
  if (!text) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <pre className="font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-white/70">
        {text}
      </pre>
      <button
        type="button"
        onClick={() => {
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            void navigator.clipboard.writeText(text);
          }
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        }}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-black"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? "Copied — go and paste it" : "Copy for the group chat"}
      </button>
    </div>
  );
}

const QUICK_REACTIONS = ["😂", "🔥", "🙅", "❤️", "🚨"];

/**
 * The feed — and, read later, the memory. There is deliberately no separate
 * "recap data": the morning after renders the same list with the boring lines
 * filtered out.
 */
export function FeedBlock({
  live,
  onSay,
  onReact,
}: {
  live: LiveExperience;
  onSay: (text: string) => void;
  onReact: (
    momentId: string,
    emoji: string,
    seeded?: readonly string[],
  ) => void;
}) {
  const [draft, setDraft] = useState("");
  const person = (id?: string) =>
    id ? live.participants.find((p) => p.id === id) : undefined;

  return (
    <div className="flex flex-col gap-3">
      {live.me && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSay(draft);
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Say something to the group"
            className="min-w-0 flex-1 rounded-full border border-white/15 bg-black/20 px-4 py-2.5 text-[14px] text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-full bg-white px-4 text-black disabled:opacity-25"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      )}

      <ul className="flex flex-col gap-2.5">
        {live.moments.slice(0, 30).map((moment) => (
          <MomentRow
            key={moment.id}
            moment={moment}
            who={person(moment.by)}
            me={live.me}
            people={live.participants}
            onReact={onReact}
          />
        ))}
      </ul>
    </div>
  );
}

function MomentRow({
  moment,
  who,
  me,
  people,
  onReact,
}: {
  moment: Moment;
  who?: Participant;
  me: Participant | null;
  people: readonly Participant[];
  onReact: (
    momentId: string,
    emoji: string,
    seeded?: readonly string[],
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const reactions = Object.entries(moment.reactions ?? {}).filter(
    ([, ids]) => ids.length > 0,
  );

  if (moment.kind === "voice") {
    return (
      <li>
        <VoiceLine>{moment.text}</VoiceLine>
      </li>
    );
  }

  if (moment.kind === "join") {
    return (
      <li className="flex items-center gap-2 text-[13px] text-white/45">
        {who && <Avatar person={who} size={20} />}
        {who?.name} joined.
      </li>
    );
  }

  if (moment.kind === "result") {
    return (
      <li className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5">
        <span className="text-lg">{moment.emoji}</span>
        <span className="text-[14.5px] font-medium text-white">
          {moment.text}
        </span>
      </li>
    );
  }

  return (
    <li className="group flex gap-2.5">
      {who ? (
        <Avatar person={who} size={28} />
      ) : (
        <span className="w-7" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] leading-snug text-white/85">
          {who && (
            <span
              className="mr-1.5 font-semibold"
              style={{ color: personColor(who.hue) }}
            >
              {who.name}
            </span>
          )}
          {moment.kind === "photo" && (
            <span className="mr-1.5 inline-flex items-center gap-1 text-white/50">
              <Camera className="inline h-3.5 w-3.5" />
            </span>
          )}
          {moment.text}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {reactions.map(([emoji, ids]) => (
            <button
              key={emoji}
              type="button"
              disabled={!me}
              onClick={() => onReact(moment.id, emoji, ids)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] transition ${
                me && ids.includes(me.id)
                  ? "border-white/50 bg-white/10 text-white"
                  : "border-white/10 text-white/55 hover:border-white/30"
              }`}
            >
              {emoji}
              <span className="tabular-nums">{ids.length}</span>
            </button>
          ))}
          {me && (
            <>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="rounded-full border border-white/10 px-2 py-0.5 text-[12px] text-white/40 transition hover:border-white/30 hover:text-white/70"
                aria-label="React"
              >
                <Plus className="h-3 w-3" />
              </button>
              {open &&
                QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onReact(moment.id, emoji, moment.reactions?.[emoji]);
                      setOpen(false);
                    }}
                    className="rounded-full border border-white/15 px-2 py-0.5 text-[13px] transition hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
            </>
          )}
        </div>
        {reactions.length > 0 && (
          <span className="sr-only">
            {reactions
              .map(
                ([emoji, ids]) =>
                  `${emoji} ${ids
                    .map((id) => people.find((p) => p.id === id)?.name ?? id)
                    .join(", ")}`,
              )
              .join("; ")}
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * **The receipts.**
 *
 * What people owe each other because a side they personally picked lost.
 * Rendered as a promise rather than a punishment — the name is next to the
 * thing they agreed to, in their own words, and nobody appears here who did
 * not opt in.
 *
 * This turned out to be the most anticipated block in the prototype, and it
 * contains no points at all. Worth remembering when deciding how much scoring
 * anything needs.
 */
export function ObligationsBlock({ live }: { live: LiveExperience }) {
  if (live.obligations.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {live.obligations.map((obligation) => (
        <li
          key={`${obligation.promptId}-${obligation.participant.id}`}
          className="flex items-start gap-2.5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] px-4 py-3"
        >
          <Avatar person={obligation.participant} size={26} />
          <p className="text-[14.5px] leading-snug text-amber-50">
            <span className="font-semibold">{obligation.participant.name}</span>{" "}
            owes: {obligation.text}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Facts nobody in the group wrote. Today a fixture; tomorrow Atlas. */
export function PanelBlock({ block }: { block: Block }) {
  return (
    <Surface className="p-0">
      <ul>
        {(block.lines ?? []).map((line, index) => (
          <li
            key={line.label + line.value}
            className={`flex items-baseline gap-4 px-4 py-2.5 ${
              index > 0 ? "border-t border-white/[0.07]" : ""
            }`}
          >
            <span className="w-24 shrink-0 text-[12px] tracking-wide text-white/40 uppercase">
              {line.label}
            </span>
            <span
              className={`text-[14.5px] ${
                line.emphasis ? "font-semibold text-white" : "text-white/75"
              }`}
            >
              {line.value}
            </span>
          </li>
        ))}
      </ul>
    </Surface>
  );
}

/** The morning after. Same data, read as a keepsake. */
export function RecapBlock({ live }: { live: LiveExperience }) {
  const keepsakes = live.moments.filter((m) => m.keepsake);
  const results = live.moments.filter((m) => m.kind === "result");
  const champion = live.standings[0];
  const quotes = live.prompts
    .filter((p) => p.prompt.kind === "text" && p.prompt.reveal !== "never")
    .flatMap((p) => p.responses)
    .filter((r) => typeof r.value === "string" && r.value.trim());

  return (
    <div className="flex flex-col gap-3">
      {results.length > 0 && (
        <Surface>
          <p className="font-heading text-2xl font-semibold text-white">
            {/* Moments arrive newest-first, so the latest result is [0]. */}
            {results[0]?.text}
          </p>
        </Surface>
      )}

      {champion && champion.points > 0 && (
        <Surface>
          <p className="flex items-center gap-2.5">
            <Trophy className="h-5 w-5 text-amber-300" />
            <span className="text-[16px] font-semibold text-white">
              {champion.participant.name}
            </span>
            <span className="text-[14px] text-white/55">
              {champion.points} points
            </span>
          </p>
        </Surface>
      )}

      {keepsakes.length > 0 && (
        <Surface>
          <p className="mb-2 text-[12px] tracking-wide text-white/40 uppercase">
            What we kept
          </p>
          <ul className="flex flex-col gap-2">
            {keepsakes.map((m) => (
              <li key={m.id} className="text-[14.5px] text-white/80">
                <span className="mr-1.5">{m.emoji ?? "·"}</span>
                {m.text}
              </li>
            ))}
          </ul>
        </Surface>
      )}

      {quotes.length > 0 && (
        <Surface>
          <p className="mb-2 text-[12px] tracking-wide text-white/40 uppercase">
            In your own words
          </p>
          {quotes.map((q) => (
            <p
              key={q.participantId}
              className="text-[15px] text-white/80 italic"
            >
              &ldquo;{String(q.value)}&rdquo;
            </p>
          ))}
        </Surface>
      )}
    </div>
  );
}

/**
 * **Where a night becomes a tradition.**
 *
 * Round 1 shipped this as a button that did nothing and called it the highest
 * value unbuilt thing. It now goes somewhere real, and the interesting part is
 * what it carries: not points — carrying a score forward would make the second
 * night a continuation of the first — but *receipts*, derived from what
 * actually happened. Nobody wrote "Dave called 7–1 and has not been allowed to
 * forget it"; it is simply the worst surviving prediction, found.
 */
export function RunItBackBlock({
  live,
  receipts,
  nextSlug,
}: {
  live: LiveExperience;
  receipts: readonly string[];
  nextSlug: string;
}) {
  const champion = live.standings[0];
  const lineage = live.definition.lineage;
  return (
    <Surface>
      <p className="font-heading text-xl font-semibold text-white">
        {live.definition.emoji} Run it back?
      </p>
      {champion && champion.points > 0 && (
        <p className="mt-2 text-[14.5px] text-white/70">
          {champion.participant.name} goes into the next one as defending
          champion, which they will mention.
        </p>
      )}
      {receipts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-l-2 border-white/15 pl-3">
          {receipts.map((line) => (
            <li key={line} className="text-[13.5px] leading-snug text-white/60">
              {line}
            </li>
          ))}
        </ul>
      )}
      {lineage && (
        <p className="mt-3 text-[13px] text-white/45">
          {lineage.previousLabel} — {lineage.callback}
        </p>
      )}
      <div className="mt-4">
        <Link
          href={`/labs/experience/${nextSlug}`}
          className="inline-flex items-center rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-black"
        >
          <Repeat className="mr-1.5 inline h-3.5 w-3.5" />
          Start the next one
        </Link>
      </div>
      <p className="mt-2 text-[12px] text-white/30">
        Same people, a fortnight later, nothing decided — and everything above
        carried across.
      </p>
    </Surface>
  );
}

/**
 * A person inventing a question for the group.
 *
 * The single most valuable affordance found in the lab: the funniest thing on
 * the hockey page is always the one Passport did not write. Kept to one line
 * plus a shape, because anything longer is a form and nobody fills in a form
 * for a joke.
 */
export function AskSomething({
  cta,
  hint,
  phaseId,
  locksAtPhaseId,
  onAsk,
}: {
  cta: string;
  hint: string;
  phaseId: string;
  locksAtPhaseId?: string;
  onAsk: (prompt: Omit<Prompt, "id" | "askedBy">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [stakes, setStakes] = useState(5);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-white/20 px-4 py-3.5 text-left transition hover:border-white/45"
      >
        <span className="text-[15px] font-medium text-white">{cta}</span>
        <span className="mt-0.5 block text-[12.5px] text-white/45">{hint}</span>
      </button>
    );
  }

  return (
    <form
      className="rounded-2xl border border-white/25 bg-white/[0.05] p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!question.trim()) return;
        onAsk({
          question: question.trim(),
          kind: "boolean",
          phaseId,
          locksAtPhaseId,
          reveal: "onLock",
          scoring: { points: stakes, label: "Group question" },
        });
        setQuestion("");
        setOpen(false);
      }}
    >
      <input
        autoFocus
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        placeholder="Will Lorne buy a $19 arena beer?"
        className="w-full rounded-xl border border-white/15 bg-black/25 px-3.5 py-2.5 text-[15px] text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-white/45">Worth</span>
        {[2, 5, 10].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStakes(value)}
            className={`rounded-full border px-3 py-1 text-[12.5px] transition ${
              stakes === value
                ? "border-white/60 bg-white/10 text-white"
                : "border-white/15 text-white/50"
            }`}
          >
            +{value}
          </button>
        ))}
        <Pill>Yes / no</Pill>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[13px] text-white/45"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!question.trim()}
          className="rounded-full bg-white px-4 py-1.5 text-[13px] font-semibold text-black disabled:opacity-30"
        >
          Ask it
        </button>
      </div>
    </form>
  );
}

export { SectionHead, AvatarRow };

"use client";

import { Sparkles, Trophy } from "lucide-react";
import {
  LeaderboardBlock,
  ObligationsBlock,
  RecapBlock,
} from "@/experience-lab/ui/blocks";
import { PromptCard } from "@/experience-lab/ui/PromptCard";
import { PromptDeck } from "@/experience-lab/ui/PromptDeck";
import type { LivePrompt } from "@/experience-lab/core/engine";
import type { Block } from "@/experience-lab/core/types";
import { actOf } from "@/domain/hockey/acts";
import { clockAt } from "@/domain/hockey/countdown";
import type { GameView } from "@/app/hockey/_server/game";
import { CallIt } from "./CallIt";
import { Memories } from "./Memories";
import { PicksDeck } from "./PicksDeck";
import { RevealBoard } from "./RevealBoard";
import { LastTime } from "./RunItBack";
import type { SharedNight } from "./useSharedNight";
import styles from "./hockey.module.css";

/** A block's questions, as the old page chose them — including ones people asked. */
export function promptsOf(
  block: Block,
  prompts: readonly LivePrompt[],
  phaseId: string,
): LivePrompt[] {
  return prompts.filter(
    (p) =>
      block.promptIds?.some(
        (id) => id === p.prompt.id || p.prompt.id.startsWith(`${id}::`),
      ) ||
      (block.inviteOwnPrompt &&
        p.prompt.askedBy &&
        /^(ask|toy)-/.test(p.prompt.id) &&
        p.prompt.phaseId === phaseId),
  );
}

/** When a phase begins, as a clock time ("7:00 p.m."), or nothing. */
function lockClock(
  definition: {
    anchorAt: string;
    phases: readonly { id: string; offsetMinutes: number }[];
  },
  phaseId: string | undefined,
): string | undefined {
  const phase = definition.phases.find((p) => p.id === phaseId);
  return phase
    ? clockAt(new Date(definition.anchorAt), phase.offsetMinutes)
    : undefined;
}

/**
 * **Play: the competition, and what it left behind.**
 *
 * Before puck drop, the sealed picks as a deck. Once they lock, the same
 * picks face down to turn over. In an intermission, the one stupid thing.
 * After, the receipts first — the lab's "most anticipated block" — then the
 * Cup, then the recap.
 */
export function PlayTab({
  night,
  blocks,
  onOpenToyBox,
  nhl,
}: {
  night: SharedNight;
  blocks: readonly Block[];
  onOpenToyBox: () => void;
  nhl?: GameView | null;
}) {
  const { live, definition } = night;
  const act = actOf(live.phase.id).id;

  // Every sealed pick on this night: the template's and the ones people asked
  // before the game. After lock the picks block leaves the page, but the
  // picks themselves are what the reveal is made of.
  const picksBlock = definition.blocks.find((b) => b.id === "picks");
  const picks = picksBlock
    ? promptsOf(picksBlock, live.prompts, "before").filter(
        (p) => p.prompt.reveal === "onLock" || p.prompt.scoring,
      )
    : [];
  const revealed = picks.filter((p) => p.locked && p.responses.length > 0);

  return (
    <div className="flex flex-col gap-10">
      {act === "before" && night.series && (
        <LastTime series={night.series} live={live} className="" />
      )}

      <CallIt night={night} nhl={nhl} />

      {act === "after" && <Memories night={night} />}

      {blocks.map((block) => {
        if (block.kind === "leaderboard") {
          return (
            <section key={block.id} aria-labelledby={`${block.id}-title`}>
              <h2
                id={`${block.id}-title`}
                className={`${styles.wide} flex items-center gap-2 text-[28px] leading-none text-white`}
              >
                <Trophy className="h-6 w-6 text-[#ffd84d]" />
                {block.title}
              </h2>
              {block.subtitle && (
                <p className="mt-2 text-[15px] text-white/70">
                  {block.subtitle}
                </p>
              )}
              <div className="mt-4">
                <ObligationsBlock live={live} />
              </div>
              <div className="mt-3">
                <LeaderboardBlock live={live} />
              </div>
            </section>
          );
        }

        if (block.kind === "recap") {
          return (
            <section key={block.id} aria-labelledby={`${block.id}-title`}>
              <h2
                id={`${block.id}-title`}
                className={`${styles.wide} text-[28px] leading-none text-white`}
              >
                {block.title}
              </h2>
              <div className="mt-4">
                <RecapBlock live={live} />
              </div>
            </section>
          );
        }

        if (block.kind !== "promptGroup") return null;
        const prompts = promptsOf(block, live.prompts, live.phase.id);
        if (prompts.length === 0 && !block.inviteOwnPrompt) return null;

        const askOwn = block.inviteOwnPrompt &&
          live.me &&
          prompts.some((p) => p.open) && (
            <button
              type="button"
              onClick={onOpenToyBox}
              className="mt-4 w-full rounded-[22px] border-2 border-dashed border-white/25 px-5 py-4 text-left transition hover:border-white/50"
            >
              <span className="flex items-center gap-2 text-[17px] font-bold text-white">
                <Sparkles className="h-5 w-5 text-[#ffd84d]" />
                {block.inviteOwnPrompt.cta}
              </span>
              <span className="mt-1 block text-[14px] text-white/65">
                {block.inviteOwnPrompt.hint}
              </span>
            </button>
          );

        if (block.id === "picks") {
          return (
            <div key={block.id}>
              {prompts.length > 0 && (
                <PicksDeck
                  night={night}
                  prompts={prompts}
                  title={block.title ?? "Your picks"}
                  subtitle={block.subtitle}
                  lockLabel={lockClock(
                    definition,
                    prompts[0]?.prompt.locksAtPhaseId,
                  )}
                />
              )}
              {prompts.length === 0 && (
                <h2
                  className={`${styles.wide} text-[28px] leading-none text-white`}
                >
                  {block.title}
                </h2>
              )}
              {askOwn}
            </div>
          );
        }

        // Intermission games and anything else the phase brings: the lab's
        // own cards, so missions, the vault and consent behave as they do.
        const isDeck = block.present === "deck" && prompts.length > 2;
        return (
          <section key={block.id} aria-labelledby={`${block.id}-title`}>
            <h2
              id={`${block.id}-title`}
              className={`${styles.wide} text-[28px] leading-none text-white`}
            >
              {block.title}
            </h2>
            {block.subtitle && (
              <p className="mt-2 text-[15px] text-white/70">{block.subtitle}</p>
            )}
            <div className="mt-4 flex flex-col gap-3">
              {isDeck ? (
                <PromptDeck
                  prompts={prompts}
                  me={live.me}
                  people={live.participants}
                  onRespond={night.respond}
                  onAddOption={night.addOption}
                  onCue={night.cue}
                  onConsent={night.consent}
                />
              ) : (
                prompts.map((prompt) => (
                  <PromptCard
                    key={prompt.prompt.id}
                    live={prompt}
                    me={live.me}
                    people={live.participants}
                    onRespond={(value) =>
                      night.respond(prompt.prompt.id, value)
                    }
                    onAddOption={(label, detail) =>
                      night.addOption(prompt.prompt.id, label, detail)
                    }
                    onCue={night.cue}
                    onConsent={night.consent}
                  />
                ))
              )}
            </div>
            {askOwn}
          </section>
        );
      })}

      {act !== "before" && revealed.length > 0 && (
        <RevealBoard
          prompts={revealed}
          people={live.participants}
          morning={live.phase.id === "morning" || live.phase.id === "again"}
        />
      )}

      {act !== "after" && <Memories night={night} />}

      {act === "before" && picks.length === 0 && blocks.length === 0 && (
        <p className="rounded-2xl bg-white/[0.06] px-4 py-4 text-[15px] text-white/75">
          The host left the games out of this one. Plenty to argue about in
          Plan.
        </p>
      )}
    </div>
  );
}

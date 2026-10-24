"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { ObligationsBlock, RecapBlock } from "@/experience-lab/ui/blocks";
import { PromptCard } from "@/experience-lab/ui/PromptCard";
import { PromptDeck } from "@/experience-lab/ui/PromptDeck";
import type { LivePrompt } from "@/experience-lab/core/engine";
import type { Block } from "@/experience-lab/core/types";
import { actOf } from "@/domain/hockey/acts";
import { clockAt } from "@/domain/hockey/countdown";
import { spectacularlyWrong } from "@/domain/hockey/cup";
import type { Side } from "@/domain/hockey/challenges";
import { matchupOf, teamColours } from "@/domain/hockey/teams";
import type { GameView } from "@/app/hockey/_server/game";
import { CallIt } from "./CallIt";
import { Memories } from "./Memories";
import { RecapShare } from "./RecapShare";
import { RevealBoard } from "./RevealBoard";
import { LastTime } from "./RunItBack";
import { BoldCalls } from "./play/BoldCalls";
import { Chaos } from "./play/Chaos";
import { CupBoard } from "./play/CupBoard";
import { Drama } from "./play/Drama";
import { Missions } from "./play/Missions";
import { RivalryHero } from "./play/RivalryHero";
import { ThrowDown, type Draft } from "./play/ThrowDown";
import { usePlay } from "./play/usePlay";
import { FanAvatar } from "./FanTag";
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
        p.prompt.phaseId === phaseId &&
        // Missions and dares have their own place (`Missions`).
        p.prompt.family !== "mission" &&
        p.prompt.family !== "dare"),
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
 * **Play: the night's competition, and the people in it.**
 *
 * Not a questionnaire. Before the game it opens on what tonight's
 * allegiances add up to (a Flames fan at a Canucks game is *enemy
 * territory*), then hands you somebody to challenge, then the sealed picks
 * as game cards, then the Sycle Cup and what everybody else has been up to.
 * During the game: what needs you, the standings, the picks turned over.
 * After: the champion — only once every point is settled — the receipts,
 * the spectacularly wrong, and the recap.
 */
export function PlayTab({
  night,
  blocks,
  onOpenToyBox,
  onPickTeam,
  onOpenChat,
  nhl,
}: {
  night: SharedNight;
  blocks: readonly Block[];
  onOpenToyBox: () => void;
  onPickTeam?: () => void;
  onOpenChat?: () => void;
  nhl?: GameView | null;
}) {
  const { live, definition, state, play: room, chirp } = night;
  const act = actOf(live.phase.id).id;
  const play = usePlay(night);
  const [draft, setDraft] = useState<Draft | null>(null);
  const me = live.me;
  const { home, away } = matchupOf(definition.subtitle);

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
  const wrong = act === "after" ? spectacularlyWrong(live) : null;
  const games = night.modules.includes("games");

  const challengeActs = {
    answer: night.answerChallenge,
    perform: night.performChallenge,
    vote: night.voteChallenge,
  };
  const betDraft = (side?: Side, targetId?: string): Draft => ({
    kind: "bet",
    market: "winner",
    side,
    targetId,
  });

  const hero = me && play.rivalry && act === "before" && (
    <RivalryHero
      rivalry={play.rivalry}
      me={me}
      people={live.participants}
      homeColour={teamColours(home).primary}
      awayColour={teamColours(away).primary}
      myTeamDeclared={Boolean(chirp.fans[me.id]) || !chirp.available}
      onPickTeam={onPickTeam}
      onChallenge={
        play.on ? (id) => setDraft({ kind: "defend", targetId: id }) : undefined
      }
      onDefend={
        play.on && play.beforeHorn
          ? () => setDraft({ kind: "defend", targetId: me.id })
          : undefined
      }
      onBet={
        play.on && play.beforeStart ? () => setDraft(betDraft()) : undefined
      }
    />
  );

  const needs = me && play.on && (
    <Chaos
      part="needs"
      me={me.id}
      people={live.participants}
      fans={play.fans}
      game={play.game}
      now={live.now}
      settled={play.settled}
      cards={[]}
      act={challengeActs}
      beforeHorn={play.beforeHorn}
      onDraft={setDraft}
    />
  );

  const chaos = me && play.on && (
    <Chaos
      part="rest"
      me={me.id}
      people={live.participants}
      fans={play.fans}
      game={play.game}
      now={live.now}
      settled={play.settled}
      cards={play.chaos}
      act={challengeActs}
      beforeHorn={play.beforeHorn}
      onDraft={setDraft}
    />
  );

  const cup = (
    <div className="flex flex-col gap-3">
      <CupBoard
        live={live}
        status={play.status}
        settled={play.settled}
        reactions={room.teamReactions}
        onReact={play.on ? night.reactTeam : undefined}
        available={play.on}
      />
      {/* Forfeits people opted into and lost: the receipts. */}
      {act !== "before" && <ObligationsBlock live={live} />}
    </div>
  );

  const drama = (
    <Drama
      items={play.drama}
      bot={chirp.on ? chirp.lines : []}
      people={live.participants}
      slug={state.slug}
      now={live.now}
      onOpenChat={onOpenChat}
      max={act === "before" ? 14 : 6}
    />
  );

  const missions = games && (
    <Missions
      night={night}
      ledger={room.ledger}
      onSlip={me && play.beforeHorn ? onOpenToyBox : undefined}
    />
  );

  const promptBlocks = blocks.map((block) => {
    if (block.kind === "leaderboard") return null; // the CupBoard is the leaderboard
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
      me &&
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
            <BoldCalls
              night={night}
              prompts={prompts}
              lockLabel={lockClock(
                definition,
                prompts[0]?.prompt.locksAtPhaseId,
              )}
              sealedPicks={night.modules.includes("picks")}
              onBet={
                play.on && play.beforeStart && live.participants.length > 1
                  ? (side) => setDraft(betDraft(side))
                  : undefined
              }
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

    // Intermission games and anything else the phase brings: the lab's own
    // cards, so the vault and consent behave as they do.
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
                onRespond={(value) => night.respond(prompt.prompt.id, value)}
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
  });

  return (
    <div className="flex flex-col gap-10">
      {act === "after" && cup}
      {wrong && (
        <section
          aria-label="Spectacularly wrong"
          className={`${styles.gamecard} rounded-[24px] p-4 ring-1 ring-white/12`}
          style={{ ["--tone" as string]: "#c8102e" }}
        >
          <p className="text-[12px] font-extrabold tracking-[0.18em] text-[#ffd84d] uppercase">
            🤡 Spectacularly wrong
          </p>
          <div className="mt-2 flex items-center gap-3">
            <FanAvatar person={wrong.participant} size={44} />
            <p className="text-[16px] leading-snug text-white">
              <span className="font-extrabold">{wrong.participant.name}</span>{" "}
              called it{" "}
              <span className={`${styles.display} text-[22px]`}>
                {wrong.pick}
              </span>
              . It finished{" "}
              <span className={`${styles.display} text-[22px]`}>
                {wrong.actual}
              </span>
              . Frame it.
            </p>
          </div>
        </section>
      )}

      {needs}

      {hero}

      <CallIt night={night} nhl={nhl} />

      {act !== "after" && chaos}

      {act === "before" && night.series && (
        <LastTime series={night.series} live={live} className="" />
      )}

      {promptBlocks}

      {act !== "after" && cup}

      {act !== "before" && revealed.length > 0 && (
        <RevealBoard
          prompts={revealed}
          people={live.participants}
          morning={live.phase.id === "morning" || live.phase.id === "again"}
        />
      )}

      {missions}

      {act === "after" && chaos}

      {drama}

      {act === "after" && <Memories night={night} />}
      {act === "after" && <RecapShare night={night} nhl={nhl} />}
      {act !== "after" && <Memories night={night} />}

      {act === "before" &&
        picks.length === 0 &&
        blocks.length === 0 &&
        !play.on && (
          <p className="rounded-2xl bg-white/[0.06] px-4 py-4 text-[15px] text-white/75">
            The host left the games out of this one. Plenty to argue about in
            Plan.
          </p>
        )}

      {draft && me && (
        <ThrowDown
          draft={draft}
          me={me}
          people={live.participants}
          fans={play.fans}
          game={play.game}
          promptIds={definition.prompts.map((p) => p.id)}
          beforeStart={play.beforeStart}
          error={night.error}
          onSend={async (input) => {
            night.clearError();
            return night.issueChallenge(input);
          }}
          onClose={() => {
            night.clearError();
            setDraft(null);
          }}
        />
      )}
    </div>
  );
}

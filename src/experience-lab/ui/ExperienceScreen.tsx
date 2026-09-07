"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Share2, Sparkles } from "lucide-react";
import { SectionHead, VoiceLine } from "./atoms";
import {
  FeedBlock,
  ObligationsBlock,
  LeaderboardBlock,
  PanelBlock,
  RecapBlock,
  RosterBlock,
  RunItBackBlock,
} from "./blocks";
import { nextEditionSlug, receiptsFrom } from "../core/lineage";
import { CuratorSetup, MyLimit } from "./CuratorSetup";
import { InheritedMemory } from "./InheritedMemory";
import { JoinGate } from "./JoinGate";
import { PromptDeck } from "./PromptDeck";
import { QuietMode } from "./QuietMode";
import { ToyBox } from "./ToyBox";
import { Poster } from "./Poster";
import { PromptCard } from "./PromptCard";
import { TimeMachine } from "./TimeMachine";
import { useExperienceLab } from "./useExperienceLab";
import type { LivePrompt } from "../core/engine";
import type { ExperienceDefinition, Participant } from "../core/types";

/**
 * The whole page.
 *
 * Note what is *not* here: no tabs, no settings, no "manage this experience",
 * no admin view for the host. The host's page and a guest's page are the same
 * page — the only difference is that the host's name is on the invite. An
 * experience nobody has to administer was the design constraint, and every
 * time the prototype grew a management affordance it immediately started
 * feeling like software instead of a night out.
 *
 * The page is composed from `definition.blocks`, filtered by the active
 * phase. That means "what this page is" genuinely changes over the lifecycle
 * rather than sections greying out — the morning after is not the same page
 * with a banner, it is a different page built from the same material.
 */
/**
 * How far through a set of questions you are.
 *
 * Replaces the per-card "4 in, hidden" that used to sit under every question:
 * progress is a property of the group's turn at the whole thing, and saying it
 * once turns seven sealed cards from a form back into a run of questions.
 */
function GroupProgress({
  prompts,
  me,
  lockLabel,
}: {
  prompts: readonly LivePrompt[];
  me: Participant | null;
  lockLabel?: string;
}) {
  if (!me || prompts.length < 3) return null;
  const mine = prompts.filter((p) => p.myResponse !== undefined).length;
  const open = prompts.some((p) => p.open);
  return (
    <p className="mb-3 flex flex-wrap items-center gap-x-2 text-[13px] text-white/50">
      <span className="font-semibold text-white/80">
        {mine} of {prompts.length} in
      </span>
      {open && lockLabel && <span>· they lock at {lockLabel}</span>}
      {!open && <span>· locked</span>}
    </p>
  );
}

export function ExperienceScreen({
  definition,
  previous,
}: {
  definition: ExperienceDefinition;
  /** Set only on a second edition — the experience this one inherits from. */
  previous?: ExperienceDefinition;
}) {
  const lab = useExperienceLab(definition);
  const { live, hydrated } = lab;
  const [toyBoxOpen, setToyBoxOpen] = useState(false);

  const showJoin = hydrated && !live.me && !lab.state.lurking;
  /**
   * The setup belongs to whoever made the thing, once, before anything has
   * happened. Everybody else never sees it — the curator model is a product
   * hypothesis about *authoring*, not a permission system, so nothing else on
   * the page behaves differently for the host.
   */
  const showSetup =
    hydrated &&
    !showJoin &&
    live.me?.id === definition.hostId &&
    lab.state.brief === null &&
    live.phaseNumber === 0;

  const nextPhaseId = definition.phases[live.phaseNumber + 1]?.id;

  /**
   * What this edition would hand to the next one. Derived from what actually
   * happened here rather than authored, which is what makes it read as a
   * callback instead of a slogan.
   */
  const receipts = hydrated
    ? (receiptsFrom(definition, lab.state, live.now)?.receipts ?? [])
    : [];

  return (
    <main className="min-h-dvh bg-[oklch(0.14_0.015_260)] pb-28 text-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-5 pt-4">
        <Link
          href="/labs/experience"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-white/45 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Experience Lab
        </Link>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-white/45 transition hover:text-white"
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              void navigator.clipboard.writeText(window.location.href);
            }
          }}
        >
          <Share2 className="h-3.5 w-3.5" />
          Copy link
        </button>
      </div>

      <Poster definition={definition} live={hydrated ? live : null} />

      {!hydrated && (
        <div className="mx-auto max-w-2xl px-5">
          <div className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
        </div>
      )}

      {hydrated && previous && (
        <InheritedMemory previous={previous} now={live.now} />
      )}

      {hydrated && showJoin && (
        <JoinGate
          definition={definition}
          participants={live.participants}
          onJoin={lab.join}
          onLurk={lab.lurk}
        />
      )}

      {hydrated && showSetup && (
        <CuratorSetup
          title={definition.title}
          onDone={lab.setBrief}
          onSkip={() =>
            lab.setBrief({
              audience: "Unspecified",
              vibe: "Social",
              edge: 1,
              appetite: "some",
            })
          }
        />
      )}

      {/* The real thing is happening. Passport gets out of the way entirely —
          not a collapsed page, a different one. */}
      {hydrated && !showSetup && live.attention === "quiet" && (
        <QuietMode live={live} />
      )}

      {hydrated && !showSetup && live.attention !== "quiet" && (
        <div className="mx-auto flex max-w-2xl flex-col gap-8 px-5 pt-2">
          {live.commentary.length > 0 && (
            <div className="flex flex-col gap-2">
              {live.commentary.map((line) => (
                <VoiceLine key={line}>{line}</VoiceLine>
              ))}
            </div>
          )}

          {live.blocks.map((block) => {
            if (block.kind === "roster") {
              return (
                <section key={block.id}>
                  <SectionHead title={block.title} subtitle={block.subtitle} />
                  <RosterBlock live={live} onBecome={lab.join} />
                </section>
              );
            }

            if (block.kind === "panel") {
              return (
                <section key={block.id}>
                  <SectionHead title={block.title} subtitle={block.subtitle} />
                  <PanelBlock block={block} />
                </section>
              );
            }

            if (block.kind === "leaderboard") {
              return (
                <section key={block.id}>
                  <SectionHead title={block.title} subtitle={block.subtitle} />
                  <ObligationsBlock live={live} />
                  <div className="mt-3">
                    <LeaderboardBlock live={live} />
                  </div>
                </section>
              );
            }

            if (block.kind === "feed") {
              return (
                <section key={block.id}>
                  <SectionHead title={block.title} subtitle={block.subtitle} />
                  <FeedBlock live={live} onSay={lab.say} onReact={lab.react} />
                </section>
              );
            }

            if (block.kind === "recap") {
              return (
                <section key={block.id}>
                  <SectionHead title={block.title} subtitle={block.subtitle} />
                  <RecapBlock live={live} />
                </section>
              );
            }

            if (block.kind === "runItBack") {
              return (
                <section key={block.id}>
                  <RunItBackBlock
                    live={live}
                    receipts={receipts}
                    nextSlug={nextEditionSlug(definition.slug)}
                  />
                </section>
              );
            }

            const prompts = live.prompts.filter(
              (p) =>
                // A question built from other people's answers multiplies into
                // ids like `story-guess::sarah`, so a block claims a family of
                // derived questions by naming the one it was written as.
                block.promptIds?.some(
                  (id) =>
                    id === p.prompt.id || p.prompt.id.startsWith(`${id}::`),
                ) ||
                // Anything the group made lands in the group that invited it.
                (block.inviteOwnPrompt &&
                  p.prompt.askedBy &&
                  /^(ask|toy)-/.test(p.prompt.id) &&
                  p.prompt.phaseId === live.phase.id),
            );
            if (prompts.length === 0 && !block.inviteOwnPrompt) return null;
            const isDeck = block.present === "deck" && prompts.length > 2;

            return (
              <section key={block.id}>
                <SectionHead title={block.title} subtitle={block.subtitle} />
                {/* A deck carries its own progress bar and counter; showing
                    both said the same thing twice. */}
                {!isDeck && (
                  <GroupProgress
                    prompts={prompts}
                    me={live.me}
                    lockLabel={
                      definition.phases.find(
                        (p) => p.id === prompts[0]?.prompt.locksAtPhaseId,
                      )?.label
                    }
                  />
                )}
                <div className="flex flex-col gap-3">
                  {isDeck ? (
                    <PromptDeck
                      prompts={prompts}
                      me={live.me}
                      people={live.participants}
                      onRespond={lab.respond}
                      onAddOption={lab.addOption}
                      onCue={lab.cue}
                      onConsent={lab.consent}
                    />
                  ) : (
                    prompts.map((prompt) => (
                      <PromptCard
                        key={prompt.prompt.id}
                        live={prompt}
                        me={live.me}
                        people={live.participants}
                        onRespond={(value) =>
                          lab.respond(prompt.prompt.id, value)
                        }
                        onAddOption={(label, detail) =>
                          lab.addOption(prompt.prompt.id, label, detail)
                        }
                        onCue={lab.cue}
                        onConsent={lab.consent}
                      />
                    ))
                  )}
                  {block.inviteOwnPrompt &&
                    live.me &&
                    prompts.some((p) => p.open) && (
                      <button
                        type="button"
                        onClick={() => setToyBoxOpen(true)}
                        className="w-full rounded-2xl border border-dashed border-white/20 px-4 py-3.5 text-left transition hover:border-white/45"
                      >
                        <span className="flex items-center gap-1.5 text-[15px] font-medium text-white">
                          <Sparkles className="h-4 w-4" />
                          {block.inviteOwnPrompt.cta}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] text-white/45">
                          {block.inviteOwnPrompt.hint}
                        </span>
                      </button>
                    )}
                </div>
              </section>
            );
          })}

          {live.me && (
            <MyLimit
              nightEdge={lab.state.brief?.edge ?? 1}
              mine={lab.state.myEdge}
              onChange={lab.setMyEdge}
            />
          )}

          <p className="pt-4 pb-2 text-[11.5px] leading-relaxed text-white/25">
            Experience Lab prototype. Everyone but you is a fixture, everything
            is invented, and nothing leaves this browser. {definition.labNote}
          </p>
        </div>
      )}

      {hydrated && toyBoxOpen && live.me && (
        <ToyBox
          definition={definition}
          edge={live.edge}
          appetite={lab.state.brief?.appetite ?? "some"}
          people={live.participants}
          me={live.me}
          phaseId={live.phase.id}
          lockPhaseId={nextPhaseId}
          onAdd={lab.addToy}
          onClose={() => setToyBoxOpen(false)}
        />
      )}

      {hydrated && (
        <TimeMachine
          live={live}
          onSetNow={lab.setNow}
          onBecome={lab.becomeSomeoneElse}
          onReset={lab.reset}
        />
      )}
    </main>
  );
}

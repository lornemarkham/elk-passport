"use client";

import Link from "next/link";
import { ArrowLeft, Share2 } from "lucide-react";
import { SectionHead, VoiceLine } from "./atoms";
import {
  AskSomething,
  FeedBlock,
  LeaderboardBlock,
  PanelBlock,
  RecapBlock,
  RosterBlock,
  RunItBackBlock,
} from "./blocks";
import { JoinGate } from "./JoinGate";
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
}: {
  definition: ExperienceDefinition;
}) {
  const lab = useExperienceLab(definition);
  const { live, hydrated } = lab;
  const showJoin = hydrated && !live.me && !lab.state.lurking;

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

      {hydrated && showJoin && (
        <JoinGate
          definition={definition}
          participants={live.participants}
          onJoin={lab.join}
          onLurk={lab.lurk}
        />
      )}

      {hydrated && (
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
                  <LeaderboardBlock live={live} />
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
                  <RunItBackBlock live={live} />
                </section>
              );
            }

            const prompts = live.prompts.filter(
              (p) =>
                block.promptIds?.includes(p.prompt.id) ||
                // Questions the group invented land in the group that invited them.
                (block.inviteOwnPrompt &&
                  p.prompt.askedBy &&
                  p.prompt.id.startsWith("ask-") &&
                  p.prompt.phaseId === live.phase.id),
            );
            if (prompts.length === 0 && !block.inviteOwnPrompt) return null;

            return (
              <section key={block.id}>
                <SectionHead title={block.title} subtitle={block.subtitle} />
                <GroupProgress
                  prompts={prompts}
                  me={live.me}
                  lockLabel={
                    definition.phases.find(
                      (p) => p.id === prompts[0]?.prompt.locksAtPhaseId,
                    )?.label
                  }
                />
                <div className="flex flex-col gap-3">
                  {prompts.map((prompt) => (
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
                    />
                  ))}
                  {block.inviteOwnPrompt &&
                    live.me &&
                    prompts.some((p) => p.open) && (
                      <AskSomething
                        cta={block.inviteOwnPrompt.cta}
                        hint={block.inviteOwnPrompt.hint}
                        phaseId={live.phase.id}
                        locksAtPhaseId={
                          definition.phases[live.phaseNumber + 1]?.id
                        }
                        onAsk={lab.addPrompt}
                      />
                    )}
                </div>
              </section>
            );
          })}

          <p className="pt-4 pb-2 text-[11.5px] leading-relaxed text-white/25">
            Experience Lab prototype. Everyone but you is a fixture, everything
            is invented, and nothing leaves this browser. {definition.labNote}
          </p>
        </div>
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

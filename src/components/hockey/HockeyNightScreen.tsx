"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lock, Sparkles } from "lucide-react";
import { SectionHead, VoiceLine } from "@/experience-lab/ui/atoms";
import {
  FeedBlock,
  LeaderboardBlock,
  ObligationsBlock,
  PanelBlock,
  RecapBlock,
  RosterBlock,
} from "@/experience-lab/ui/blocks";
import { CuratorSetup, MyLimit } from "@/experience-lab/ui/CuratorSetup";
import { Poster } from "@/experience-lab/ui/Poster";
import { PromptCard } from "@/experience-lab/ui/PromptCard";
import { PromptDeck } from "@/experience-lab/ui/PromptDeck";
import { QuietMode } from "@/experience-lab/ui/QuietMode";
import { ToyBox } from "@/experience-lab/ui/ToyBox";
import type { LivePrompt } from "@/experience-lab/core/engine";
import type { Participant } from "@/experience-lab/core/types";
import { actOf } from "@/domain/hockey/acts";
import { nextGameAfter } from "@/domain/hockey/schedule";
import { CallIt } from "./CallIt";
import { GuestList } from "./GuestList";
import { NearbyPicker } from "./NearbyPicker";
import { LastTime, RunItBack } from "./RunItBack";
import { RunningOrder } from "./RunningOrder";
import { YouTonight } from "./YouTonight";
import { useSharedNight, type NightSnapshot } from "./useSharedNight";

/**
 * **Sycle Hockey Night — the shared one.**
 *
 * This is the Experience Lab's `ExperienceScreen` with its blocks, order,
 * components and voice intact, and three lab-only things replaced by real
 * ones:
 *
 * - **Who you are** is your Passport account, not a name you tap. There is no
 *   join gate and no "become someone else".
 * - **The time machine** is gone. The page runs on the real clock, because the
 *   real game is on the real clock.
 * - **"Everyone but you is a fixture"** is gone, because nobody is.
 *
 * And it gains the two things the lab deliberately refused to have until there
 * were real people: a guest list the host manages, and a host who calls the
 * results. Both sit at the bottom, below the night, so the page still reads as
 * a night out rather than as software.
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

export function HockeyNightScreen({ initial }: { initial: NightSnapshot }) {
  const night = useSharedNight(initial);
  const { live, definition, state, role } = night;
  const [toyBoxOpen, setToyBoxOpen] = useState(false);

  const showSetup =
    role === "host" && state.brief === null && live.phaseNumber === 0;
  const nextPhaseId = definition.phases[live.phaseNumber + 1]?.id;

  return (
    <main className="min-h-dvh bg-[oklch(0.14_0.015_260)] pb-28 text-white">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-5 pt-4">
        <Link
          href="/hockey"
          className="inline-flex min-h-10 items-center gap-1.5 text-[12.5px] text-white/45 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Your nights
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-white/45">
          <Lock className="h-3.5 w-3.5" />
          Invite only
        </span>
      </div>

      <Poster definition={definition} live={live} />

      {live.attention !== "quiet" && <RunningOrder live={live} />}

      {!showSetup &&
        live.attention !== "quiet" &&
        night.series &&
        actOf(live.phase.id).id === "before" && (
          <LastTime series={night.series} live={live} />
        )}

      {showSetup && (
        <CuratorSetup
          title={definition.title}
          onDone={night.setBrief}
          onSkip={() =>
            night.setBrief({
              audience: "Coworkers",
              vibe: "Social",
              edge: 1,
              appetite: "some",
            })
          }
        />
      )}

      {!showSetup && live.attention === "quiet" && <QuietMode live={live} />}

      {!showSetup && live.attention !== "quiet" && (
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
                  <RosterBlock live={live} onBecome={() => {}} />
                  {live.participants.length === 1 && (
                    <p className="mt-2 text-[13px] text-white/45">
                      {role === "host"
                        ? "Just you so far. A hockey night for one is a Tuesday. Invite somebody below."
                        : "Just you so far."}
                    </p>
                  )}
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
                  <FeedBlock
                    live={live}
                    onSay={night.say}
                    onReact={night.react}
                  />
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
              // Polls never carry the series; the page always does. Without
              // it there is nothing honest to offer, so offer nothing.
              if (!night.series) return null;
              return (
                <section key={block.id} aria-label="Run it back">
                  <RunItBack
                    live={live}
                    series={night.series}
                    suggestion={nextGameAfter(definition.anchorAt)}
                  />
                </section>
              );
            }

            const prompts = live.prompts.filter(
              (p) =>
                block.promptIds?.some(
                  (id) =>
                    id === p.prompt.id || p.prompt.id.startsWith(`${id}::`),
                ) ||
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
                  {live.me &&
                    prompts.some(
                      (p) => p.prompt.id === "pregame-spot" && p.open,
                    ) && <NearbyPicker night={night} promptId="pregame-spot" />}
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

          <CallIt night={night} />

          {live.me && (
            <MyLimit
              nightEdge={state.brief?.edge ?? 1}
              mine={state.myEdge}
              onChange={night.setMyEdge}
            />
          )}

          <YouTonight night={night} />

          {role === "host" && <GuestList night={night} />}

          <p className="pt-4 pb-2 text-[11.5px] leading-relaxed text-white/30">
            Private to the people on this page. Points are bragging rights only
            — no money, no bets, nothing to settle but your dignity.
          </p>
        </div>
      )}

      {toyBoxOpen && live.me && (
        <ToyBox
          definition={definition}
          edge={live.edge}
          appetite={state.brief?.appetite ?? "some"}
          people={live.participants}
          me={live.me}
          phaseId={live.phase.id}
          lockPhaseId={nextPhaseId}
          onAdd={night.addToy}
          onClose={() => setToyBoxOpen(false)}
        />
      )}

      {night.error && (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-white px-4 py-2 text-[13.5px] text-black shadow-lg"
        >
          {night.error}
          <button
            type="button"
            className="ml-3 text-black/50"
            onClick={night.clearError}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </main>
  );
}

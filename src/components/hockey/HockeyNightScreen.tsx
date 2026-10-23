"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { CuratorSetup } from "@/experience-lab/ui/CuratorSetup";
import { QuietMode } from "@/experience-lab/ui/QuietMode";
import { ToyBox } from "@/experience-lab/ui/ToyBox";
import type { Block } from "@/experience-lab/core/types";
import { pickProgress } from "@/domain/hockey/reveal";
import {
  PLAN_PROMPT_IDS,
  defaultTab,
  isTabId,
  tabOfBlock,
  type TabId,
} from "@/domain/hockey/tabs";
import { matchupOf, teamColours } from "@/domain/hockey/teams";
import { BleedPrompt } from "./BleedPrompt";
import { ChatRoom } from "./ChatRoom";
import { FansProvider } from "./FanTag";
import { TeamPicker } from "./TeamPicker";
import { GameDayHero } from "./GameDayHero";
import { ArenaDoor, isRogersArena } from "./arena/ArenaDoor";
import { GroupTab } from "./GroupTab";
import { Memories } from "./Memories";
import { NightTabs } from "./NightTabs";
import { PlanSummary, PlanTab } from "./PlanTab";
import { PlayTab, promptsOf } from "./PlayTab";
import { useNhlGame } from "./useNhlGame";
import { useSharedNight, type NightSnapshot } from "./useSharedNight";
import styles from "./hockey.module.css";

/**
 * **Sycle Hockey Night — the shared one.**
 *
 * Underneath, unchanged: the Experience Lab's engine, its phases, blocks,
 * questions, reveal rules and voice, run on the real clock against the
 * database through `useSharedNight` (who you are is your Passport account;
 * nobody on the page is a fixture).
 *
 * On top, a page built for a phone at a hockey game rather than a column of
 * every block:
 *
 * - **The game first.** The matchup in both teams' colours, the clock to puck
 *   drop (then the period, then the final), who's in, and Passport's one line
 *   for right now (`GameDayHero`).
 * - **Four rooms and the arena.** Plan, Play, Chat, Group
 *   (`domain/hockey/tabs.ts`), with Arena Mode in the middle of the bar.
 *   Every block the phase puts on the page is in exactly one room; Plan is
 *   the group's five decisions.
 * - **Real places.** The dinner vote is photographs of Atlas's places near the
 *   arena, by Passport's own picture rule (`VenueCard`).
 * - **Phones away.** In a period the page is still only "put your phone away"
 *   — plus the plan, so nobody has to dig for where we're meeting after.
 */
export function HockeyNightScreen({ initial }: { initial: NightSnapshot }) {
  const night = useSharedNight(initial);
  const nhl = useNhlGame(initial.state.slug);
  const { live, definition, state, role } = night;
  const [toyBoxOpen, setToyBoxOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const { chirp } = night;
  const myTeam = live.me ? (chirp.fans[live.me.id] ?? null) : null;
  // Anyone on the night without a team is asked — never made to answer.
  const askTeam = Boolean(live.me && chirp.available && !myTeam);
  const [tab, setTab] = useTabs(live.phase.id);
  const panel = useRef<HTMLDivElement>(null);

  const showSetup =
    role === "host" && state.brief === null && live.phaseNumber === 0;
  const quiet = live.attention === "quiet";

  // Setup is a long form; once it's done, land on the night, not halfway down it.
  const wasSetup = useRef(showSetup);
  useEffect(() => {
    if (wasSetup.current && !showSetup) window.scrollTo({ top: 0 });
    wasSetup.current = showSetup;
  }, [showSetup]);
  const nextPhaseId = definition.phases[live.phaseNumber + 1]?.id;
  const { home, away } = matchupOf(definition.subtitle);

  const byTab = useMemo(() => {
    const rooms: Record<TabId, Block[]> = {
      plan: [],
      play: [],
      chat: [],
      group: [],
    };
    for (const block of live.blocks) rooms[tabOfBlock(block)].push(block);
    return rooms;
  }, [live.blocks]);

  const picksBlock = live.blocks.find((b) => b.id === "picks");
  const myPicks = picksBlock
    ? pickProgress(promptsOf(picksBlock, live.prompts, live.phase.id))
    : undefined;

  const unread = useUnread(
    state.slug,
    live.moments,
    live.me?.id,
    tab === "chat",
  );
  const badges = {
    plan: live.me
      ? live.prompts.filter(
          (p) =>
            PLAN_PROMPT_IDS.has(p.prompt.id) &&
            byTab.plan.some((b) => b.promptIds?.includes(p.prompt.id)) &&
            p.open &&
            p.myResponse === undefined,
        ).length
      : 0,
    play: live.me
      ? byTab.play
          .filter((b) => b.kind === "promptGroup")
          .flatMap((b) => promptsOf(b, live.prompts, live.phase.id))
          .filter((p) => p.open && p.myResponse === undefined).length
      : 0,
    chat: unread,
  };

  const choose = (next: TabId, anchor?: string) => {
    setTab(next);
    requestAnimationFrame(() => {
      const target = anchor ? document.getElementById(anchor) : panel.current;
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY - 12;
      if (anchor || window.scrollY > top) {
        window.scrollTo({ top, behavior: "smooth" });
      }
    });
  };

  return (
    <FansProvider value={chirp.fans}>
      <main
        className={`${styles.page} min-h-dvh pb-32 text-white`}
        style={
          {
            "--home": teamColours(home).primary,
            "--away": teamColours(away).primary,
          } as React.CSSProperties
        }
      >
        <GameDayHero
          live={live}
          role={role}
          myPicks={myPicks}
          nhl={nhl}
          onInvite={() => choose("group", "guest-list")}
          onGoAgain={() => choose("plan", "run-it-back")}
        />

        {showSetup && (
          <div className="mx-auto max-w-2xl px-4 pt-6">
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
          </div>
        )}

        {!showSetup && quiet && (
          <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-6">
            <QuietMode live={live} />
            {/* Arena Mode stays reachable in a period: the herd, the
              washrooms and the beer line are most needed when the phone
              is otherwise put away. */}
            {live.me && isRogersArena(definition.kicker) && (
              <ArenaDoor slug={night.state.slug} />
            )}
            <PlanSummary live={live} />
            <Memories night={night} />
          </div>
        )}

        {!showSetup && !quiet && (
          <>
            <div
              ref={panel}
              id={`panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
              className="mx-auto max-w-2xl scroll-mt-3 px-4 pt-5"
            >
              {tab === "plan" && <PlanTab night={night} blocks={byTab.plan} />}
              {tab === "play" && (
                <PlayTab
                  night={night}
                  blocks={byTab.play}
                  nhl={nhl}
                  onOpenToyBox={() => setToyBoxOpen(true)}
                />
              )}
              {tab === "chat" && (
                <section aria-labelledby="chat-title">
                  <h2
                    id="chat-title"
                    className={`${styles.wide} text-[28px] leading-none text-white`}
                  >
                    {byTab.chat[0]?.title ?? "The night"}
                  </h2>
                  <p className="mt-2 mb-4 text-[15px] text-white/70">
                    Everyone on this night, and nobody else.
                  </p>
                  {askTeam && (
                    <div className="mb-5">
                      <BleedPrompt
                        slug={state.slug}
                        onOpen={() => setPicking(true)}
                      />
                    </div>
                  )}
                  <ChatRoom
                    live={live}
                    onSay={night.say}
                    onReact={night.react}
                    slug={state.slug}
                    chirp={chirp}
                    isHost={role === "host"}
                    onLook={night.chirpLook}
                    onSetChirp={night.setChirp}
                  />
                </section>
              )}
              {tab === "group" && (
                <GroupTab
                  night={night}
                  onPickTeam={
                    chirp.available ? () => setPicking(true) : undefined
                  }
                />
              )}
            </div>

            {askTeam && tab !== "chat" && (
              <BleedPrompt
                strip
                slug={state.slug}
                onOpen={() => setPicking(true)}
              />
            )}

            <NightTabs
              current={tab}
              onChange={(t) => choose(t)}
              badges={badges}
              arenaHref={
                live.me && isRogersArena(definition.kicker)
                  ? `/hockey/${night.state.slug}/arena`
                  : undefined
              }
            />
          </>
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

        {picking && live.me && (
          <TeamPicker
            current={myTeam}
            onPick={(team) => {
              night.setTeam(team);
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
          />
        )}

        {night.error && (
          <div
            role="alert"
            className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-white px-4 py-2.5 text-[14px] text-black shadow-lg"
          >
            {night.error}
            <button
              type="button"
              className="ml-3 min-h-8 text-black/60"
              onClick={night.clearError}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
      </main>
    </FansProvider>
  );
}

/**
 * The open tab: the one chosen on this page, else the URL's `#plan`/`#play`/…
 * that the page was opened with (so a reload or a shared link lands in the
 * same room), else the room the phase opens in. When the night moves to a
 * new phase, a choice made in the old one gives way to the new default.
 */
function useTabs(phaseId: string): [TabId, (tab: TabId) => void] {
  const [chosen, setChosen] = useState<{ tab: TabId; phaseId: string } | null>(
    null,
  );
  const hash = useSyncExternalStore(
    subscribeHash,
    () => window.location.hash.slice(1),
    () => "",
  );

  const tab =
    chosen && chosen.phaseId === phaseId
      ? chosen.tab
      : !chosen && isTabId(hash)
        ? hash
        : defaultTab(phaseId);
  const set = (next: TabId) => {
    setChosen({ tab: next, phaseId });
    window.history.replaceState(null, "", `#${next}`);
  };
  return [tab, set];
}

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

const SEEN_EVENT = "hockey:chat-seen";

function subscribeSeen(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SEEN_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SEEN_EVENT, onChange);
  };
}

/**
 * Things other people said since this person last opened Chat, remembered on
 * this device only. Nothing is stored anywhere else; a new phone starts by
 * counting everything, which is the right failure.
 */
function useUnread(
  slug: string,
  moments: readonly { at: string; kind: string; by?: string }[],
  meId: string | undefined,
  looking: boolean,
): number {
  const key = `hockey:${slug}:chat-seen`;
  const latest = moments.reduce((max, m) => (m.at > max ? m.at : max), "");
  const seen = useSyncExternalStore(
    subscribeSeen,
    () => window.localStorage.getItem(key) ?? "",
    () => null,
  );

  useEffect(() => {
    if (!looking || !latest || latest === seen) return;
    window.localStorage.setItem(key, latest);
    window.dispatchEvent(new Event(SEEN_EVENT));
  }, [looking, latest, key, seen]);

  if (seen === null || looking) return 0;
  return moments.filter(
    (m) => m.kind === "note" && m.by && m.by !== meId && m.at > seen,
  ).length;
}

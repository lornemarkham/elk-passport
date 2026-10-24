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
import { teamByAbbr } from "@/domain/hockey/fans";
import { gameWhen } from "@/domain/hockey/countdown";
import { ChatRoom } from "./ChatRoom";
import { TeamMoment, WelcomeCard, useWelcomeDismissed } from "./Identity";
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
import { mentioner } from "@/domain/hockey/mention";

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
  const crowd = night.crowd;
  const watching = live.me ? (crowd?.where[live.me.id] ?? null) : null;
  const couch = watching === "couch";
  // A team just declared: the moment, over the page, for two seconds.
  const [moment, setMoment] = useState<string | null>(null);
  // Anyone on the night who hasn't said who they bleed for or where they're
  // watching is welcomed with both — never made to answer either.
  const [welcomed, dismissWelcome] = useWelcomeDismissed(state.slug);
  const unsettled =
    (chirp.available && !myTeam) || (Boolean(crowd?.available) && !watching);
  const periods = live.attention === "quiet";
  // On the couch, the chat *is* the game: periods open on it.
  const [tab, setTab] = useTabs(
    live.phase.id,
    couch && periods ? "chat" : undefined,
  );
  // At the arena, a period is "phones away" — unless you ask for the chat at
  // a whistle, for this period only.
  const [peeking, setPeeking] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const showSetup =
    role === "host" && state.brief === null && live.phaseNumber === 0;
  const quiet = periods && !couch && peeking !== live.phase.id;

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

  const { count: unread, mention } = useUnread(
    state.slug,
    live.moments,
    live.me ?? undefined,
    live.participants,
    tab === "chat",
  );
  // At the arena, peeking at the chat in a period is for that look only:
  // one tap puts the phone away again.
  const peekingNow = periods && !couch && peeking === live.phase.id;
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
          .filter((p) => p.open && p.myResponse === undefined).length +
        // A challenge waiting on my answer is the best reason to open PLAY.
        night.play.challenges.filter(
          (c) => c.target_id === live.me!.id && c.status === "open",
        ).length
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
            {live.me && (
              <button
                type="button"
                onClick={() => {
                  setPeeking(live.phase.id);
                  setTab("chat");
                }}
                className="mx-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-white/[0.08] px-5 text-[15px] font-bold text-white ring-1 ring-white/15"
              >
                At a whistle? Open the chat
                {unread > 0 && (
                  <span
                    aria-label={`${unread} new`}
                    className="rounded-full bg-[#ffd84d] px-2 text-[13px] text-[#0b1220]"
                  >
                    {unread}
                  </span>
                )}
              </button>
            )}
            {/* Subtle: only what is worth a glance at a whistle — somebody
                said your name. Everything else waits in the count. */}
            {live.me && mention && (
              <p className="-mt-4 text-center text-[13px] text-white/60">
                <span
                  aria-hidden
                  className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#ffd84d] align-middle"
                />
                {mention} mentioned you
              </p>
            )}
            {/* Arena Mode stays reachable in a period: the herd, the
              washrooms and the beer line are most needed when the phone
              is otherwise put away. */}
            {live.me && !couch && isRogersArena(definition.kicker) && (
              <ArenaDoor slug={night.state.slug} />
            )}
            <PlanSummary night={night} couch={couch} />
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
              {peekingNow && (
                <button
                  type="button"
                  onClick={() => setPeeking(null)}
                  className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/[0.08] px-4 text-[14px] font-bold text-white ring-1 ring-white/15"
                >
                  ← Phones away — back to the game
                </button>
              )}
              {live.me && unsettled && !welcomed && (
                <div className="mb-6">
                  <WelcomeCard
                    me={live.me}
                    people={live.participants}
                    matchup={`${away} at ${home}`}
                    when={gameWhen(new Date(definition.anchorAt))}
                    venue={definition.kicker.split(" · ")[0]}
                    team={myTeam}
                    watching={watching}
                    teamsOn={chirp.available}
                    couchOn={Boolean(crowd?.available)}
                    onPickTeam={() => setPicking(true)}
                    onWatching={night.setWatching}
                    onDismiss={dismissWelcome}
                  />
                </div>
              )}
              {tab === "plan" && (
                <PlanTab
                  night={night}
                  blocks={byTab.plan}
                  couch={couch}
                  onImGoing={() => night.setWatching("arena")}
                />
              )}
              {tab === "play" && (
                <PlayTab
                  night={night}
                  blocks={byTab.play}
                  nhl={nhl}
                  onOpenToyBox={() => setToyBoxOpen(true)}
                  onPickTeam={
                    chirp.available ? () => setPicking(true) : undefined
                  }
                  onOpenChat={() => choose("chat")}
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

            <NightTabs
              current={tab}
              onChange={(t) => choose(t)}
              badges={badges}
              arenaHref={
                live.me && !couch && isRogersArena(definition.kicker)
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
              if (team && team !== myTeam) setMoment(team);
            }}
            onClose={() => setPicking(false)}
          />
        )}

        {moment && live.me && teamByAbbr(moment) && (
          <TeamMoment
            team={teamByAbbr(moment)!}
            person={live.me}
            onDone={() => setMoment(null)}
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
function useTabs(
  phaseId: string,
  preferred?: TabId,
): [TabId, (tab: TabId) => void] {
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
        : (preferred ?? defaultTab(phaseId));
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
  moments: readonly { at: string; kind: string; by?: string; text?: string }[],
  me: { readonly id: string; readonly name: string } | undefined,
  people: readonly { readonly id: string; readonly name: string }[],
  looking: boolean,
): { count: number; mention: string | null } {
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

  if (seen === null || looking) return { count: 0, mention: null };
  const fresh = moments.filter(
    (m) => m.kind === "note" && m.by && m.by !== me?.id && m.at > seen,
  );
  return { count: fresh.length, mention: mentioner(fresh, me, people) };
}

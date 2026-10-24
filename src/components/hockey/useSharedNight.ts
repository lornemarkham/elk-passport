"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { liveExperience, withResponse } from "@/experience-lab/core/engine";
import type { ToyInput } from "@/experience-lab/core/toybox";
import type {
  Brief,
  Edge,
  ExperienceDefinition,
  ExperienceState,
  ResponseValue,
  ToyFamily,
} from "@/experience-lab/core/types";
import type { Action } from "@/domain/hockey/actions";
import type { ChirpLevel, ChirpRoom } from "@/domain/hockey/chirp";
import type { Crowd, Watching } from "@/domain/hockey/crowd";
import type { ModuleId } from "@/domain/hockey/modules";
import type { SeriesView } from "@/domain/hockey/series";

export interface NightSnapshot {
  readonly definition: ExperienceDefinition;
  readonly state: ExperienceState;
  readonly role: "host" | "guest";
  /** Which modules the host has on (`domain/hockey/modules.ts`). */
  readonly modules: ModuleId[];
  /** Everybody's team and Chirp Bot's lines in the chat. */
  readonly chirp: ChirpRoom;
  /** Who's at the arena and who's on the couch. Older servers send none. */
  readonly crowd?: Crowd;
  /**
   * The rest of this night's run. Sent with the page, not with every poll:
   * last time does not change while you are looking at this time, and
   * reading back every earlier night every five seconds would be absurd.
   */
  readonly series?: SeriesView;
}

/** How often the page asks what everybody else did. Only while it is being looked at. */
const POLL_MS = 5000;

/**
 * **`useExperienceLab`, shared.**
 *
 * Same return shape for everything the lab page calls — `respond`, `say`,
 * `react`, `addOption`, `addToy`, `cue`, `consent`, `setBrief`, `setMyEdge` —
 * so the prototype's components run unchanged. What differs is where the
 * truth lives: on the server, as rows each person writes only their own of,
 * which is what lets six people vote at once without anybody's vote being
 * written over.
 *
 * The cheap gestures (an answer, a reaction, opting in) show immediately and
 * are then replaced by whatever the server says, so a refused one reverts
 * rather than lying. Everybody else's changes arrive by polling while the tab
 * is visible — a hidden phone in a pocket asks nothing, which suits a product
 * whose best screen is "put your phone away".
 */
export function useSharedNight(initial: NightSnapshot) {
  const id = initial.state.slug;
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  /** Bumped by every write, so a poll that set off before it cannot undo it. */
  const generation = useRef(0);
  const series = initial.series;
  const keepSeries = useCallback(
    (next: NightSnapshot): NightSnapshot => ({
      ...next,
      series: next.series ?? series,
    }),
    [series],
  );

  const refresh = useCallback(async () => {
    const started = generation.current;
    try {
      const res = await fetch(`/hockey/api/occasions/${id}`, {
        cache: "no-store",
      });
      if (res.status === 404 || res.status === 401) {
        // Removed from the night, or signed out somewhere else. Either way
        // this page no longer has anything it is allowed to show.
        window.location.href = "/hockey?gone=1";
        return;
      }
      if (!res.ok) return;
      const next = (await res.json()) as NightSnapshot;
      if (generation.current === started) setSnapshot(keepSeries(next));
    } catch {
      // Offline for a moment. The next poll will try again.
    }
  }, [id, keepSeries]);

  useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
      setTick((t) => t + 1);
    }, POLL_MS);
    const wake = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [refresh]);

  const send = useCallback(
    async (
      action: Action,
      optimistic?: (s: ExperienceState) => ExperienceState,
    ) => {
      generation.current += 1;
      const mine = generation.current;
      setError(null);
      if (optimistic) {
        setSnapshot((prev) => ({ ...prev, state: optimistic(prev.state) }));
      }
      try {
        const res = await fetch(`/hockey/api/occasions/${id}/actions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(action),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error ?? "That didn't work.");
          await refresh();
          return;
        }
        if (generation.current === mine)
          setSnapshot(keepSeries(body as NightSnapshot));
      } catch {
        setError("Couldn't reach Passport. Try again in a second.");
        await refresh();
      }
    },
    [id, refresh, keepSeries],
  );

  const { state, role } = snapshot;
  // Last time's receipts are the lab's `lineage`, so the recap's callback and
  // the defending champion read them exactly as the prototype did.
  const lineage = snapshot.series?.lastTime ?? undefined;
  const definition = useMemo(
    () => ({ ...snapshot.definition, lineage }),
    [snapshot.definition, lineage],
  );
  const live = useMemo(
    () => liveExperience(definition, state, new Date()),
    // `tick` re-derives the page as time passes: phases change on the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [definition, state, tick],
  );
  const me = state.meId;

  return {
    live,
    state,
    definition,
    role,
    modules: snapshot.modules,
    chirp: snapshot.chirp,
    crowd: snapshot.crowd,
    series: snapshot.series,
    error,
    clearError: () => setError(null),
    hydrated: true as const,
    refresh,
    send,

    respond: (promptId: string, value: ResponseValue) =>
      send({ type: "respond", promptId, value }, (s) =>
        me ? withResponse(s, promptId, me, value, new Date().toISOString()) : s,
      ),

    say: (text: string) => {
      if (text.trim()) void send({ type: "say", text: text.trim() });
    },

    react: (momentId: string, emoji: string) => {
      // Passport's own lines (the vault opening) are not rows anybody can react to.
      if (!/^[0-9a-f-]{36}$/.test(momentId)) return;
      void send({ type: "react", momentId, emoji }, (s) => {
        if (!me) return s;
        const current = s.reactions[momentId]?.[emoji] ?? [];
        const next = current.includes(me)
          ? current.filter((x) => x !== me)
          : [...current, me];
        return {
          ...s,
          reactions: {
            ...s.reactions,
            [momentId]: { ...(s.reactions[momentId] ?? {}), [emoji]: next },
          },
        };
      });
    },

    addOption: (promptId: string, label: string, detail?: string) => {
      if (label.trim()) {
        void send({
          type: "addOption",
          promptId,
          label: label.trim(),
          detail: detail?.trim() || undefined,
        });
      }
    },

    addToy: (family: ToyFamily, input: Omit<ToyInput, "id" | "askedBy">) => {
      if (family === "people") return;
      void send({ type: "addToy", family, input });
    },

    cue: (promptId: string) => void send({ type: "cue", promptId }),

    consent: (promptId: string, agreed: boolean) =>
      void send({ type: "consent", promptId, agreed }, (s) => ({
        ...s,
        consented: agreed
          ? [...new Set([...s.consented, promptId])]
          : s.consented.filter((x) => x !== promptId),
        declined: agreed
          ? s.declined.filter((x) => x !== promptId)
          : [...new Set([...s.declined, promptId])],
      })),

    setBrief: (brief: Brief) =>
      void send({ type: "setBrief", brief }, (s) => ({ ...s, brief })),

    // The ticks move at once, so a second quick tap builds on the first; what
    // the night then contains is composed by the server and arrives with it.
    setModules: (modules: ModuleId[]) => {
      setSnapshot((prev) => ({ ...prev, modules }));
      void send({ type: "setModules", modules });
    },

    // Who I bleed for. The chip moves at once; Chirp Bot's welcome, if it
    // has one, arrives with a later poll.
    setTeam: (team: string | null) => {
      const me = state.meId;
      setSnapshot((prev) => {
        if (!me) return prev;
        const fans = { ...prev.chirp.fans };
        if (team) fans[me] = team;
        else delete fans[me];
        return { ...prev, chirp: { ...prev.chirp, fans } };
      });
      void send({ type: "setTeam", team });
    },

    /** Opened the chat: Chirp Bot may have a pregame question due. */
    chirpLook: () => void send({ type: "chirpLook" }),

    setChirp: (on: boolean, level?: ChirpLevel) => {
      setSnapshot((prev) => ({
        ...prev,
        chirp: { ...prev.chirp, on, level: level ?? prev.chirp.level },
      }));
      void send({ type: "setChirp", on, level });
    },

    /** At the arena or on the couch. Moves at once; Chirp Bot may notice. */
    setWatching: (where: Watching) => {
      const me = state.meId;
      setSnapshot((prev) => {
        if (!me || !prev.crowd) return prev;
        return {
          ...prev,
          crowd: { ...prev.crowd, where: { ...prev.crowd.where, [me]: where } },
        };
      });
      void send({ type: "setWatching", where });
    },

    setMyEdge: (edge: Edge | null) =>
      void send({ type: "setMyEdge", edge }, (s) => ({ ...s, myEdge: edge })),
  };
}

export type SharedNight = ReturnType<typeof useSharedNight>;

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { liveExperience, withResponse } from "../core/engine";
import { experienceStore } from "../core/store";
import { TOYS, type ToyInput } from "../core/toybox";
import type {
  Brief,
  Edge,
  ExperienceDefinition,
  Prompt,
  PromptOption,
  ResponseValue,
  ToyFamily,
} from "../core/types";

/**
 * The one stateful thing in the lab.
 *
 * `hydrated` is not ceremony: the whole page is a function of *now*, and
 * server and client do not agree on what now is. Rendering the poster
 * immediately and everything time-dependent after mount is what stops the
 * countdown from flickering — and the poster is the part that has to land in
 * the first second anyway.
 */
export function useExperienceLab(definition: ExperienceDefinition) {
  const store = useMemo(
    () => experienceStore(definition.slug),
    [definition.slug],
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
  const { state, hydrated } = snapshot;
  const setState = store.update;
  const [tick, setTick] = useState(0);

  // Only matters when the real clock is in charge; the time machine pins it.
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  });

  const live = useMemo(
    () => liveExperience(definition, state, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [definition, state, tick],
  );

  const respond = useCallback(
    (promptId: string, value: ResponseValue) => {
      setState((prev) =>
        prev.meId
          ? withResponse(
              prev,
              promptId,
              prev.meId,
              value,
              new Date().toISOString(),
            )
          : prev,
      );
    },
    [setState],
  );

  const join = useCallback(
    (participantId: string) => {
      setState((prev) => ({
        ...prev,
        meId: participantId,
        joinedIds: prev.joinedIds.includes(participantId)
          ? prev.joinedIds
          : [...prev.joinedIds, participantId],
        moments: prev.joinedIds.includes(participantId)
          ? prev.moments
          : [
              ...prev.moments,
              {
                id: `join-${participantId}-${Date.now()}`,
                at: new Date().toISOString(),
                kind: "join" as const,
                by: participantId,
              },
            ],
      }));
    },
    [setState],
  );

  const lurk = useCallback(() => {
    setState((prev) => ({ ...prev, lurking: true, meId: null }));
  }, [setState]);

  /** Switching identity is a lab affordance. Real Passport has one of you. */
  const becomeSomeoneElse = useCallback(
    (participantId: string | null) => {
      setState((prev) => ({ ...prev, meId: participantId }));
    },
    [setState],
  );

  const addOption = useCallback(
    (promptId: string, label: string, detail?: string) => {
      setState((prev) => {
        if (!prev.meId || !label.trim()) return prev;
        const option: PromptOption = {
          id: `opt-${Date.now()}`,
          label: label.trim(),
          detail: detail?.trim() || undefined,
          addedBy: prev.meId,
        };
        return {
          ...prev,
          addedOptions: [...prev.addedOptions, { promptId, option }],
        };
      });
    },
    [setState],
  );

  const addPrompt = useCallback(
    (draft: Omit<Prompt, "id" | "askedBy">) => {
      setState((prev) => {
        if (!prev.meId) return prev;
        const prompt: Prompt = {
          ...draft,
          id: `ask-${Date.now()}`,
          askedBy: prev.meId,
        };
        return {
          ...prev,
          addedPrompts: [...prev.addedPrompts, prompt],
          moments: [
            ...prev.moments,
            {
              id: `askm-${Date.now()}`,
              at: new Date().toISOString(),
              kind: "note" as const,
              by: prev.meId,
              text: `asked: “${prompt.question}”`,
            },
          ],
        };
      });
    },
    [setState],
  );

  const say = useCallback(
    (text: string) => {
      setState((prev) => {
        if (!prev.meId || !text.trim()) return prev;
        return {
          ...prev,
          moments: [
            ...prev.moments,
            {
              id: `say-${Date.now()}`,
              at: new Date().toISOString(),
              kind: "note" as const,
              by: prev.meId,
              text: text.trim(),
            },
          ],
        };
      });
    },
    [setState],
  );

  /**
   * Reactions are stored beside moments rather than inside them, so the same
   * gesture works on a line a fixture wrote and a line a person wrote. It is
   * also the cheapest possible way to be present in someone else's night,
   * which is most of what people actually do.
   */
  const react = useCallback(
    (momentId: string, emoji: string, seeded?: readonly string[]) => {
      setState((prev) => {
        if (!prev.meId) return prev;
        const me = prev.meId;
        const current = prev.reactions[momentId]?.[emoji] ?? seeded ?? [];
        const next = current.includes(me)
          ? current.filter((id) => id !== me)
          : [...current, me];
        return {
          ...prev,
          reactions: {
            ...prev.reactions,
            [momentId]: { ...(prev.reactions[momentId] ?? {}), [emoji]: next },
          },
        };
      });
    },
    [setState],
  );

  /** The curator says what kind of night this is. Four taps, once. */
  const setBrief = useCallback(
    (brief: Brief) => {
      setState((prev) => ({ ...prev, brief }));
    },
    [setState],
  );

  /**
   * My own ceiling, which can only ever lower the night's.
   *
   * Kept separate from the brief on purpose: the curator sets the tone of the
   * night, not the tone of me.
   */
  const setMyEdge = useCallback(
    (edge: Edge | null) => {
      setState((prev) => ({ ...prev, myEdge: edge }));
    },
    [setState],
  );

  /** A human opens something sealed. Not the clock — a person. */
  const cue = useCallback(
    (promptId: string) => {
      setState((prev) =>
        prev.cues.includes(promptId)
          ? prev
          : {
              ...prev,
              cues: [...prev.cues, promptId],
              moments: [
                ...prev.moments,
                {
                  id: `cue-${promptId}-${Date.now()}`,
                  at: new Date().toISOString(),
                  kind: "voice" as const,
                  text: "🔓 Opened.",
                },
              ],
            },
      );
    },
    [setState],
  );

  /** Opting in. Nothing with a consequence binds anybody without this. */
  const consent = useCallback(
    (promptId: string, agreed: boolean) => {
      setState((prev) => ({
        ...prev,
        consented: agreed
          ? [...new Set([...prev.consented, promptId])]
          : prev.consented.filter((id) => id !== promptId),
        declined: agreed
          ? prev.declined.filter((id) => id !== promptId)
          : [...new Set([...prev.declined, promptId])],
      }));
    },
    [setState],
  );

  /**
   * A toy becomes questions.
   *
   * Note what does *not* happen here: no new block, no new component, no
   * registry entry. A toy compiles to `Prompt`s and joins `addedPrompts`,
   * which round 1 already had for "ask the group something stupid". Every
   * mechanic in round 2 arrived through this one door.
   */
  const addToy = useCallback(
    (family: ToyFamily, input: Omit<ToyInput, "id" | "askedBy">) => {
      setState((prev) => {
        if (!prev.meId) return prev;
        const id = `toy-${family}-${Date.now()}`;
        const built = TOYS[family].build({
          ...input,
          id,
          askedBy: prev.meId,
        });
        /**
         * The feed announces that something happened, never what.
         *
         * The first version printed the mission text into the group feed the
         * moment it was created, which meant the one mechanic whose entire
         * value is secrecy leaked itself on creation. Not naming the target
         * either turned out to be better than naming them: everybody knowing
         * *somebody* has a mission is the fun part.
         */
        const secret = built.some((p) => p.audience?.only);
        const headline = secret
          ? `slipped somebody a ${TOYS[family].label.toLowerCase()}. Nobody else needs to know what.`
          : `added ${TOYS[family].label.toLowerCase()}: “${input.text.split("|")[0].trim()}”`;

        return {
          ...prev,
          addedPrompts: [...prev.addedPrompts, ...built],
          moments: [
            ...prev.moments,
            {
              id: `toym-${id}`,
              at: new Date().toISOString(),
              kind: "note" as const,
              by: prev.meId,
              text: headline,
            },
          ],
        };
      });
    },
    [setState],
  );

  const setNow = useCallback(
    (iso: string | null) => {
      setState((prev) => ({ ...prev, nowOverride: iso }));
    },
    [setState],
  );

  const reset = store.reset;

  return {
    live,
    state,
    hydrated,
    respond,
    join,
    lurk,
    setBrief,
    setMyEdge,
    cue,
    consent,
    addToy,
    becomeSomeoneElse,
    addOption,
    addPrompt,
    say,
    react,
    setNow,
    reset,
  };
}

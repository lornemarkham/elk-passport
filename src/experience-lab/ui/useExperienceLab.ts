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
import type {
  ExperienceDefinition,
  Prompt,
  PromptOption,
  ResponseValue,
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
    becomeSomeoneElse,
    addOption,
    addPrompt,
    say,
    react,
    setNow,
    reset,
  };
}

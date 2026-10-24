"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { LivePrompt } from "@/experience-lab/core/engine";
import { sameName } from "@/domain/collections/places";
import type { NearbyPlace } from "@/domain/hockey/nearby";
import type { SharedNight } from "./useSharedNight";

/** What Plan shares between its stops: the places, the ballot, the add box. */

export type Nearby = {
  places: NearbyPlace[];
  meeting?: NearbyPlace[];
  arena?: { atlasId: string; at: [number, number] };
  venue?: { name: string; at: [number, number] };
  outage?: string;
};
export type NearbyState = ReturnType<typeof useNearby>;

const EMPTY_TALLY: LivePrompt["tally"] = [];

export type Ballot = ReturnType<typeof useBallot>;

export function placeFor(
  label: string,
  places: readonly NearbyPlace[] | undefined,
): NearbyPlace | undefined {
  return (
    places?.find((p) => p.name === label) ??
    places?.find((p) => sameName(p.name, label))
  );
}

/**
 * The ballot as this person sees it, and how to put a place on it. A card's
 * "Add & vote" is two writes: nominate (the same as ever), then — once the
 * ballot has it — vote for it. The second waits for the first to show up in
 * the tally; a nomination that is refused never shows up, and is forgotten.
 *
 * It lives in the plan, which is always on the page, not in the sheet or the
 * board that asked: close the places browser the instant you tap "Add &
 * vote" and the vote must still follow the nomination.
 */
export function useBallot(night: SharedNight, prompt?: LivePrompt) {
  const tally = prompt?.tally ?? EMPTY_TALLY;
  const promptId = prompt?.prompt.id ?? "";
  const mine = prompt?.myResponse?.value;
  const top = Math.max(0, ...tally.map((o) => o.voters.length));
  const tied = tally.filter((o) => o.voters.length === top).length > 1;
  const onBallot = useMemo(
    () => new Map(tally.map((o) => [o.label, o])),
    [tally],
  );
  const toVote = useRef(new Set<string>());
  const [adding, setAdding] = useState<readonly string[]>([]);
  useEffect(() => {
    for (const name of toVote.current) {
      const option = onBallot.get(name);
      if (!option) continue;
      toVote.current.delete(name);
      if (mine !== option.optionId) night.respond(promptId, option.optionId);
    }
    // `night` is new every render; the ballot is what this waits on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onBallot, mine, promptId]);
  const vote = (place: NearbyPlace) => {
    if (!promptId) return;
    const existing = onBallot.get(place.name);
    if (existing) {
      night.respond(promptId, existing.optionId);
      return;
    }
    toVote.current.add(place.name);
    setAdding((now) => [...now, place.name]);
    void night
      .send({
        type: "nominate",
        promptId,
        atlasId: place.atlasId,
      })
      .finally(() =>
        setTimeout(() => {
          toVote.current.delete(place.name);
          setAdding((now) => now.filter((n) => n !== place.name));
        }, 3000),
      );
  };
  const standing = (option: (typeof tally)[number]) =>
    top > 0 && option.voters.length === top
      ? tied
        ? ("tied" as const)
        : ("leading" as const)
      : undefined;
  const statusOf = (place: NearbyPlace) => {
    const option = onBallot.get(place.name);
    if (option) return mine === option.optionId ? "mine" : "on-ballot";
    return adding.includes(place.name) ? "pending" : "new";
  };
  return { mine, onBallot, adding, vote, standing, statusOf };
}

export function AddYourOwn({
  placeholder,
  label = placeholder,
  onAdd,
}: {
  placeholder: string;
  /** The accessible name, when the placeholder is shortened to fit. */
  label?: string;
  onAdd: (label: string) => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.trim()) return;
        onAdd(draft.trim());
        setDraft("");
      }}
    >
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={80}
        placeholder={placeholder}
        aria-label={label}
        className="min-h-12 min-w-0 flex-1 rounded-2xl bg-white/[0.07] px-4 text-[16px] text-white ring-1 ring-white/15 outline-none placeholder:text-white/45 focus:ring-white/40"
      />
      <button
        type="submit"
        disabled={!draft.trim()}
        className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-white px-4 text-[15px] font-bold text-[#0b1220] disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
        Add
      </button>
    </form>
  );
}

/**
 * Food and drink near the arena, asked for once per page and kept: the list
 * does not change while somebody is looking at it, and the vote's photographs
 * come from it.
 */
export function useNearby(slug: string, enabled: boolean) {
  const [data, setData] = useState<Nearby | null>(null);
  const [failed, setFailed] = useState(false);
  // Atlas's first corpus read after a cold start can take 8-19 s and can fail;
  // ask again once on our own, then leave "Try again" to the person.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || data) return;
    let current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    fetch(`/hockey/api/occasions/${slug}/nearby`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: Nearby) => current && setData(body))
      .catch(() => {
        if (!current) return;
        setFailed(true);
        if (attempt === 0) timer = setTimeout(() => setAttempt(1), 4000);
      });
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [enabled, data, slug, attempt]);

  const state: "idle" | "loading" | "failed" | "ready" = !enabled
    ? "idle"
    : data
      ? "ready"
      : failed
        ? "failed"
        : "loading";
  const retry = () => {
    setData(null);
    setFailed(false);
    setAttempt((n) => n + 1);
  };
  return { data, state, retry };
}

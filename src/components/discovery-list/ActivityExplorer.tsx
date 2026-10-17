"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  activityMatches,
  seasonLine,
  type Activity,
  type ExplorerEntry,
  type ExplorerGroup,
} from "@/domain/discovery/activities";

/**
 * **Every activity, findable — without the page turning into a wall of them.**
 *
 * The row under *Refine* offers the eight that fit this moment best, and the
 * line under an answer offers six. This is everything else, behind one
 * button: nine shelves (Outdoors, Water, Winter…), every activity Passport
 * recognises in Atlas's words, and for each one what Atlas holds for it
 * **here**. Nothing is cut for being rare or out of season. A birding route
 * with one place is listed; skiing in October says when it usually is.
 *
 * Three states, kept visibly apart, because "nothing near you" and "nothing at
 * all" are different answers:
 *
 * ```
 * near here        a chip with how many places, said like any other
 * only elsewhere   a quieter chip — Atlas holds it, just not near here
 * nowhere yet      named in a line, not a button: nothing to show
 * ```
 *
 * **Picking one says it.** The chip hands its label to the same reader a
 * typed sentence goes to (ADR 005), so the answer, the heading and the rest
 * of the conversation behave exactly as if it had been typed — "Birdwatching"
 * after "with my five-year-old" is birdwatching with them.
 *
 * The filter box finds an activity's name; it never searches places (ADR
 * 007 — the one text box on the page is still the sentence box).
 */
export function ActivityExplorer({
  open,
  onOpenChange,
  groups,
  where,
  chosen,
  narrowed = false,
  onPick,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly groups: readonly ExplorerGroup[];
  /** The town or area the counts are near, said in the heading. */
  readonly where?: string;
  /** The activity already in play, shown as chosen. */
  readonly chosen?: string;
  /**
   * Whether what was said (indoors, a drive, a day) has narrowed "here" — so
   * an activity with nothing here is "nothing that fits", not "not near".
   */
  readonly narrowed?: boolean;
  readonly onPick: (activity: Activity) => void;
}) {
  const [query, setQuery] = useState("");
  const unique = useMemo(() => {
    const seen = new Map<string, ExplorerEntry>();
    for (const group of groups)
      for (const entry of group.entries)
        if (!seen.has(entry.activity.key)) seen.set(entry.activity.key, entry);
    return [...seen.values()];
  }, [groups]);
  const nearCount = unique.filter((e) => e.here.length > 0).length;
  const elsewhereCount = unique.filter(
    (e) => e.here.length === 0 && e.anywhere > 0,
  ).length;
  const searching = query.trim().length > 0;
  const found = searching
    ? unique.filter((e) => activityMatches(e.activity, query))
    : [];

  const pick = (activity: Activity) => {
    setQuery("");
    onPick(activity);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <DialogContent
        data-testid="activity-explorer"
        className="flex max-h-[88vh] flex-col gap-0 overflow-hidden bg-white p-0 text-[#111] sm:max-w-2xl"
      >
        <DialogHeader className="border-b border-black/10 px-5 pt-5 pb-4 sm:px-7 sm:pt-6">
          <DialogTitle className="text-[22px] font-extrabold tracking-[-0.02em] text-[#111] sm:text-[26px]">
            Every activity
          </DialogTitle>
          <DialogDescription
            data-testid="activity-explorer-summary"
            className="text-[13.5px] leading-relaxed text-black/55"
          >
            {nearCount} with places {where ? `near ${where}` : "Atlas holds"}
            {elsewhereCount > 0 ? ` · ${elsewhereCount} only further away` : ""}
            . The numbers are places Atlas holds for each, not a ranking.
          </DialogDescription>
          <input
            type="search"
            data-testid="activity-explorer-filter"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find an activity — birds, kayak, winter…"
            aria-label="Find an activity"
            className="mt-2 min-h-11 w-full rounded-full bg-white px-5 text-[15px] text-[#111] ring-1 ring-black/20 ring-inset placeholder:text-black/35 focus:ring-2 focus:ring-black/60 focus:outline-none"
          />
        </DialogHeader>

        <div className="overflow-y-auto px-5 pt-2 pb-6 sm:px-7">
          {searching ? (
            found.length > 0 ? (
              <Shelf
                label={`${found.length} ${found.length === 1 ? "activity" : "activities"}`}
                entries={found}
                {...(where ? { where } : {})}
                {...(chosen ? { chosen } : {})}
                narrowed={narrowed}
                onPick={pick}
              />
            ) : (
              <p
                data-testid="activity-explorer-none"
                className="mt-5 text-[14px] leading-relaxed text-black/55"
              >
                No activity by that name. Try another word — or say it in the
                box on the page, which reads whole sentences.
              </p>
            )
          ) : (
            groups.map((group) => (
              <Shelf
                key={group.key}
                label={group.label}
                entries={group.entries}
                {...(where ? { where } : {})}
                {...(chosen ? { chosen } : {})}
                narrowed={narrowed}
                onPick={pick}
              />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "December to March" → "Dec–Mar", for a chip. */
const shortSeason = (activity: Activity): string | undefined => {
  const line = seasonLine(activity);
  if (!line) return undefined;
  const [from, to] = line.split(" to ");
  return `${from!.slice(0, 3)}–${to!.slice(0, 3)}`;
};

function Shelf({
  label,
  entries,
  where,
  chosen,
  narrowed,
  onPick,
}: {
  readonly label: string;
  readonly entries: readonly ExplorerEntry[];
  readonly where?: string;
  readonly chosen?: string;
  readonly narrowed: boolean;
  readonly onPick: (activity: Activity) => void;
}) {
  const near = entries.filter((e) => e.here.length > 0);
  const further = entries.filter((e) => e.here.length === 0 && e.anywhere > 0);
  const none = entries.filter((e) => e.anywhere === 0);
  return (
    <section
      data-testid="activity-shelf"
      aria-label={label}
      className="border-t border-black/10 pt-4 pb-1 first:border-t-0"
    >
      <h3 className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
        {label}
      </h3>
      {near.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {near.map((entry) => (
            <Chip
              key={entry.activity.key}
              entry={entry}
              on={entry.activity.key === chosen}
              onPick={onPick}
            />
          ))}
        </div>
      )}
      {further.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[12.5px] font-semibold text-black/45">
            {narrowed
              ? "Nothing here fits what you said — elsewhere:"
              : where
                ? `Not near ${where} — further away:`
                : "Further away:"}
          </span>
          {further.map((entry) => (
            <Chip
              key={entry.activity.key}
              entry={entry}
              quiet
              on={entry.activity.key === chosen}
              onPick={onPick}
            />
          ))}
        </div>
      )}
      {none.length > 0 && (
        <p
          data-testid="activity-none-yet"
          className="mt-2.5 text-[12.5px] leading-relaxed text-black/40"
        >
          Nothing in Atlas yet for{" "}
          {none.map((e) => e.activity.label.toLowerCase()).join(", ")}.
        </p>
      )}
    </section>
  );
}

function Chip({
  entry,
  quiet = false,
  on,
  onPick,
}: {
  readonly entry: ExplorerEntry;
  readonly quiet?: boolean;
  readonly on: boolean;
  readonly onPick: (activity: Activity) => void;
}) {
  const season = entry.inSeason ? undefined : shortSeason(entry.activity);
  const count = quiet ? entry.anywhere : entry.here.length;
  return (
    <button
      type="button"
      data-testid="activity-chip"
      data-activity={entry.activity.key}
      data-near={quiet ? "no" : "yes"}
      aria-pressed={on}
      onClick={() => onPick(entry.activity)}
      title={
        quiet
          ? `Atlas holds ${count} further away`
          : `Atlas holds ${count} ${count === 1 ? "place" : "places"} for this here`
      }
      className={
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-colors " +
        (on
          ? "min-h-11 bg-[#111] px-4 text-[14px] text-white"
          : quiet
            ? "min-h-9 px-3 text-[13px] text-black/55 ring-1 ring-black/10 ring-inset hover:text-black/85 hover:ring-black/35"
            : "min-h-11 px-4 text-[14px] text-black/75 ring-1 ring-black/15 ring-inset hover:ring-black/45")
      }
    >
      <span>{entry.activity.label}</span>
      <span
        className={
          "text-[0.78em] tabular-nums " + (on ? "opacity-70" : "text-black/35")
        }
      >
        {count}
      </span>
      {season && (
        <span
          className={
            "text-[0.74em] font-medium " + (on ? "opacity-70" : "text-black/40")
          }
        >
          · {season}
        </span>
      )}
    </button>
  );
}

/** The one way into the explorer, wherever the page offers it. */
export function ActivityExplorerButton({
  onOpen,
  compact = false,
}: {
  readonly onOpen: () => void;
  readonly compact?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid="activity-explorer-open"
      onClick={onOpen}
      className={
        "inline-flex shrink-0 items-center rounded-full font-semibold whitespace-nowrap text-[#111]/75 underline decoration-black/25 underline-offset-4 transition-colors hover:text-[#111] hover:decoration-black/60 " +
        (compact ? "min-h-9 px-2 text-[13px]" : "min-h-11 px-3 text-[14px]")
      }
    >
      All activities →
    </button>
  );
}

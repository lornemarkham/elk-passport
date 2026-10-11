"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Hand, Users } from "lucide-react";
import {
  NO_INTEREST,
  type InterestSummary,
  type Kindred,
} from "@/lib/data/boards-interest";

/**
 * **"I'm interested", and who else is.**
 *
 * One provider per board holds the whole picture the server last answered
 * with. Every change sends one request and replaces the picture with the
 * reply — no optimistic count, because a count that says 4 and then quietly
 * becomes 3 is exactly the kind of small lie a person notices.
 *
 * Showing your name is a single choice for the board, off until you turn it
 * on. Turning it on or off re-marks everything you are interested in, so
 * there is never a hockey game that names you beside a hike that does not
 * because you changed your mind halfway through.
 */
export interface InterestPicture {
  readonly summaries: Readonly<Record<string, InterestSummary>>;
  readonly kindred: readonly Kindred[];
}

interface InterestState {
  readonly picture: InterestPicture;
  readonly showName: boolean;
  readonly busy: boolean;
  readonly yourName: string;
  readonly toggle: (itemId: string) => void;
  readonly setShowName: (show: boolean) => void;
}

const Context = createContext<InterestState | null>(null);

function useInterest(): InterestState {
  const state = useContext(Context);
  if (!state) throw new Error("Interest controls need an InterestProvider.");
  return state;
}

async function send(
  boardId: string,
  method: "PUT" | "DELETE",
  itemId: string,
  showName: boolean,
): Promise<InterestPicture> {
  const response = await fetch(
    `/api/boards/${encodeURIComponent(boardId)}/interest`,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, showName }),
    },
  );
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

export function InterestProvider({
  boardId,
  initial,
  yourName,
  children,
}: {
  readonly boardId: string;
  readonly initial: InterestPicture;
  readonly yourName: string;
  readonly children: ReactNode;
}) {
  const [picture, setPicture] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [showName, setShowNameState] = useState(() =>
    Object.values(initial.summaries).some((s) => s.youShowName),
  );

  const run = async (work: () => Promise<InterestPicture | undefined>) => {
    setBusy(true);
    try {
      const next = await work();
      if (next) setPicture(next);
    } catch {
      toast.error("Couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (itemId: string) =>
    run(() => {
      const youAreIn = picture.summaries[itemId]?.youAreIn ?? false;
      return send(boardId, youAreIn ? "DELETE" : "PUT", itemId, showName);
    });

  const setShowName = (show: boolean) => {
    setShowNameState(show);
    const mine = Object.entries(picture.summaries)
      .filter(([, s]) => s.youAreIn)
      .map(([id]) => id);
    void run(async () => {
      let last: InterestPicture | undefined;
      for (const id of mine) last = await send(boardId, "PUT", id, show);
      return last;
    });
  };

  return (
    <Context.Provider
      value={{ picture, showName, busy, yourName, toggle, setShowName }}
    >
      {children}
    </Context.Provider>
  );
}

function people(n: number): string {
  return n === 1 ? "1 colleague" : `${n} colleagues`;
}

/** "You, Sam and 2 others" — names only for people who chose to show them. */
export function describeInterest(summary: InterestSummary): string {
  if (summary.count === 0) return "Nobody yet — be the first.";
  const parts: string[] = [];
  if (summary.youAreIn) parts.push("you");
  parts.push(...summary.names);
  if (summary.unnamed > 0) {
    parts.push(
      parts.length > 0 ? `${summary.unnamed} more` : people(summary.unnamed),
    );
  }
  const list =
    parts.length === 1
      ? parts[0]!
      : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  const sentence = list.charAt(0).toUpperCase() + list.slice(1);
  return `${sentence} ${summary.count === 1 && !summary.youAreIn ? "is" : "are"} interested.`;
}

export function InterestToggle({
  itemId,
  title,
}: {
  readonly itemId: string;
  readonly title: string;
}) {
  const { picture, busy, toggle } = useInterest();
  const summary = picture.summaries[itemId] ?? NO_INTEREST;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <button
        type="button"
        onClick={() => toggle(itemId)}
        disabled={busy}
        aria-pressed={summary.youAreIn}
        aria-label={`${summary.youAreIn ? "Not interested any more in" : "I'm interested in"} ${title}`}
        className={
          summary.youAreIn
            ? "bg-primary text-primary-foreground inline-flex items-center gap-2 self-start rounded-full px-4 py-2 text-sm font-medium disabled:opacity-60"
            : "hover:border-primary/60 inline-flex items-center gap-2 self-start rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-60"
        }
      >
        <Hand className="h-4 w-4" />
        {summary.youAreIn ? "You're interested" : "I'm interested"}
      </button>
      <p className="text-muted-foreground text-sm">
        {describeInterest(summary)}
      </p>
    </div>
  );
}

export function ShowNameChoice() {
  const { showName, setShowName, busy, yourName } = useInterest();
  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4"
        checked={showName}
        disabled={busy}
        onChange={(event) => setShowName(event.target.checked)}
      />
      <span>
        Show my name ({yourName}) to colleagues on this board beside the things
        I&apos;m interested in.{" "}
        <span className="text-muted-foreground">
          Off, you&apos;re counted but not named. Nobody outside this board sees
          either.
        </span>
      </span>
    </label>
  );
}

export function KindredPanel({
  titles,
}: {
  /** Item id → what to call it. */
  readonly titles: Readonly<Record<string, string>>;
}) {
  const { picture } = useInterest();
  const youAreInAnything = Object.values(picture.summaries).some(
    (s) => s.youAreIn,
  );

  return (
    <section aria-labelledby="kindred" className="rounded-xl border p-5">
      <h2
        id="kindred"
        className="mb-3 flex items-center gap-2 text-base font-semibold"
      >
        <Users className="h-4 w-4" />
        Colleagues into the same things
      </h2>
      {!youAreInAnything ? (
        <p className="text-muted-foreground text-sm">
          Say you&apos;re interested in something and colleagues who said the
          same — and chose to show their name — appear here.
        </p>
      ) : picture.kindred.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No named colleagues share your interests yet. Anyone counted without a
          name stays that way.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {picture.kindred.map((k, i) => (
            // Two colleagues may share a name; position is the only safe key.
            <li key={i}>
              <span className="font-medium">{k.name}</span>
              <span className="text-muted-foreground">
                {" "}
                — also into {k.shared.map((id) => titles[id] ?? id).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

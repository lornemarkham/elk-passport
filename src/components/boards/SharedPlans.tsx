"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarDays, Printer, Route, Trash2 } from "lucide-react";
import type { SharedPlan } from "@/lib/data/boards-plans";
import { planDateLine } from "@/domain/day/plan";
import { InterestToggle } from "./GatheringInterest";

/**
 * **Days the group could have together.**
 *
 * Each one is a day somebody built in Go Have A Day and shared here. Opening
 * it opens the same printed guide the person who built it saw — the board
 * keeps the link to the day, not a copy of it.
 *
 * "I'm in" is the board's interest mark, so it needs an `InterestProvider`
 * above it; `withInterest` says whether there is one. Without it, the days
 * are still listed and still open.
 */
export function SharedPlans({
  boardId,
  initial,
  canShare,
  withInterest,
  goHref = "/go",
}: {
  readonly boardId: string;
  /** `null` when Passport could not read them — not "nobody has shared one". */
  readonly initial: readonly SharedPlan[] | null;
  readonly canShare: boolean;
  readonly withInterest: boolean;
  /** Where "build one" goes — a gathering starts from its own town. */
  readonly goHref?: string;
}) {
  const [plans, setPlans] = useState(initial);
  // A fresh server answer — another member shared a day and `LiveBoard`
  // refreshed the page — replaces whatever this component last held.
  const [answered, setAnswered] = useState(initial);
  if (initial !== answered) {
    setAnswered(initial);
    setPlans(initial);
  }

  async function withdraw(plan: SharedPlan) {
    try {
      const response = await fetch(
        `/api/boards/${encodeURIComponent(boardId)}/plans?id=${encodeURIComponent(plan.id)}`,
        { method: "DELETE" },
      );
      if (!response.ok) throw new Error(String(response.status));
      setPlans(await response.json());
    } catch {
      toast.error("Couldn't take that day down. Please try again.");
    }
  }

  return (
    <section aria-labelledby="shared-days" className="flex flex-col gap-4">
      <div>
        <h2
          id="shared-days"
          className="flex items-center gap-2 text-xl font-semibold"
        >
          <Route className="h-5 w-5" aria-hidden />
          Days to have together
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Days somebody on this board built and shared. Saying you&apos;re in is
          a raised hand, not a booking — nobody is holding you to it.
        </p>
      </div>

      {plans === null ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-5 text-sm">
          Passport can&apos;t share days on this board yet. Nothing has been
          lost.
        </p>
      ) : plans.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-5 text-sm">
          No days shared yet.
          {canShare && (
            <>
              {" "}
              <Link className="underline" href={goHref}>
                Build one in Go have a day
              </Link>{" "}
              and share it here.
            </>
          )}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="flex flex-col gap-3 rounded-xl border p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{plan.title}</h3>
                  <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                    <span>
                      {plan.stops} {plan.stops === 1 ? "stop" : "stops"}
                    </span>
                    {plan.on && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                        {planDateLine(plan.on)}
                      </span>
                    )}
                    <span>
                      {plan.yours
                        ? "Shared by you"
                        : plan.sharedBy
                          ? `Shared by ${plan.sharedBy}`
                          : "Shared without a name"}
                    </span>
                  </p>
                </div>
                {plan.canWithdraw && (
                  <button
                    type="button"
                    onClick={() => withdraw(plan)}
                    aria-label={`Take down ${plan.title}`}
                    className="text-muted-foreground hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </div>

              {withInterest && (
                <InterestToggle
                  itemId={plan.itemId}
                  title={plan.title}
                  verb="in"
                />
              )}

              <Link
                href={plan.href}
                className="text-primary inline-flex items-center gap-1.5 self-start text-sm font-medium"
              >
                <Printer className="h-4 w-4" aria-hidden />
                Open the day
              </Link>
            </li>
          ))}
        </ul>
      )}

      {plans !== null && canShare && (
        <ShareDayForm boardId={boardId} onShared={setPlans} />
      )}
    </section>
  );
}

/**
 * Share a day by its link — the address of the printed guide.
 *
 * Used here, where somebody has the board open and a day in another tab, and
 * by `ShareDayToBoard`, which `/go` can place beside *Print our adventure*
 * with the link already filled in.
 */
export function ShareDayForm({
  boardId,
  link: given,
  onShared,
}: {
  readonly boardId: string;
  readonly link?: string;
  readonly onShared?: (plans: SharedPlan[]) => void;
}) {
  const [link, setLink] = useState(given ?? "");
  const [title, setTitle] = useState("");
  const [showName, setShowName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function share(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch(
        `/api/boards/${encodeURIComponent(boardId)}/plans`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ link, title, showName }),
        },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setProblem(
          typeof body?.message === "string"
            ? body.message
            : typeof body?.error === "string"
              ? body.error
              : "Couldn't share that day. Please try again.",
        );
        return;
      }
      toast.success("Shared. Everyone on the board can see it.");
      setTitle("");
      if (!given) setLink("");
      onShared?.(body);
    } catch {
      setProblem("Couldn't share that day. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={share}
      className="flex flex-col gap-3 rounded-xl border p-4 text-sm"
    >
      <p className="font-medium">Share a day with this board</p>
      {!given && (
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">
            The link to a printed day from Go have a day
          </span>
          <input
            type="text"
            inputMode="url"
            required
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="/go/print?stops=…"
            className="min-h-11 rounded-lg border px-3"
          />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">
          Call it something (optional)
        </span>
        <input
          type="text"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Saturday before the game"
          className="min-h-11 rounded-lg border px-3"
        />
      </label>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4"
          checked={showName}
          onChange={(e) => setShowName(e.target.checked)}
        />
        <span>
          Show my name beside it.{" "}
          <span className="text-muted-foreground">
            Off, it&apos;s shared without one. Everyone on the board sees the
            day, including what it was built from — the sentence, the town, and
            any age you gave.
          </span>
        </span>
      </label>
      <button
        type="submit"
        disabled={busy || !link.trim()}
        className="bg-primary text-primary-foreground min-h-11 self-start rounded-full px-5 font-medium disabled:opacity-60"
      >
        {busy ? "Sharing…" : "Share this day"}
      </button>
      {problem && (
        <p className="text-red-700" role="alert">
          {problem}
        </p>
      )}
    </form>
  );
}

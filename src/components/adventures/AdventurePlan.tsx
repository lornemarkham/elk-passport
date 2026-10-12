"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ItemView } from "@/lib/adventures/store";
import type { ResponseValue } from "@/lib/adventures/rules";
import {
  momentLabel,
  responsesLabel,
  whenLabel,
} from "@/lib/adventures/present";
import { cn } from "@/lib/utils";

/**
 * **The group's plan: what's proposed, what's on, and who's in.**
 *
 * Anyone in the adventure proposes; the person who started it confirms.
 * Each person answers in, maybe or out for themselves. An Atlas thing shows
 * by the name Atlas gives it (`atlasNames`); a place Atlas doesn't hold
 * shows in the group's own words.
 *
 * Same component for every kind — a Hockey Night's pregame spot and a
 * conference's Thursday dinner are both items on a plan.
 */
const ANSWERS: readonly { value: ResponseValue; label: string }[] = [
  { value: "in", label: "I'm in" },
  { value: "maybe", label: "Maybe" },
  { value: "out", label: "Out" },
];

export function AdventurePlan({
  adventureId,
  isOwner,
  items,
  atlasNames,
  timeZone,
}: {
  adventureId: string;
  isOwner: boolean;
  items: readonly ItemView[];
  atlasNames: Readonly<Record<string, string>>;
  timeZone: string | null;
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [onDay, setOnDay] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error ?? "That didn't work.");
    }
  }

  async function propose(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await call(`/api/adventures/${adventureId}/items`, "POST", {
        label: label || null,
        note: note || null,
        onDay: onDay || null,
      });
      setLabel("");
      setNote("");
      setOnDay("");
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(work: () => Promise<void>) {
    try {
      await work();
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const base = `/api/adventures/${adventureId}/items`;

  return (
    <section aria-labelledby="plan-heading" className="space-y-4">
      <h2 id="plan-heading" className="text-lg font-semibold">
        The plan
      </h2>

      {items.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
          Nothing on the plan yet. Throw something in.
        </p>
      ) : (
        <ol className="space-y-3" aria-label="Plan">
          {items.map((item) => {
            const name =
              item.label ??
              (item.atlasRef ? atlasNames[item.atlasRef] : undefined) ??
              (item.atlasRef ? "A place Passport can't name right now" : null);
            const when = item.startsAt
              ? momentLabel(item.startsAt, timeZone)
              : whenLabel(item.onDay, null);
            const counts = responsesLabel(item.responses);
            return (
              <li
                key={item.id}
                className="rounded-xl border p-4"
                data-testid="plan-item"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    {name && <p className="font-medium">{name}</p>}
                    {item.note && (
                      <p className="text-muted-foreground text-sm">
                        {item.note}
                      </p>
                    )}
                    <p className="text-muted-foreground mt-1 text-xs">
                      {item.status === "confirmed" ? "On" : "Proposed"}
                      {when ? ` · ${when}` : ""}
                      {counts ? ` · ${counts}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {isOwner && item.status === "proposed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          act(() =>
                            call(`${base}/${item.id}`, "PATCH", {
                              status: "confirmed",
                            }),
                          )
                        }
                      >
                        Confirm
                      </Button>
                    )}
                    {item.canChange && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          act(() => call(`${base}/${item.id}`, "DELETE"))
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
                <div
                  className="mt-3 flex gap-2"
                  role="group"
                  aria-label={`Your answer${name ? ` on ${name}` : ""}`}
                >
                  {ANSWERS.map((answer) => {
                    const chosen = item.yourResponse === answer.value;
                    return (
                      <button
                        key={answer.value}
                        type="button"
                        aria-pressed={chosen}
                        onClick={() =>
                          act(() =>
                            call(`${base}/${item.id}/response`, "PUT", {
                              response: chosen ? null : answer.value,
                            }),
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs transition-colors",
                          chosen
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-muted",
                        )}
                      >
                        {answer.label}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <form
        onSubmit={propose}
        className="space-y-3 rounded-xl border border-dashed p-4"
        aria-label="Propose something"
      >
        <p className="text-sm font-medium">
          {isOwner ? "Add to the plan" : "Propose something"}
        </p>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div className="space-y-1.5">
            <Label htmlFor="item-label">What or where</Label>
            <Input
              id="item-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={120}
              placeholder="Pregame at the pub on Abbott"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-day">Day (optional)</Label>
            <Input
              id="item-day"
              type="date"
              value={onDay}
              onChange={(e) => setOnDay(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-note">Note (optional)</Label>
          <Input
            id="item-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="Doors at 5"
          />
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={busy || (!label.trim() && !note.trim())}
        >
          {isOwner ? "Add it" : "Propose it"}
        </Button>
      </form>
    </section>
  );
}

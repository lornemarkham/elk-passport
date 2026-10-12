"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADVENTURE_KINDS } from "@/lib/adventures/kinds";
import { cn } from "@/lib/utils";

/**
 * **Start something with other people.**
 *
 * Pick what it is, give it a name, and go. Dates and a place are optional —
 * absent means nobody has said yet, which is a true answer. A Hockey Night
 * can say which game; every other detail comes later, from the group.
 */
export function StartAdventure() {
  const router = useRouter();
  const [kind, setKind] = useState(ADVENTURE_KINDS[0].id);
  const [title, setTitle] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [destination, setDestination] = useState("");
  const [arena, setArena] = useState("");
  const [opponent, setOpponent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHockey = kind === "hockey-night";

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/adventures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          startsOn: startsOn || null,
          destinationLabel: destination || null,
          ...(isHockey && (arena || opponent)
            ? {
                hockey: {
                  arenaLabel: arena || null,
                  awayTeam: opponent || null,
                },
              }
            : {}),
        }),
      });
      if (response.status === 401) {
        window.location.href = "/auth?next=/adventures";
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "Couldn't start it. Please try again.");
        return;
      }
      router.push(`/adventures/${body.id}`);
    } catch {
      setError("Couldn't start it. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={start}
      className="space-y-5 rounded-2xl border p-5"
      aria-label="Start an adventure"
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">What is it?</legend>
        <div className="flex flex-wrap gap-2">
          {ADVENTURE_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
              title={k.blurb}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                kind === k.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "hover:bg-muted",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="adventure-title">Name it</Label>
        <Input
          id="adventure-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          placeholder={
            isHockey
              ? "Canucks vs Wild, the usual crew"
              : "What should everyone call it?"
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="adventure-day">When (optional)</Label>
          <Input
            id="adventure-day"
            type="date"
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="adventure-where">Where (optional)</Label>
          <Input
            id="adventure-where"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            maxLength={120}
            placeholder="Vancouver"
          />
        </div>
      </div>

      {isHockey && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="adventure-arena">Arena (optional)</Label>
            <Input
              id="adventure-arena"
              value={arena}
              onChange={(e) => setArena(e.target.value)}
              maxLength={120}
              placeholder="Rogers Arena"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="adventure-opponent">Against (optional)</Label>
            <Input
              id="adventure-opponent"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
              maxLength={60}
              placeholder="Wild"
            />
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy || !title.trim()}>
        {busy ? "Starting…" : "Start it"}
      </Button>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { ADVENTURE_KINDS, PLANNING_KINDS } from "@/lib/adventures/kinds";
import { MAX_SEED } from "@/lib/adventures/days";
import { whenLabel } from "@/lib/adventures/present";

interface AdventureChoice {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly role: "owner" | "participant";
  readonly startsOn: string | null;
  readonly endsOn: string | null;
}

type Load =
  | { at: "loading" }
  | { at: "ready"; adventures: readonly AdventureChoice[] }
  | { at: "unavailable" };

const KINDS = ADVENTURE_KINDS.filter((k) => PLANNING_KINDS.includes(k.id));

/**
 * **Saved, leading somewhere** (doctrine §2.6, §9): the things somebody
 * chose, turned into a day or put into an adventure.
 *
 * Two ways on, both explicit — nothing is offered unasked (when Passport
 * should offer is §15.5, still open):
 *
 * - **Make a day out of these** opens Go Have a Day with them kept
 *   (`/go?with=`, at most five). It writes nothing; the day is kept there
 *   or not at all (roadmap BRD-02).
 * - **Add to an adventure** puts them on a new or existing adventure as
 *   ideas. An adventure is where a day, a weekend or a longer trip is
 *   planned, shared and come back to.
 *
 * Choosing does not change what anything *is* on Saved: a thing on an
 * adventure is still saved, and is not marked planned or wanted (§15.14).
 */
export function PlanFromSaved({
  chosen,
  titles,
  preselect,
  onClear,
}: {
  readonly chosen: readonly string[];
  /** For saying what was chosen. */
  readonly titles: Readonly<Record<string, string>>;
  /** An adventure the person came from (`/saved?adventure=`). */
  readonly preselect?: string | undefined;
  readonly onClear: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(preselect));
  const [load, setLoad] = useState<Load>({ at: "loading" });
  const [target, setTarget] = useState<string>(preselect ?? "new");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("day");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || load.at !== "loading") return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/adventures");
        if (!response.ok) throw new Error(String(response.status));
        const adventures = (await response.json()) as AdventureChoice[];
        if (cancelled) return;
        setLoad({ at: "ready", adventures });
        if (
          preselect &&
          !adventures.some((a) => a.id === preselect) &&
          target === preselect
        )
          setTarget("new");
      } catch {
        if (!cancelled) setLoad({ at: "unavailable" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, load.at, preselect, target]);

  if (chosen.length === 0 && !open) return null;

  const seed = chosen.slice(0, MAX_SEED);
  const dayHref = `/go?with=${seed.map(encodeURIComponent).join(",")}`;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (chosen.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      let id = target;
      if (target === "new") {
        const response = await fetch("/api/adventures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            title,
            startsOn: startsOn || null,
            endsOn: kind === "day" ? null : endsOn || null,
            atlasRefs: chosen,
          }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Couldn't start it.");
        id = body.id;
      } else {
        const response = await fetch(`/api/adventures/${target}/ideas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ atlasRefs: chosen }),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Couldn't add them.");
      }
      router.push(`/adventures/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const adventures = load.at === "ready" ? load.adventures : [];
  const names = chosen.map((id) => titles[id]).filter(Boolean);

  return (
    <div
      data-testid="plan-from-saved"
      className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-black/15 bg-[#f7ecd3]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p
          className="mr-auto text-sm text-[#2b2015]"
          data-testid="chosen-count"
        >
          {chosen.length === 0
            ? "Choose what to plan with."
            : `${chosen.length} chosen`}
          {names.length > 0 && names.length <= 3 && (
            <span className="text-black/55"> · {names.join(", ")}</span>
          )}
        </p>
        {chosen.length > 0 && (
          <Link
            href={dayHref}
            data-testid="saved-make-day"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/30 px-4 text-sm font-medium hover:bg-black/5"
          >
            Make a day out of{" "}
            {chosen.length > MAX_SEED
              ? `the first ${MAX_SEED}`
              : chosen.length === 1
                ? "it"
                : "these"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        )}
        {chosen.length > 0 && !open && (
          <button
            type="button"
            data-testid="saved-to-adventure"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#111] px-4 text-sm font-medium text-white"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Add to an adventure
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onClear();
          }}
          aria-label="Stop choosing"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-black/50 hover:bg-black/5"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {open && (
        <form
          onSubmit={add}
          aria-label="Add to an adventure"
          className="mt-3 space-y-3 border-t border-black/10 pt-3"
        >
          {load.at === "loading" && (
            <p className="text-sm text-black/55">
              Looking for your adventures…
            </p>
          )}
          {load.at === "unavailable" && (
            <p
              className="text-sm text-black/70"
              data-testid="adventures-unavailable"
            >
              Adventures can&apos;t be reached right now. You can still make a
              day out of these.
            </p>
          )}
          {load.at === "ready" && (
            <>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Add them to</legend>
                {adventures.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="target"
                      value={a.id}
                      checked={target === a.id}
                      onChange={() => setTarget(a.id)}
                    />
                    <span>
                      {a.title}
                      <span className="text-black/50">
                        {[
                          whenLabel(a.startsOn, a.endsOn),
                          a.role === "participant" ? "as suggestions" : null,
                        ]
                          .filter(Boolean)
                          .map((s) => ` · ${s}`)
                          .join("")}
                      </span>
                    </span>
                  </label>
                ))}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="target"
                    value="new"
                    checked={target === "new"}
                    onChange={() => setTarget("new")}
                  />
                  A new adventure
                </label>
              </fieldset>

              {target === "new" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-sm sm:col-span-2">
                    <span className="font-medium">Name it</span>
                    <input
                      required
                      value={title}
                      maxLength={120}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Saturday with the kids"
                      className="block min-h-11 w-full rounded-xl border border-black/20 bg-white px-3"
                    />
                  </label>
                  <fieldset className="space-y-1 text-sm sm:col-span-2">
                    <legend className="font-medium">How long</legend>
                    <div className="flex flex-wrap gap-2">
                      {KINDS.map((k) => (
                        <label
                          key={k.id}
                          className={`inline-flex min-h-10 cursor-pointer items-center rounded-full border px-3 ${kind === k.id ? "border-[#111] bg-[#111] text-white" : "border-black/25"}`}
                        >
                          <input
                            type="radio"
                            name="kind"
                            value={k.id}
                            checked={kind === k.id}
                            onChange={() => setKind(k.id)}
                            className="sr-only"
                          />
                          {k.id === "day" ? "A day" : k.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium">
                      {kind === "day"
                        ? "Which day (optional)"
                        : "From (optional)"}
                    </span>
                    <input
                      type="date"
                      value={startsOn}
                      onChange={(e) => setStartsOn(e.target.value)}
                      className="block min-h-11 w-full rounded-xl border border-black/20 bg-white px-3"
                    />
                  </label>
                  {kind !== "day" && (
                    <label className="space-y-1 text-sm">
                      <span className="font-medium">To (optional)</span>
                      <input
                        type="date"
                        value={endsOn}
                        min={startsOn || undefined}
                        onChange={(e) => setEndsOn(e.target.value)}
                        className="block min-h-11 w-full rounded-xl border border-black/20 bg-white px-3"
                      />
                    </label>
                  )}
                </div>
              )}

              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              <button
                type="submit"
                data-testid="saved-add-adventure"
                disabled={
                  busy ||
                  chosen.length === 0 ||
                  (target === "new" && !title.trim())
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#111] px-5 text-sm font-medium text-white disabled:opacity-50"
              >
                {target === "new" ? "Start it" : "Add them"}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, X } from "lucide-react";
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

/**
 * **Saved, leading somewhere** (doctrine §2.6, §9): the things somebody
 * chose, turned into a day or put into an adventure.
 *
 * Three ways on, all explicit — nothing is offered unasked (when Passport
 * should offer is §15.5, still open):
 *
 * - **Build an adventure with these** opens the guided start
 *   (`/adventures/new?with=`), which sketches real days around them
 *   (ADR 012). There is one way to start an adventure, not two forms.
 * - **Add to one I've started** puts them on an existing adventure as ideas.
 * - **Just make a day out of these** opens Go Have a Day with them kept
 *   (`/go?with=`, at most five). It writes nothing; the day is kept there
 *   or not at all (roadmap BRD-02).
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
  const [target, setTarget] = useState<string>(preselect ?? "");
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
          setTarget("");
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
  const buildHref = `/adventures/new?with=${chosen.slice(0, 12).map(encodeURIComponent).join(",")}`;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (chosen.length === 0 || !target) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/adventures/${target}/ideas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atlasRefs: chosen }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Couldn't add them.");
      router.push(`/adventures/${target}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const adventures = load.at === "ready" ? load.adventures : [];
  const names = chosen.map((id) => titles[id]).filter(Boolean);

  const startedHere = adventures;

  return (
    <div
      data-testid="plan-from-saved"
      className="sticky bottom-0 z-20 -mx-4 mt-8 max-h-[80vh] overflow-y-auto border-t border-[var(--gh-line)] bg-white/95 px-4 py-4 shadow-[0_-12px_30px_-20px_rgba(0,0,0,0.35)] backdrop-blur sm:mx-0 sm:rounded-3xl sm:border"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p
          className="mr-auto text-base font-semibold text-[var(--gh-ink)]"
          data-testid="chosen-count"
        >
          {chosen.length === 0
            ? "Choose what to plan with."
            : `${chosen.length} chosen`}
          {names.length > 0 && names.length <= 3 && (
            <span className="font-normal text-[var(--gh-ink-soft)]">
              {" "}
              · {names.join(", ")}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onClear();
          }}
          aria-label="Stop choosing"
          className="inline-flex h-12 w-12 items-center justify-center rounded-full text-[var(--gh-ink-soft)] hover:bg-[var(--gh-cream)]"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {chosen.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={buildHref}
            data-testid="saved-build-adventure"
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--gh-ink)] px-5 text-base font-semibold text-white hover:bg-black"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Build an adventure with {chosen.length === 1 ? "it" : "these"}
          </Link>
          {!open && (
            <button
              type="button"
              data-testid="saved-to-adventure"
              onClick={() => setOpen(true)}
              className="inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-[var(--gh-ink)]/15 bg-white px-5 text-base font-semibold text-[var(--gh-ink)] hover:border-[var(--gh-ink)]/40"
            >
              Add to one I&apos;ve started
            </button>
          )}
          <Link
            href={dayHref}
            data-testid="saved-make-day"
            className="inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-base font-semibold text-[var(--gh-ink)] underline-offset-4 hover:underline"
          >
            Just make a day out of{" "}
            {chosen.length > MAX_SEED
              ? `the first ${MAX_SEED}`
              : chosen.length === 1
                ? "it"
                : "these"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}

      {open && (
        <form
          onSubmit={add}
          aria-label="Add to an adventure"
          className="mt-4 space-y-3 border-t border-[var(--gh-line)] pt-4"
        >
          {load.at === "loading" && (
            <p className="text-base text-[var(--gh-ink-soft)]">
              Looking for your adventures…
            </p>
          )}
          {load.at === "unavailable" && (
            <p
              className="text-base text-[var(--gh-ink-soft)]"
              data-testid="adventures-unavailable"
            >
              Adventures can&apos;t be reached right now. You can still make a
              day out of these.
            </p>
          )}
          {load.at === "ready" && startedHere.length === 0 && (
            <p className="text-base text-[var(--gh-ink-soft)]">
              You haven&apos;t started one yet —{" "}
              <Link href={buildHref} className="font-semibold underline">
                build one with these
              </Link>
              .
            </p>
          )}
          {load.at === "ready" && startedHere.length > 0 && (
            <>
              <fieldset className="space-y-2">
                <legend className="text-base font-semibold">Add them to</legend>
                {startedHere.map((a) => (
                  <label
                    key={a.id}
                    className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 text-base ${target === a.id ? "border-[var(--gh-forest)] bg-[var(--gh-forest-soft)]" : "border-[var(--gh-line)]"}`}
                  >
                    <input
                      type="radio"
                      name="target"
                      value={a.id}
                      checked={target === a.id}
                      onChange={() => setTarget(a.id)}
                      className="h-5 w-5 accent-[var(--gh-forest)]"
                    />
                    <span>
                      <span className="font-semibold">{a.title}</span>
                      <span className="text-[var(--gh-ink-soft)]">
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
              </fieldset>
              {error && (
                <p role="alert" className="text-base text-red-700">
                  {error}
                </p>
              )}
              <button
                type="submit"
                data-testid="saved-add-adventure"
                disabled={busy || chosen.length === 0 || !target}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--gh-forest)] px-6 text-base font-semibold text-white disabled:opacity-50"
              >
                Add them
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { createBoard, saveExperienceToBoard } from "@/lib/data/boards-repo";

export interface CollectionChoice {
  readonly id: string;
  readonly name: string;
}

/**
 * **Organise later, if at all** (owner brief, 2026-11-08, P3): a collection
 * is an optional group of ideas. Saving never needs one; this is how a person
 * makes one afterwards — empty, or from the ideas they have chosen — or puts
 * chosen ideas into one they already have.
 *
 * A collection is a board, the same thing `/boards/:id` shares and manages,
 * so nothing new is stored. Putting an idea in a collection leaves it in
 * Ideas: Ideas is everything saved, wherever it lives.
 */
export function AddToCollection({
  collections,
  chosen = [],
  onDone,
}: {
  /** Collections this person may add to. */
  readonly collections: readonly CollectionChoice[];
  /** Ideas to put in it. Empty makes an empty collection. */
  readonly chosen?: readonly string[];
  readonly onDone?: () => void;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<string>(
    collections.length > 0 && chosen.length > 0 ? "" : "new",
  );
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const making = target === "new";
    if (making && !name.trim()) {
      setError("Give it a name — anything you'll recognise later.");
      return;
    }
    if (!making && !target) {
      setError("Choose a collection, or make a new one.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const boardId = making ? (await createBoard(name.trim())).id : target;
      for (const id of chosen) await saveExperienceToBoard(boardId, id);
      const called = making
        ? name.trim()
        : (collections.find((c) => c.id === target)?.name ?? "it");
      toast.success(
        chosen.length === 0
          ? `${called} is ready. Put things in it whenever you like.`
          : `${chosen.length === 1 ? "It's" : `${chosen.length} ideas are`} in ${called} now — and still in Ideas.`,
      );
      setName("");
      onDone?.();
      router.refresh();
    } catch {
      setError("Couldn't do that just now. Nothing was lost — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      aria-label={chosen.length > 0 ? "Put in a collection" : "New collection"}
      data-testid="add-to-collection"
      className="space-y-3"
    >
      {chosen.length > 0 && collections.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-base font-semibold">Put them in</legend>
          {collections.map((c) => (
            <label
              key={c.id}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 text-base ${target === c.id ? "border-[var(--gh-forest)] bg-[var(--gh-forest-soft)]" : "border-[var(--gh-line)]"}`}
            >
              <input
                type="radio"
                name="collection"
                value={c.id}
                checked={target === c.id}
                onChange={() => setTarget(c.id)}
                className="h-5 w-5 accent-[var(--gh-forest)]"
              />
              <span className="font-semibold">{c.name}</span>
            </label>
          ))}
          <label
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 text-base ${target === "new" ? "border-[var(--gh-forest)] bg-[var(--gh-forest-soft)]" : "border-[var(--gh-line)]"}`}
          >
            <input
              type="radio"
              name="collection"
              value="new"
              checked={target === "new"}
              onChange={() => setTarget("new")}
              className="h-5 w-5 accent-[var(--gh-forest)]"
            />
            <span className="font-semibold">A new collection</span>
          </label>
        </fieldset>
      )}
      {target === "new" && (
        <label className="block">
          <span className="text-sm font-semibold text-[var(--gh-ink)]">
            Name it
          </span>
          <input
            type="text"
            data-testid="collection-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Okanagan wine weekend, Rainy-day stuff…"
            className="mt-1 block min-h-12 w-full rounded-full border-2 border-[var(--gh-line)] bg-white px-4 text-base outline-none focus:border-[var(--gh-ink)]"
          />
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        data-testid="collection-submit"
        disabled={busy}
        className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--gh-forest)] px-6 text-base font-semibold text-white disabled:opacity-50"
      >
        <FolderPlus className="h-4 w-4" aria-hidden />
        {target === "new"
          ? chosen.length > 0
            ? "Make it and put them in"
            : "Make the collection"
          : "Put them in"}
      </button>
    </form>
  );
}

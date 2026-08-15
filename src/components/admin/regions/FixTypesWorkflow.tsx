"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronRight, Loader2, SkipForward } from "lucide-react";
import { RegionDrawer } from "./RegionDrawer";

/**
 * **Fix types — one entity at a time, without leaving the region.**
 *
 * ## Why this is real and not a placeholder
 *
 * It posts to `/api/admin/entities/:id/set-type`, which composes
 * `EnrichmentService.applyEnrichment` — the same path the enrichment
 * panel uses. Applying a type therefore does what every curator edit in
 * Atlas does: sets the field, **writes a `passport-editorial` source
 * record saying a curator decided it**, and links that record to the
 * entity with `describes`.
 *
 * That is what makes a hand-set type honest rather than a silent field
 * mutation. Atlas's standing rule is that provenance survives every
 * transformation; a curator's judgement is not something a web page
 * published, so it becomes its own evidence rather than being attributed
 * to a source that never said it.
 *
 * ## Atlas does not suggest a type here, and that is deliberate
 *
 * The brief asked for *"Atlas suggests: Restaurant · 95%"*. **Atlas has
 * no such suggestion and no such confidence**, and manufacturing either
 * would be the exact failure this codebase has spent the week removing —
 * a number that looks like evidence.
 *
 * What Atlas genuinely has is an `overview` research profile that reads a
 * source and reports what a place is. Running it per entity from the
 * region is real work for a later change; until then the curator decides,
 * with the entity's real evidence in front of them and a link to open it
 * properly.
 *
 * The vocabulary offered is **the types this corpus already uses**,
 * gathered from entities of the same kind — never a taxonomy invented
 * here. Atlas keeps source-native words on purpose (ADR 017), so the list
 * shows what the region actually says, and free text is always allowed.
 */

export interface UntypedEntity {
  id: string;
  name: string;
  kind: string;
  sourceCount: number;
  /** A source that describes it — context for the decision, never a claim it said the type. */
  sourceRecordId: string | null;
  sourceLabel: string | null;
}

export function FixTypesWorkflow({
  trigger,
  untyped,
  knownTypes,
}: {
  trigger: (open: () => void) => React.ReactNode;
  untyped: UntypedEntity[];
  /** Types already used by entities of each kind, in this corpus. */
  knownTypes: Record<string, string[]>;
}) {
  return (
    <RegionDrawer
      wide
      title="Fix missing types"
      description="A type is what kind of place something is. It decides which layout a page gets, which facts count as complete, and which research Atlas runs — so an untyped entity cannot be improved systematically."
      trigger={trigger}
    >
      <FixTypesBody untyped={untyped} knownTypes={knownTypes} />
    </RegionDrawer>
  );
}

function FixTypesBody({
  untyped,
  knownTypes,
}: {
  untyped: UntypedEntity[];
  knownTypes: Record<string, string[]>;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState("");

  const remaining = untyped.filter((e) => !done[e.id]);
  const current = remaining[Math.min(index, remaining.length - 1)];

  if (untyped.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Every entity in this region has a type. Nothing to do here.
      </p>
    );
  }

  if (!current) {
    return (
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
          All done — {Object.keys(done).length} type
          {Object.keys(done).length === 1 ? "" : "s"} set
        </p>
        <ul className="mt-3 flex flex-col gap-1">
          {Object.entries(done).map(([id, type]) => (
            <li key={id} className="text-[13px]">
              <span className="text-muted-foreground">
                {untyped.find((e) => e.id === id)?.name}
              </span>{" "}
              → <span className="font-medium">{type}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-4 text-[13px] leading-relaxed">
          Each one was recorded as an editorial source record saying a curator
          decided it — Atlas never files a hand-set value as something a web
          page published. Close this panel to see the region update.
        </p>
      </div>
    );
  }

  const options = knownTypes[current.kind] ?? [];

  const apply = async (type: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/entities/${current.id}/set-type`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: current.kind,
          type,
          sourceRecordId: current.sourceRecordId,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Atlas refused the change.");
        return;
      }
      setDone((d) => ({ ...d, [current.id]: type }));
      setCustom("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach Atlas.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="text-muted-foreground text-[13px]">
        Entity {Object.keys(done).length + 1} of {untyped.length}
      </p>

      <h3 className="mt-1 text-lg font-semibold tracking-tight">
        {current.name}
      </h3>
      <p className="text-muted-foreground mt-1 text-[13px]">
        {current.kind} ·{" "}
        {current.sourceCount === 0
          ? "no sources"
          : `${current.sourceCount} source${current.sourceCount === 1 ? "" : "s"}`}{" "}
        ·{" "}
        <Link
          href={`/admin/entities/${current.id}`}
          className="underline-offset-4 hover:underline"
        >
          Open it to see everything Atlas knows
        </Link>
      </p>

      {/* No suggestion, and the reason is stated rather than left as a
          silence a curator has to interpret. */}
      <p className="text-muted-foreground border-border mt-4 rounded-lg border border-dashed px-4 py-3 text-[13px] leading-relaxed">
        Atlas is not suggesting a type. It has an <code>overview</code> research
        profile that can read a source and report what a place is, but running
        it per entity from here is not built — and a guessed type with an
        invented confidence score would be worse than no suggestion.
      </p>

      {current.sourceRecordId === null && (
        <p className="mt-4 text-[13px] text-amber-700 dark:text-amber-400">
          Nothing describes this entity yet, so Atlas has no evidence to attach
          the decision to and will refuse the change. Grow the region first, or
          open the entity and add a source.
        </p>
      )}

      <p className="text-muted-foreground mt-5 text-[13px] font-medium">
        Types already used by {current.kind}s in Atlas:
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.length === 0 ? (
          <span className="text-muted-foreground text-[13px]">
            None yet — this would be the first.
          </span>
        ) : (
          options.map((t) => (
            <button
              key={t}
              disabled={busy || current.sourceRecordId === null}
              onClick={() => void apply(t)}
              className="border-border hover:border-foreground/40 hover:bg-muted rounded-md border px-2.5 py-1 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t}
            </button>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Or type your own…"
          className="border-border h-9 min-w-[200px] flex-1 rounded-md border px-3 text-sm"
        />
        <button
          disabled={busy || !custom.trim() || current.sourceRecordId === null}
          onClick={() => void apply(custom.trim())}
          className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Set type
        </button>
        <button
          disabled={busy}
          onClick={() => setIndex((i) => i + 1)}
          className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors"
        >
          <SkipForward className="h-3.5 w-3.5" />
          Skip
        </button>
      </div>

      {error && (
        <p className="mt-3 text-[13px] text-amber-700 dark:text-amber-400">
          {error}
        </p>
      )}

      {Object.keys(done).length > 0 && (
        <p className="text-muted-foreground mt-5 flex items-center gap-1.5 text-[13px]">
          <ChevronRight className="h-3.5 w-3.5" />
          {Object.keys(done).length} set so far this session
        </p>
      )}
    </div>
  );
}

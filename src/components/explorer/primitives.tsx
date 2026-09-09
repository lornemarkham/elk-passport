import Link from "next/link";
import type { ReactNode } from "react";
import type {
  DossierEntityRef,
  EntityKindName,
} from "@/lib/data/explorer-dossier-repo";

/**
 * The Explorer's small vocabulary of shapes.
 *
 * Deliberately plain: this is an instrument, and an instrument that
 * decorates its readings is harder to read. What earns colour here is
 * *kind* (so the eye can sort a list of forty relationships) and *warning*
 * (so an odd edge is findable without reading every row). Nothing else.
 */

const KIND_CLASS: Record<EntityKindName, string> = {
  Place: "bg-emerald-500/12 text-emerald-800 dark:text-emerald-300",
  Organization: "bg-sky-500/12 text-sky-800 dark:text-sky-300",
  Activity: "bg-violet-500/12 text-violet-800 dark:text-violet-300",
  Event: "bg-amber-500/15 text-amber-900 dark:text-amber-300",
  Experience: "bg-rose-500/12 text-rose-800 dark:text-rose-300",
};

export function KindBadge({ kind }: { kind: EntityKindName }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
        KIND_CLASS[kind] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {kind}
    </span>
  );
}

/** A fact about the graph worth noticing. Never a verdict — the row stays. */
export function Flag({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-orange-800 uppercase dark:text-orange-300">
      {children}
    </span>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="bg-muted text-foreground/80 rounded px-1.5 py-0.5 text-[11px]">
      {children}
    </span>
  );
}

/** Ids are for copying and comparing, so they are monospace and selectable. */
export function Id({ value }: { value: string }) {
  return (
    <code className="text-muted-foreground font-mono text-[11px] break-all select-all">
      {value}
    </code>
  );
}

export function Panel({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="border-border/70 rounded-lg border">
      <header className="border-border/70 flex items-baseline gap-2 border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {count !== undefined && (
          <span className="text-muted-foreground font-mono text-xs">
            {count}
          </span>
        )}
        {subtitle && (
          <span className="text-muted-foreground ml-auto text-xs">
            {subtitle}
          </span>
        )}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

/**
 * One stored field.
 *
 * An absent field is drawn as absent rather than omitted — "Atlas has no
 * hours for this" is one of the most useful things this tool can say, and a
 * missing row says nothing at all.
 */
export function Field({
  label,
  children,
  empty,
  emptyLabel = "not stored",
}: {
  label: string;
  children?: ReactNode;
  empty?: boolean;
  /**
   * What absence means here. The default suits Atlas's own fields, where
   * nothing stored is the whole statement. It is overridden in the Passport
   * lens, where a missing card destination is not an unstored field — it is
   * Passport having nowhere to send anyone.
   */
  emptyLabel?: string;
}) {
  return (
    <div className="border-border/40 grid grid-cols-[10rem_1fr] gap-3 border-b py-1.5 last:border-b-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd
        className={`text-sm ${empty ? "text-muted-foreground/50 italic" : ""}`}
      >
        {empty ? emptyLabel : children}
      </dd>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground/70 py-1 text-sm italic">{children}</p>
  );
}

/** Every related entity is a link — navigating the graph is the whole point. */
export function EntityLink({
  entity,
  className = "",
}: {
  entity: DossierEntityRef;
  className?: string;
}) {
  return (
    <Link
      href={`/explorer/${entity.id}`}
      className={`hover:bg-muted/60 group flex min-w-0 items-center gap-2 rounded px-1.5 py-1 ${className}`}
    >
      <KindBadge kind={entity.kind} />
      <span className="group-hover:text-foreground truncate text-sm underline-offset-2 group-hover:underline">
        {entity.name}
      </span>
      {entity.subtype && (
        <span className="text-muted-foreground shrink-0 text-xs">
          {entity.subtype}
        </span>
      )}
      {entity.isRegion && <Chip>region</Chip>}
      {entity.archived && <Flag>archived</Flag>}
    </Link>
  );
}

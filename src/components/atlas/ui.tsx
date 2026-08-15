import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * **The Atlas design system.**
 *
 * One place every admin page composes from, so consistency is the default
 * rather than something each page has to remember.
 *
 * ## The principles, borrowed from Linear — the language, not the brand
 *
 * **The interface disappears behind the information.** Atlas is an internal
 * knowledge tool; the data is the hero. Nothing here draws attention to
 * itself: no shadows, no gradients, no coloured panels, no decoration that
 * is not carrying meaning.
 *
 * **Rows, not cards.** A card is a box drawn around content, and a page of
 * boxes is a page of borders. Lists share one hairline border and separate
 * their items with dividers, which is quieter and scans faster. Cards
 * survive only where something genuinely is a discrete object.
 *
 * **One type scale, four steps.** Page title, section title, body, meta.
 * Everything else is weight or colour. Most secondary text is
 * `text-muted-foreground` at 13px, which is the single biggest contributor
 * to calm.
 *
 * **Space carries the hierarchy, borders do not.** Sections are separated
 * by generous vertical rhythm rather than by drawing more lines. A border
 * appears when something is a surface you act inside; never as decoration.
 *
 * **Restraint with colour.** Neutral by default. Colour means status and
 * nothing else — emerald for something resolved, amber for something
 * needing a human. A page with no state to report is entirely greyscale,
 * and that is correct.
 *
 * **Numbers are tabular.** Anything that could be compared vertically uses
 * `tabular-nums` so digits line up.
 */

/* -------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------- */

/**
 * The top of every page: where you came from, what this is, one action.
 *
 * The description is deliberately one line. A paragraph at the top of a
 * page is documentation, and documentation at the top of every page is how
 * an interface starts explaining itself instead of being obvious.
 */
export function PageHeader({
  back,
  title,
  description,
  action,
}: {
  back?: { href: string; label: string };
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-6">
      {back && (
        <Link
          href={back.href}
          className="text-muted-foreground hover:text-foreground -ml-1 inline-flex w-fit items-center gap-1 text-[13px] transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground mt-1.5 text-[13px]">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}

/** A titled block. Space separates sections; the title does not need a rule under it. */
export function Section({
  title,
  description,
  action,
  children,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      {(title || action) && (
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-[13px] font-medium tracking-wide uppercase">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-muted-foreground mt-1 text-[13px]">
                {description}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------
 * Lists — the workhorse
 * ---------------------------------------------------------------------- */

/** One hairline border around the group, dividers between items. Not a stack of cards. */
export function List({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
      {children}
    </div>
  );
}

/**
 * A row. Navigable when `href` is given, inert otherwise.
 *
 * The chevron appears only on navigable rows, and only on hover — an
 * affordance that is always visible is decoration on every row that is not
 * being pointed at.
 */
export function Row({
  href,
  icon,
  title,
  meta,
  trailing,
}: {
  href?: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const body = (
    <>
      {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {meta && (
          <span className="text-muted-foreground mt-0.5 block text-[13px]">
            {meta}
          </span>
        )}
      </span>
      {trailing}
      {href && (
        <ChevronRight className="text-muted-foreground/0 group-hover:text-muted-foreground h-4 w-4 shrink-0 transition-colors" />
      )}
    </>
  );

  const classes = "flex items-center gap-3 px-4 py-3";
  return href ? (
    <Link
      href={href}
      className={`${classes} hover:bg-muted/40 group transition-colors`}
    >
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

/** Secondary detail, dot-separated. Falsy parts drop out so no stray separators appear. */
export function Meta({
  parts,
}: {
  parts: (string | false | null | undefined)[];
}) {
  const shown = parts.filter(Boolean) as string[];
  return <>{shown.join("  ·  ")}</>;
}

/* -------------------------------------------------------------------------
 * Status
 * ---------------------------------------------------------------------- */

/** Colour means status and nothing else. Neutral is the default and usually correct. */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "positive" | "attention";
}) {
  const tones = {
    neutral: "text-muted-foreground bg-muted",
    positive: "text-emerald-700 bg-emerald-600/10 dark:text-emerald-400",
    attention: "text-amber-700 bg-amber-500/10 dark:text-amber-400",
  } as const;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[12px] font-medium tabular-nums ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * A number with a label, inline.
 *
 * Deliberately small. A KPI block with 36px numerals tells an operator that
 * the number is the point; in Atlas the number is context, and the work is
 * the point.
 */
export function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <span className="text-muted-foreground text-[13px]">
      <span className="text-foreground font-medium tabular-nums">{value}</span>{" "}
      {label}
    </span>
  );
}

/** Status line — several stats, one row, no boxes. */
export function StatLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Empty & code
 * ---------------------------------------------------------------------- */

/**
 * What to show when there is nothing.
 *
 * Always says what is absent **and** what would fix it. An empty state that
 * only says "nothing here" makes the operator guess.
 */
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-border rounded-lg border border-dashed px-5 py-8">
      <p className="text-sm font-medium">{title}</p>
      {children && (
        <div className="text-muted-foreground mt-2 max-w-2xl text-[13px] leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

/** A command. Selectable, monospace, quiet — it is instruction, not decoration. */
export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[12px]">
      {children}
    </code>
  );
}

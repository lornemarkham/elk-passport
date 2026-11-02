import Link from "next/link";
import { MapPin } from "lucide-react";
import { townById } from "@/domain/discovery/towns";
import { cn } from "@/lib/utils";

/** A section with Christmas's heading rhythm. */
export function Section({
  eyebrow,
  title,
  line,
  action,
  children,
  id,
}: {
  readonly eyebrow?: string;
  readonly title: string;
  readonly line?: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          {eyebrow && (
            <p className="text-sm font-bold tracking-[0.14em] text-[#b3242f] uppercase">
              {eyebrow}
            </p>
          )}
          <h2 className="ghad-display mt-1 text-3xl leading-[1] font-extrabold tracking-[-0.03em] text-balance sm:text-4xl">
            {title}
          </h2>
          {line && (
            <p className="mt-2 text-base text-[var(--gh-ink-soft)]">{line}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * The towns a chip offers — the biggest places in each area Passport knows
 * (Discovery's own list, `towns.ts`). The full list is on the Refine form.
 */
const CHIP_TOWNS = [
  "vancouver",
  "north-vancouver",
  "burnaby",
  "richmond",
  "surrey",
  "kelowna",
  "west-kelowna",
  "vernon",
  "penticton",
  "lake-country",
  "big-white",
  "kamloops",
].flatMap((id) => {
  const town = townById(id);
  return town ? [town] : [];
});

/**
 * **Where are you?** One tap, never required. Passport doesn't geolocate
 * here; a town is something the person says (ADR 002: location is
 * situational).
 */
export function TownChips({
  selected,
  hrefFor,
}: {
  readonly selected?: string;
  readonly hrefFor: (id: string | null) => string;
}) {
  return (
    <nav aria-label="Where are you?" data-testid="town-chips">
      <p className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gh-ink-soft)]">
        <MapPin className="h-4 w-4" aria-hidden />
        Where are you?
      </p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
        <Link
          href={hrefFor(null)}
          aria-current={!selected ? "page" : undefined}
          className={chip(!selected)}
        >
          Anywhere
        </Link>
        {CHIP_TOWNS.map((t) => (
          <Link
            key={t.id}
            href={hrefFor(t.id)}
            aria-current={selected === t.id ? "page" : undefined}
            className={chip(selected === t.id)}
          >
            {t.name.replace(/,\s*BC$/, "")}
          </Link>
        ))}
      </div>
    </nav>
  );
}

const chip = (on: boolean) =>
  cn(
    "inline-flex min-h-11 shrink-0 items-center rounded-full border-2 px-4 text-sm font-semibold whitespace-nowrap transition-colors",
    on
      ? "border-[#0f3b2b] bg-[#0f3b2b] text-white"
      : "border-black/10 bg-white hover:border-black/30",
  );

/** Atlas didn't answer — said plainly, never rendered as "nothing on". */
export function AtlasDown() {
  return (
    <p
      role="status"
      data-testid="atlas-down"
      className="rounded-[22px] bg-[#f7e3e1] p-5 text-base font-semibold text-[#8e1d26]"
    >
      Atlas can&apos;t be reached right now, so Passport can&apos;t show
      what&apos;s on. That isn&apos;t the same as nothing being on — try again
      in a minute.
    </p>
  );
}

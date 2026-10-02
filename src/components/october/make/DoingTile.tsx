import Link from "next/link";
import type { Doing } from "@/lib/making/catalogue";
import { KeepOnCard } from "@/components/october/save/KeepOnCard";
import { keepableDoing } from "./keepableDoing";

/**
 * **A Doing with a picture, at one of two weights.**
 *
 * `lead` is the one thing on a shelf that gets to be large. Everything else
 * is a supporting tile. The difference is deliberate and the reason the page
 * stopped being a grid: a grid of equal cards is an inventory however good
 * the photographs are, and somebody showing you what to make points at one
 * thing first.
 *
 * Overlay link, because the whole tile should open it and the save mark has
 * to be a sibling of that link rather than a button inside it.
 */
export function DoingTile({
  doing,
  saved,
  signedIn,
  lead = false,
}: {
  readonly doing: Doing;
  readonly saved: boolean;
  readonly signedIn: boolean;
  readonly lead?: boolean;
}) {
  return (
    <div
      data-testid="doing-tile"
      data-doing-id={doing.id}
      data-lead={lead ? "true" : "false"}
      className="group relative h-full overflow-hidden rounded-xl border border-[#e9e6da]/10 bg-[#e9e6da]/[0.03] transition-colors hover:border-[#d09a4e]/40"
    >
      <Link
        href={`/october/make/${doing.id}`}
        className="absolute inset-0 z-0 rounded-xl focus-visible:ring-1 focus-visible:ring-[#d09a4e] focus-visible:outline-none"
      >
        <span className="sr-only">{doing.title}</span>
      </Link>

      {doing.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={doing.image.src}
          alt={doing.image.alt}
          loading="lazy"
          className={`w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] ${
            // Capped, because a lead that runs the full width of a shelf
            // would otherwise be a billboard you have to scroll past.
            lead ? "aspect-[16/9] max-h-[420px]" : "aspect-[4/3]"
          }`}
        />
      ) : null}

      <div
        className={`relative flex flex-col p-4 ${
          // With no photograph, the tile is carried by the sentence instead of
          // an empty grey rectangle the size of one. An absent picture should
          // read as a decision, not as something that failed to load.
          doing.image ? "" : "min-h-[180px] justify-center gap-1"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h3
            className={`font-heading leading-tight ${
              doing.image
                ? `text-[#f3efe4] ${lead ? "text-2xl sm:text-3xl" : "text-lg"}`
                : "text-[11px] tracking-[0.18em] text-[#d09a4e] uppercase"
            }`}
          >
            {doing.title}
          </h3>
          <KeepOnCard
            thing={keepableDoing(doing)}
            initiallySaved={saved}
            signedIn={signedIn}
            returnTo="/october/make"
          />
        </div>
        <p
          className={
            doing.image
              ? `mt-1.5 leading-relaxed text-[#e9e6da]/60 ${lead ? "text-base" : "text-sm"}`
              : `font-heading leading-snug text-balance text-[#f3efe4] ${lead ? "text-2xl sm:text-3xl" : "text-xl"}`
          }
        >
          {doing.detail?.hook ?? doing.line}
        </p>
        {doing.image ? (
          <p className="mt-2 text-[10px] text-[#e9e6da]/20">
            {doing.image.credit} · {doing.image.licence}
          </p>
        ) : null}
      </div>
    </div>
  );
}

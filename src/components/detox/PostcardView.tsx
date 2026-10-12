import type { Postcard } from "@/lib/detox/outing";

/**
 * **A postcard from a day out.** Off-white card, a stamp corner in the accent,
 * and the person's own words. It is a screen, not a print — the paper half of
 * Go Offline is the guide from `/go/print`, and this does not compete with it.
 */
export function PostcardView({
  card,
  date,
  small = false,
}: {
  readonly card: Postcard;
  /** ISO time the person came back, shown as a date where present. */
  readonly date?: string;
  readonly small?: boolean;
}) {
  return (
    <article
      data-testid="offline-postcard"
      className={`relative h-full rounded-[6px] bg-[#FBF8F2] ring-1 ring-black/10 ring-inset ${
        small ? "p-5" : "p-6 sm:p-9"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-4 right-4 rounded-[3px] border-2 border-dashed ${
          small ? "h-9 w-7" : "h-14 w-11"
        }`}
        style={{ borderColor: "var(--ghad-accent)" }}
      />
      {date && (
        <p className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase tabular-nums">
          {new Intl.DateTimeFormat("en-CA", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }).format(new Date(date))}
        </p>
      )}
      <h3
        className={`ghad-display mt-2 pr-14 leading-[1.02] font-extrabold tracking-[-0.035em] text-[#111] ${
          small ? "text-[20px]" : "text-[30px] sm:text-[40px]"
        }`}
      >
        {card.headline}
      </h3>
      <ul
        className={`mt-4 flex flex-col gap-1.5 leading-relaxed text-black/70 ${
          small ? "text-[13px]" : "text-[16px]"
        }`}
      >
        {card.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </article>
  );
}

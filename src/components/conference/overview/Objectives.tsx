import type { ConferenceObjective } from "@/domain/conference/types";

const TINTS = [
  "bg-[#f3efe6] text-[#5a4426]",
  "bg-[#e9f1ec] text-[#2f4a3a]",
  "bg-[#e8eef3] text-[#24405a]",
  "bg-[#f1e9e6] text-[#5b3530]",
  "bg-[#ece8f0] text-[#463a57]",
  "bg-[#eef0e6] text-[#46502a]",
];

/**
 * **Why we're here** — the organiser's objectives, as a row of five words
 * you can swipe through rather than a slide of bullet points. Each is the
 * organiser's own title and line, in their order; nothing is added.
 */
export function Objectives({
  objectives,
  after = false,
}: {
  objectives: readonly ConferenceObjective[];
  after?: boolean;
}) {
  return (
    <section data-testid="objectives">
      <p className="cf-eyebrow text-cf-mist">
        {after ? "What we came to do" : "Why we're here"}
      </p>
      <ol className="cf-shelf -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
        {objectives.map((o, n) => (
          <li
            key={o.title}
            className={`relative w-[200px] shrink-0 snap-start overflow-hidden rounded-2xl p-4 sm:w-auto ${TINTS[n % TINTS.length]}`}
          >
            <span
              aria-hidden="true"
              className="cf-display pointer-events-none absolute -right-1 -bottom-5 text-[84px] leading-none opacity-[0.12]"
            >
              {n + 1}
            </span>
            <p className="cf-display relative text-[24px] leading-none tracking-tight uppercase">
              {o.title}
            </p>
            {o.line ? (
              <p className="relative mt-3 text-[13px] leading-snug opacity-80">
                {o.line}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

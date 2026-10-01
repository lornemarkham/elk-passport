import type { ConditionRead } from "@/domain/october/conditions";
import { SIMULATED_SOURCE } from "@/lib/environment/scenario";

/**
 * **What you would want to know before leaving the house.**
 *
 * Not a forecast panel. The detail page already knows where this is, what day
 * it is on, when the sun goes down there and what the sky is forecast to do —
 * and the useful form of all that is one short briefing, not four readings.
 *
 * Silent for an indoor thing on an ordinary evening, for anything outside the
 * forecast horizon, and for the 59% of subjects nobody has classified. When it
 * does appear it is because somebody is about to drive somewhere and stand
 * outside in the dark.
 */
export function BeforeYouGo({ read }: { readonly read: ConditionRead }) {
  const simulated = read.source === SIMULATED_SOURCE;
  return (
    <section
      data-testid="before-you-go"
      data-weight={read.weight}
      className="mt-8 rounded-xl border border-[#e9e6da]/10 bg-[#e9e6da]/[0.03] p-4"
    >
      <p className="text-[10px] tracking-[0.14em] text-[#e9e6da]/35 uppercase">
        Before you go
      </p>
      <p
        className={`mt-1.5 text-base leading-relaxed ${
          read.weight === "warning"
            ? "text-[#d09a4e]"
            : read.weight === "good"
              ? "text-[#9ab08f]"
              : "text-[#f3efe4]"
        }`}
      >
        {read.line}
      </p>
      {read.facts ? (
        <p
          data-testid="before-you-go-facts"
          className="mt-1 text-sm text-[#e9e6da]/50"
        >
          {read.facts}
        </p>
      ) : null}
      <p
        className={`mt-2 text-[11px] ${
          simulated
            ? "font-medium tracking-wider text-[#ff6b6b] uppercase"
            : "text-[#e9e6da]/25"
        }`}
      >
        {read.source}
        {read.via ? ` · ${read.via}` : ""}
      </p>
    </section>
  );
}

import type { Doing } from "@/lib/making/catalogue";
import { KeepOnCard } from "@/components/october/save/KeepOnCard";
import { keepableDoing } from "./keepableDoing";

/**
 * **One thing worth making, and the one gesture that puts it in your October.**
 *
 * No photograph, and that is a choice rather than a gap: a stock picture of
 * somebody else's perfect pumpkin is the exact thing that makes a making page
 * feel like a lifestyle site you could never live up to. The line does the
 * work instead, and the only image this product will ever show of a Doing is
 * the one somebody takes after they have done it.
 *
 * Not an overlay-link card either — a Doing has no page to open. There is
 * nothing to read about it; there is only whether you are going to do it.
 */
export function DoingCard({
  doing,
  saved,
  signedIn,
}: {
  readonly doing: Doing;
  readonly saved: boolean;
  readonly signedIn: boolean;
}) {
  return (
    <div
      data-testid="doing-card"
      data-doing-id={doing.id}
      className="flex h-full flex-col rounded-xl border border-[#e9e6da]/10 bg-[#e9e6da]/[0.03] p-4 transition-colors hover:border-[#d09a4e]/40 hover:bg-[#e9e6da]/[0.06]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-heading text-lg leading-tight text-[#f3efe4]">
          {doing.title}
        </h3>
        <KeepOnCard
          thing={keepableDoing(doing)}
          initiallySaved={saved}
          signedIn={signedIn}
          returnTo="/october/make"
        />
      </div>

      <p className="mt-2 text-sm leading-relaxed text-[#e9e6da]/60">
        {doing.line}
      </p>

      {doing.how ? (
        <p className="mt-3 border-l-2 border-[#e9e6da]/12 pl-3 text-sm text-[#e9e6da]/45">
          {doing.how}
        </p>
      ) : null}

      {doing.withKids || doing.takesAnEvening ? (
        <ul className="mt-3 flex flex-wrap gap-x-2 gap-y-1">
          {doing.withKids ? (
            <li className="rounded-full bg-[#e9e6da]/[0.06] px-2 py-0.5 text-[11px] text-[#e9e6da]/55">
              Small hands welcome
            </li>
          ) : null}
          {doing.takesAnEvening ? (
            <li className="rounded-full bg-[#e9e6da]/[0.06] px-2 py-0.5 text-[11px] text-[#e9e6da]/55">
              Give it an evening
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

import Form from "next/form";
import { SubmitButton } from "@/components/loading/SubmitButton";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { QUICK_STARTS } from "@/domain/christmas/request";

/**
 * **"What would you love to do?"** — screen one of the Christmas planner
 * (owner brief, Christmas Experience 2.0). One box and one button; the five
 * quick starts are sentences read the same way as anything typed. A plain
 * form, so it works on a phone before any JavaScript has arrived, and the
 * plan opens at an address that can be shared as it is.
 */
export function PlanHero({ at }: { readonly at?: string }) {
  const withAt = (say: string) => {
    const q = new URLSearchParams({ say });
    if (at) q.set("at", at);
    return `/christmas/itinerary?${q.toString()}`;
  };
  return (
    <div id="plan" className="scroll-mt-24">
      <Form
        action="/christmas/itinerary"
        aria-label="Plan your Christmas adventure"
        data-testid="plan-form"
        className="rounded-[28px] bg-[#fffaf2] p-3 text-[#082319] shadow-[0_18px_50px_rgba(0,0,0,0.35)] sm:p-4"
      >
        {at && <input type="hidden" name="at" value={at} />}
        <label
          htmlFor="plan-input"
          className="block px-2 pt-1 text-sm font-extrabold tracking-[0.08em] text-[#b3242f] uppercase"
        >
          What would you love to do?
        </label>
        <input
          id="plan-input"
          name="say"
          required
          maxLength={240}
          autoComplete="off"
          placeholder="Romantic night of lights, dinner and a movie."
          className="mt-1 min-h-12 w-full rounded-2xl bg-transparent px-2 text-lg font-semibold placeholder:text-[#082319]/40 focus:outline-none sm:text-2xl"
          data-testid="plan-input"
          enterKeyHint="go"
        />
        <SubmitButton
          pending="Making your plan…"
          className="mt-2 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#b3242f] px-6 text-lg font-extrabold text-white shadow-lg hover:brightness-110"
          data-testid="plan-go"
        >
          <Sparkles className="h-5 w-5" aria-hidden />
          Make my Christmas plan
        </SubmitButton>
      </Form>
      <ul
        className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        aria-label="Quick starts"
        data-testid="quick-starts"
      >
        {QUICK_STARTS.map((q) => (
          <li key={q.id} className="shrink-0">
            <Link
              href={withAt(q.say)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur hover:bg-white/25"
              data-testid={`quick-${q.id}`}
            >
              <span aria-hidden>{q.emoji}</span>
              {q.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { planLine } from "@/lib/detox/day";
import { challengeById, stakeSentence } from "@/lib/detox/pact";
import {
  awayFor,
  comeBack,
  dealtIn,
  newOuting,
  postcard,
  type Outing,
} from "@/lib/detox/outing";
import { updateOffline, useOffline } from "@/lib/detox/store";
import { PostcardView } from "./PostcardView";

/**
 * **Welcome back.**
 *
 * The return half: the printed guide ends with *"Come back and tell us what
 * actually happened"* and, until now, nothing received it. This page does —
 * in the person's own words, about the outing as a whole, and kept in this
 * browser only (see `src/lib/detox/outing.ts` for what it deliberately does
 * not record, and why).
 *
 * A few questions, all optional, none of them a rating — and the ones about
 * the pact only if there was one. Then a postcard, and a door back into GO
 * HAVE A DAY for the next one.
 *
 * It asks about the outing, never place by place: whether a stop was "done"
 * or "loved" is lived state, and its vocabulary is open (doctrine §15 Q3,
 * Q14). The plan is shown as context — what you set out to do — not as a
 * checklist to tick.
 */
export function WelcomeBack() {
  const { current } = useOffline();
  const [made, setMade] = useState<Outing | null>(null);
  const [pulledOff, setPulledOff] = useState<string[]>([]);
  const [cracked, setCracked] = useState("");
  const [unplanned, setUnplanned] = useState("");
  const [company, setCompany] = useState("");

  // Somebody can arrive here without having pressed "Phones away" — from the
  // printed guide, say. They still get a welcome and a postcard.
  const outing = current ?? newOuting();
  const dealt = dealtIn(outing);
  const away = awayFor(outing, new Date());

  const finish = () => {
    const done = comeBack(outing, new Date(), {
      pulledOff,
      cracked,
      unplanned,
      company,
    });
    updateOffline((state) => ({
      current: undefined,
      past: [done, ...state.past],
    }));
    setMade(done);
  };

  if (made) {
    return (
      <div className="mx-auto max-w-[46rem] px-4 py-10 sm:px-6 sm:py-16">
        <PostcardView
          card={postcard(made, new Date())}
          {...(made.back ? { date: made.back.at } : {})}
        />
        <p className="mt-6 text-[14px] text-black/50">
          Kept on this device, on the fridge at Go Offline. Nobody else sees it,
          and there&apos;s nothing to share it to.
        </p>
        <div className="mt-10 border-t-2 border-black/80 pt-6">
          <h2 className="ghad-display text-[34px] leading-[0.95] font-extrabold tracking-[-0.045em] text-[#111] sm:text-[56px]">
            Now go have another.
          </h2>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/go"
              data-testid="offline-another"
              style={{
                backgroundColor: "var(--ghad-accent)",
                color: "var(--ghad-accent-ink)",
              }}
              className="inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[15px] font-semibold"
            >
              Plan the next one
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[46rem] px-4 py-10 sm:px-6 sm:py-16">
      <p
        className="text-[11px] font-semibold tracking-[0.12em] uppercase"
        style={{ color: "var(--ghad-accent)" }}
      >
        Go offline
      </p>
      <h1 className="ghad-display mt-2 text-[48px] leading-[0.9] font-extrabold tracking-[-0.05em] text-[#111] sm:text-[80px]">
        Welcome back.
      </h1>
      <p
        data-testid="offline-away"
        className="mt-5 max-w-[54ch] text-[17px] leading-relaxed text-black/65"
      >
        {away && away !== "more than a day"
          ? `Phones were away for ${away}. Whatever's on there can wait another minute.`
          : "Whatever's on your phone can wait another minute."}{" "}
        How did it go?
      </p>
      {outing.day && (
        <p
          data-testid="offline-back-plan"
          className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-black/50"
        >
          The plan was {planLine(outing.day)}. What actually happened is up to
          you.
        </p>
      )}

      <form
        className="mt-10 flex flex-col gap-10"
        onSubmit={(event) => {
          event.preventDefault();
          finish();
        }}
      >
        {dealt.length > 0 && (
          <fieldset>
            <legend className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
              Which ones did you pull off?
            </legend>
            <div className="mt-3 flex flex-col gap-2">
              {dealt.map((id) => {
                const on = pulledOff.includes(id);
                return (
                  <label
                    key={id}
                    className={`flex cursor-pointer items-start gap-3 rounded-2xl p-4 ring-inset ${
                      on ? "ring-2" : "ring-1 ring-black/12 hover:ring-black/40"
                    }`}
                    style={
                      on
                        ? ({
                            "--tw-ring-color": "var(--ghad-accent)",
                          } as React.CSSProperties)
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      data-testid={`offline-did-${id}`}
                      checked={on}
                      onChange={() =>
                        setPulledOff((all) =>
                          on ? all.filter((x) => x !== id) : [...all, id],
                        )
                      }
                      className="mt-1 h-4 w-4"
                      style={{ accentColor: "var(--ghad-accent)" }}
                    />
                    <span className="text-[16px] leading-relaxed text-[#111]">
                      {challengeById(id)?.line}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        {outing.pact && (
          <label className="block">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
              Who cracked first?
            </span>
            <span className="mt-1 block text-[14px] text-black/50">
              {stakeSentence(outing.pact.stake)} Leave it blank if nobody did.
            </span>
            <input
              data-testid="offline-cracked"
              value={cracked}
              maxLength={60}
              onChange={(event) => setCracked(event.target.value)}
              placeholder="Nobody. Obviously."
              className="mt-3 min-h-12 w-full rounded-full bg-white px-5 text-[16px] text-[#111] ring-1 ring-black/15 ring-inset placeholder:text-black/35 focus:ring-2 focus:ring-black/50 focus:outline-none"
            />
          </label>
        )}

        <label className="block">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
            Who was there?
          </span>
          <input
            data-testid="offline-company"
            value={company}
            maxLength={120}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="Me, Sam and a very muddy dog."
            className="mt-3 min-h-12 w-full rounded-full bg-white px-5 text-[16px] text-[#111] ring-1 ring-black/15 ring-inset placeholder:text-black/35 focus:ring-2 focus:ring-black/50 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-black/40 uppercase">
            The best thing that wasn&apos;t on the paper
          </span>
          <textarea
            data-testid="offline-unplanned"
            value={unplanned}
            maxLength={280}
            rows={3}
            onChange={(event) => setUnplanned(event.target.value)}
            placeholder="A dog called Biscuit. A pie stand nobody had heard of."
            className="mt-3 w-full rounded-2xl bg-white px-5 py-4 text-[16px] leading-relaxed text-[#111] ring-1 ring-black/15 ring-inset placeholder:text-black/35 focus:ring-2 focus:ring-black/50 focus:outline-none"
          />
        </label>

        <div>
          <button
            type="submit"
            data-testid="offline-make-postcard"
            style={{
              backgroundColor: "var(--ghad-accent)",
              color: "var(--ghad-accent-ink)",
            }}
            className="inline-flex min-h-14 items-center gap-2 rounded-full px-8 text-[17px] font-semibold"
          >
            Make the postcard
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <p className="mt-3 text-[13px] text-black/45">
            All optional. Stays on this device.
          </p>
        </div>
      </form>
    </div>
  );
}

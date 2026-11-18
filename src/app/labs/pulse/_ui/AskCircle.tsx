"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import type { Results as R } from "@/lib/pulse/results";
import { StackRow, n } from "./parts";
import { countEvent } from "./Share";

/**
 * **Ask My Circle**: send this exact question to people you know and watch
 * how they answer beside everyone. Your link is the same before and after you
 * vote, it never changes the question, and it adds to the one shared set of
 * votes — a person has one answer however many links reach them.
 */
export function AskCircle({
  results,
  url,
  question,
  pulseId,
}: {
  results: R;
  url: string;
  question: string;
  pulseId?: string;
}) {
  const [note, setNote] = useState("");
  const c = results.circle;
  const text = `I asked: “${question}” — where do you stand? Vote, and we'll see how our circle compares with everyone.`;

  async function ask() {
    if (!url) return;
    if (pulseId) countEvent(pulseId, "circle-ask");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "People's Pulse", text, url });
        setNote("Sent. Their answers will count towards your circle.");
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setNote("Link copied. Paste it wherever you talk to your circle.");
    } catch {
      /* closed the share sheet */
    }
  }

  const everyone = {
    total: results.total,
    counted: results.total,
    shares: results.everyone,
  };
  const need = c ? Math.max(0, results.minGroup - c.total) : results.minGroup;
  return (
    <section
      aria-labelledby="pulse-ask"
      className="rounded-2xl border-2 border-[#14161a] bg-white p-4"
      data-testid="pulse-ask-circle"
    >
      <h2
        id="pulse-ask"
        className="font-heading text-[20px] leading-tight font-bold"
      >
        Do the people around you agree?
      </h2>
      <p className="mt-1 text-[14px] text-[#3f4550]">
        Send this question to your circle. Everyone who answers through your
        link is counted as your circle — same question, same vote count as
        everyone else.
      </p>
      <button
        type="button"
        onClick={ask}
        disabled={!url}
        data-testid="pulse-ask-button"
        className="mt-3 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#14161a] text-[17px] font-semibold text-white transition hover:bg-black disabled:opacity-40"
      >
        <Share2 className="h-5 w-5" aria-hidden /> Ask my circle
      </button>
      <p
        role="status"
        className="mt-2 flex items-center gap-1.5 text-[13px] text-[#1baf7a]"
        data-testid="pulse-ask-note"
      >
        {note ? <Check className="h-4 w-4" aria-hidden /> : null}
        {note}
      </p>
      <p
        className="mt-1 font-mono text-[12px] break-all text-[#5c6370]"
        data-testid="pulse-ask-link"
      >
        {url}
      </p>

      <div className="mt-4 grid gap-3" data-testid="pulse-circle-vs-everyone">
        <h3 className="text-[14px] font-semibold">My circle vs Everyone</h3>
        {c?.shares ? (
          <>
            <StackRow
              name="Everyone"
              b={everyone}
              testId="pulse-ask-everyone"
            />
            <StackRow
              name="My circle"
              b={{ ...c, shares: c.shares }}
              testId="pulse-ask-mine"
            />
            <ul className="grid gap-1 text-[14px]" data-testid="pulse-ask-gaps">
              {c.shares.map((s, i) => {
                const diff = s.pct - (results.everyone[i]?.pct ?? 0);
                return (
                  <li key={s.optionId}>
                    <strong>{s.label}</strong>: my circle {s.pct}% · everyone{" "}
                    {results.everyone[i]?.pct ?? 0}% ·{" "}
                    <span className="font-semibold">
                      {diff === 0
                        ? "same"
                        : `${diff > 0 ? "+" : "−"}${Math.abs(diff)} pts`}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-[12.5px] text-[#5c6370]">
              {n(c.counted)} people in your circle, counted in steps of{" "}
              {results.minGroup} so no one&apos;s answer stands out.
            </p>
          </>
        ) : (
          <p
            className="rounded-xl bg-[#f3f1ec] p-3 text-[14px] text-[#3f4550]"
            data-testid="pulse-ask-waiting"
          >
            {c && c.joinedViaYou > 0
              ? `${c.joinedViaYou} ${c.joinedViaYou === 1 ? "person has" : "people have"} answered through your link — ${need} more in your circle and you can compare. Answers stay hidden until then so no one's vote can be picked out.`
              : `Nobody has answered through your link yet. Once ${results.minGroup} people are in your circle you'll see it beside everyone.`}
          </p>
        )}
      </div>
    </section>
  );
}

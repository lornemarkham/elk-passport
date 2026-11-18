"use client";

import { useEffect, useState } from "react";
import type { SourceCheck as Found } from "@/lib/pulse/sourceCheck";

const input =
  "w-full rounded-xl border border-[#d9d4c8] bg-white px-3.5 py-3 text-[16px] text-[#14161a] placeholder:text-[#8a909a] focus:border-[#14161a] focus:ring-2 focus:ring-[#14161a]/15 focus:outline-none";

export interface ClaimNotes {
  published: string;
  measures: string;
  method: string;
}

type Outcome =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "failed"; reason: string }
  | {
      kind: "found";
      check: Found;
      ai: { measures: string | null; method: string | null } | null;
    };

/**
 * **Optional help with a claim's source.** Reads the page the creator linked
 * and shows what the page itself says — never a guess, never a search. The
 * creator decides what, if anything, to keep; whatever they keep is shown
 * beside their claim as theirs, and People's Pulse says it hasn't checked it.
 */
export function SourceCheck({
  claimText,
  percent,
  url,
  notes,
  onNotes,
  onSite,
}: {
  claimText: string;
  percent: string;
  url: string;
  notes: ClaimNotes;
  onNotes: (n: ClaimNotes) => void;
  onSite: (site: string) => void;
}) {
  const [out, setOut] = useState<Outcome>({ kind: "idle" });
  const [aiOn, setAiOn] = useState(false);
  const [wantAi, setWantAi] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/pulse/source-check")
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => live && setAiOn(Boolean(b?.ai)))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  async function look() {
    setOut({ kind: "busy" });
    const res = await fetch("/api/pulse/source-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, percent, claim: claimText, ai: wantAi }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.status === 429)
      return setOut({
        kind: "failed",
        reason: "A few checks at a time — try again in a few minutes.",
      });
    if (!body?.ok)
      return setOut({
        kind: "failed",
        reason:
          body?.reason ?? "That didn't work. Fill the details in yourself.",
      });
    setOut({ kind: "found", check: body.check, ai: body.ai ?? null });
  }

  const f = out.kind === "found" ? out.check : null;
  const ai = out.kind === "found" ? out.ai : null;
  const use = (patch: Partial<ClaimNotes>) => onNotes({ ...notes, ...patch });

  return (
    <div
      className="grid gap-3 rounded-xl bg-[#f3f1ec] p-3"
      data-testid="pulse-source-check"
    >
      <p className="text-[13px] text-[#3f4550]">
        <strong>Check the source</strong> (optional). We open your link and show
        what the page itself says. We don&apos;t search for sources or judge
        whether a claim is true.
      </p>
      {aiOn ? (
        <label className="flex items-start gap-2 text-[13px] text-[#3f4550]">
          <input
            type="checkbox"
            checked={wantAi}
            onChange={(e) => setWantAi(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          Also ask AI to put the page&apos;s own sentences into plain words (it
          can be wrong).
        </label>
      ) : null}
      <button
        type="button"
        onClick={look}
        disabled={!url || out.kind === "busy"}
        data-testid="pulse-source-look"
        className="min-h-11 justify-self-start rounded-full border border-[#14161a] bg-white px-5 text-[14px] font-semibold disabled:opacity-40"
      >
        {out.kind === "busy" ? "Reading the page…" : "Look at the source"}
      </button>
      <div role="status" className="grid gap-3">
        {out.kind === "failed" ? (
          <p className="text-[13.5px] text-[#b42318]">{out.reason}</p>
        ) : null}
        {f ? (
          <div
            className="grid gap-2 text-[13.5px]"
            data-testid="pulse-source-found"
          >
            <p>
              <strong>{f.title ?? "Untitled page"}</strong> · {f.site}
            </p>
            <p>
              Published:{" "}
              {f.published ? (
                <>
                  {f.published}{" "}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => use({ published: f.published! })}
                  >
                    Use this
                  </button>
                </>
              ) : (
                "the page doesn't say"
              )}
            </p>
            <p>
              {f.statFound === null
                ? "Add the published percentage to look for it on the page."
                : f.statFound
                  ? "The figure appears on the page:"
                  : "That figure doesn't appear in the page's text. It may be in a chart or another page."}
            </p>
            {f.statExcerpts.map((s) => (
              <blockquote key={s} className="border-l-2 border-[#bdb7aa] pl-3">
                “{s}”
              </blockquote>
            ))}
            {f.methodExcerpts.length ? (
              <>
                <p>How the page describes its method:</p>
                {f.methodExcerpts.map((s) => (
                  <blockquote
                    key={s}
                    className="border-l-2 border-[#bdb7aa] pl-3"
                  >
                    “{s}”{" "}
                    <button
                      type="button"
                      className="font-semibold underline"
                      onClick={() => use({ method: s.slice(0, 240) })}
                    >
                      Use
                    </button>
                  </blockquote>
                ))}
              </>
            ) : null}
            {f.site && f.site !== "" ? (
              <button
                type="button"
                className="justify-self-start font-semibold underline"
                onClick={() => onSite(f.site)}
              >
                Use “{f.site}” as who published it
              </button>
            ) : null}
            {ai ? (
              <div
                className="rounded-lg bg-white p-2.5"
                data-testid="pulse-source-ai"
              >
                <p className="text-[12px] font-semibold tracking-wide text-[#5c6370] uppercase">
                  AI wording — check it against the page
                </p>
                {ai.measures ? (
                  <p>
                    Measures: {ai.measures}{" "}
                    <button
                      type="button"
                      className="font-semibold underline"
                      onClick={() => use({ measures: ai.measures! })}
                    >
                      Use
                    </button>
                  </p>
                ) : null}
                {ai.method ? (
                  <p>
                    Method: {ai.method}{" "}
                    <button
                      type="button"
                      className="font-semibold underline"
                      onClick={() => use({ method: ai.method! })}
                    >
                      Use
                    </button>
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <input
        aria-label="When it was published"
        value={notes.published}
        maxLength={40}
        onChange={(e) => use({ published: e.target.value })}
        placeholder="When it was published (e.g. March 2024)"
        className={input}
      />
      <input
        aria-label="What the figure measures"
        value={notes.measures}
        maxLength={240}
        onChange={(e) => use({ measures: e.target.value })}
        placeholder="What it measures (e.g. support among adults in BC)"
        className={input}
      />
      <input
        aria-label="How it was gathered"
        value={notes.method}
        maxLength={240}
        onChange={(e) => use({ method: e.target.value })}
        placeholder="How it was gathered (e.g. online survey, 1,204 people)"
        className={input}
      />
    </div>
  );
}

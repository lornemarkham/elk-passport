"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ASSESSMENTS,
  ASSESSMENT_INFO,
  CHECK_LIMITS,
  STANCE_LABEL,
  assessmentProblem,
  type Assessment,
  type PlacedSource,
} from "@/lib/pulse/check";
import { SourceAdder, type Picked } from "./SourceAdder";

/**
 * **Correct this check**, for the person who published it, on the browser
 * they published from. New evidence, a changed assessment, or a note on what
 * changed — each correction is added to the visible history, never hidden.
 * Not a <form>: the source reader inside it is a form of its own.
 */
export function CorrectCheck({
  pulseId,
  claim,
  assessment,
  sources,
  summary,
}: {
  pulseId: string;
  claim: string;
  assessment: Assessment;
  sources: readonly PlacedSource[];
  summary: string | null;
}) {
  const router = useRouter();
  const [added, setAdded] = useState<Picked[]>([]);
  const [chosen, setChosen] = useState<Assessment>(assessment);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const all = [...sources, ...added];

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/pulse/check/${pulseId}/correct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        note,
        assessment: chosen,
        sources: added.map(({ sealed, stance, note }) => ({
          sealed,
          stance,
          note,
        })),
      }),
    }).catch(() => null);
    const out = await res?.json().catch(() => null);
    if (res?.ok) {
      setAdded([]);
      setNote("");
      router.refresh();
    } else setError(out?.message ?? "That didn't save. Try again.");
    setBusy(false);
  }

  return (
    <details
      className="rounded-2xl border border-[#14161a] bg-white p-4"
      data-testid="check-correct"
    >
      <summary className="cursor-pointer text-[15px] font-semibold">
        You published this. Add a correction
      </summary>
      <div className="mt-4 grid gap-4">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
          <p className="text-[14px] font-semibold">New evidence</p>
          <SourceAdder
            claim={claim}
            onAdd={(p) => setAdded((a) => [...a, p])}
          />
          {added.map((p) => (
            <p key={p.sealed} className="text-[13.5px]">
              + {p.source.title ?? p.source.site} — {STANCE_LABEL[p.stance]}
            </p>
          ))}
        </div>
        <fieldset>
          <legend className="mb-2 text-[14px] font-semibold">Assessment</legend>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
            {ASSESSMENTS.map((a) => {
              const why = assessmentProblem(a, all, summary);
              return (
                <label
                  key={a}
                  className={`flex min-h-11 items-center gap-2.5 text-[14.5px] ${why ? "text-[#8a909a]" : ""}`}
                >
                  <input
                    type="radio"
                    name="correct-assessment"
                    checked={chosen === a}
                    disabled={!!why}
                    onChange={() => setChosen(a)}
                    className="h-4 w-4 accent-[#14161a]"
                  />
                  {ASSESSMENT_INFO[a].label}
                  {why ? <span className="text-[12px]">— {why}</span> : null}
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-[14px] font-semibold">
          What changed?
          <textarea
            value={note}
            rows={2}
            maxLength={CHECK_LIMITS.correction}
            onChange={(e) => setNote(e.target.value)}
            data-testid="check-correct-note"
            placeholder="Interior Health published newer figures on…"
            className="rounded-xl border border-[#d9d4c8] px-3 py-2.5 text-[16px] font-normal"
          />
        </label>
        {error ? (
          <p role="alert" className="text-[14px] font-medium text-[#b42318]">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={busy || note.trim().length < 8}
          data-testid="check-correct-save"
          className="min-h-12 rounded-full bg-[#14161a] text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Saving…" : "Publish correction"}
        </button>
        <p className="text-[12.5px] text-[#5c6370]">
          Corrections are public and permanent, with the date and what changed.
        </p>
      </div>
    </details>
  );
}

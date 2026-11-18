"use client";

import { useState } from "react";
import { REPORT_REASONS, type ReportReason } from "@/lib/pulse/model";

/** Flag a Pulse for review. Three reports take it off the air until checked. */
export function Report({
  pulseId,
  label = "Report this Pulse",
}: {
  pulseId: string;
  label?: string;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setState("busy");
    const res = await fetch(`/api/pulse/${pulseId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, note }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  }

  return (
    <details
      className="rounded-2xl border border-[#e7e3da] bg-white p-4"
      data-testid="pulse-report"
    >
      <summary className="cursor-pointer text-[14px] font-medium text-[#5c6370]">
        {label}
      </summary>
      {state === "done" ? (
        <p role="status" className="mt-3 text-[14px] text-[#14161a]">
          Thanks — it&apos;s been flagged for review.
        </p>
      ) : (
        <form onSubmit={send} className="mt-3 grid gap-3">
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-[14px] font-semibold">
              What&apos;s wrong?
            </legend>
            {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(
              ([k, text]) => (
                <label
                  key={k}
                  className="flex min-h-10 items-center gap-2.5 text-[14px]"
                >
                  <input
                    type="radio"
                    name="reason"
                    value={k}
                    checked={reason === k}
                    onChange={() => setReason(k)}
                    className="h-4 w-4 accent-[#14161a]"
                  />
                  {text}
                </label>
              ),
            )}
          </fieldset>
          <textarea
            aria-label="Anything else (optional)"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything else? (optional — no personal details)"
            className="w-full rounded-xl border border-[#d9d4c8] px-3 py-2 text-[15px]"
          />
          <button
            type="submit"
            disabled={!reason || state === "busy"}
            className="min-h-11 justify-self-start rounded-full bg-[#14161a] px-5 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            Send report
          </button>
          {state === "error" ? (
            <p role="alert" className="text-[14px] text-[#b42318]">
              That didn&apos;t send. Try again.
            </p>
          ) : null}
        </form>
      )}
    </details>
  );
}

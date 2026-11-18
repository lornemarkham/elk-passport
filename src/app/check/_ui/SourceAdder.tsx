"use client";

import { useState } from "react";
import {
  CHECK_LIMITS,
  STANCES,
  STANCE_LABEL,
  type CheckSource,
  type Stance,
} from "@/lib/pulse/check";

/** A source the server read, as the asker placed it, ready to publish. */
export interface Picked {
  readonly sealed: string;
  readonly source: CheckSource;
  readonly stance: Stance;
  readonly note: string;
}

export const fmtDay = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString(
    "en-CA",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "America/Vancouver",
    },
  );

/**
 * **Add a source.** Paste a link; People's Pulse opens the page itself and
 * shows what it actually says about the claim, word for word. The person
 * then says whether it supports the claim, contradicts it, or is context.
 */
export function SourceAdder({
  claim,
  onAdd,
  disabled,
}: {
  claim: string;
  onAdd: (p: Picked) => void;
  disabled?: boolean;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [read, setRead] = useState<{
    sealed: string;
    source: CheckSource;
  } | null>(null);
  const [stance, setStance] = useState<Stance | null>(null);
  const [note, setNote] = useState("");

  async function open(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setRead(null);
    const res = await fetch("/api/pulse/check/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ as: "evidence", url: url.trim(), claim }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.status === 429)
      setError(
        "That's a lot of pages for now. Wait a few minutes and try again.",
      );
    else if (body?.ok) setRead({ sealed: body.sealed, source: body.source });
    else setError(body?.reason ?? "Couldn't open that page. Check the link.");
    setBusy(false);
  }

  function add() {
    if (!read || !stance) return;
    onAdd({ ...read, stance, note: note.trim() });
    setUrl("");
    setRead(null);
    setStance(null);
    setNote("");
  }

  return (
    <div
      className="grid grid-cols-[minmax(0,1fr)] gap-3"
      data-testid="check-source-adder"
    >
      <form onSubmit={open} className="flex gap-2">
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://… a report, news story or official page"
          aria-label="Link to a source"
          data-testid="check-source-url"
          disabled={disabled}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-[#d9d4c8] bg-white px-3 text-[16px]"
        />
        <button
          type="submit"
          disabled={busy || !url.trim() || disabled}
          data-testid="check-source-read"
          className="min-h-12 shrink-0 rounded-xl bg-[#14161a] px-4 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Reading…" : "Read it"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-[14px] font-medium text-[#b42318]">
          {error}
        </p>
      ) : null}
      {read ? (
        <div
          className="rounded-2xl border border-[#e7e3da] bg-white p-4"
          data-testid="check-source-preview"
        >
          <p className="text-[15px] font-semibold">
            {read.source.title ?? read.source.site}
          </p>
          <p className="mt-0.5 text-[13px] text-[#5c6370]">
            {read.source.site} ·{" "}
            {read.source.published
              ? `Published ${fmtDay(read.source.published)}`
              : "The page doesn't say when it was published"}
          </p>
          {read.source.excerpts.length ? (
            <div className="mt-3 grid gap-2">
              <p className="text-[12px] font-bold tracking-[0.12em] text-[#5c6370] uppercase">
                What the page says
              </p>
              {read.source.excerpts.map((x) => (
                <blockquote
                  key={x}
                  className="border-l-4 border-[#d9d4c8] pl-3 text-[14.5px] leading-relaxed"
                >
                  {x}
                </blockquote>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[14px] text-[#5c6370]">
              No sentence on this page mentions the claim&apos;s figures or key
              words. Figures in charts, images or PDFs can&apos;t be read here.
            </p>
          )}
          <p className="mt-2 text-[13px] text-[#5c6370]">
            {read.source.figureFound
              ? "A figure from the claim appears on this page."
              : "The claim's figure doesn't appear on this page."}
          </p>
          <fieldset className="mt-4">
            <legend className="mb-2 text-[14px] font-semibold">
              From what it says, this source…
            </legend>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
              {STANCES.map((s) => (
                <label
                  key={s}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 text-[15px] font-medium ${stance === s ? "border-[#14161a]" : "border-[#e7e3da]"}`}
                >
                  <input
                    type="radio"
                    name="stance"
                    value={s}
                    checked={stance === s}
                    onChange={() => setStance(s)}
                    className="h-4 w-4 accent-[#14161a]"
                    data-testid={`check-stance-${s}`}
                  />
                  {STANCE_LABEL[s]}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-3 grid gap-1 text-[13.5px] font-medium text-[#3f4550]">
            A note about it{" "}
            <span className="font-normal text-[#5c6370]">
              Optional, shown as your words
            </span>
            <input
              value={note}
              maxLength={CHECK_LIMITS.note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-11 rounded-xl border border-[#d9d4c8] px-3 text-[15px]"
            />
          </label>
          <button
            type="button"
            onClick={add}
            disabled={!stance}
            data-testid="check-source-add"
            className="mt-3 min-h-12 w-full rounded-full bg-[#14161a] text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {stance ? "Add this source" : "Say what this source shows"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

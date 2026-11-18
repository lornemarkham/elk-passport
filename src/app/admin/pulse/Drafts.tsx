"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuestionDraft } from "@/lib/pulse/drafts";

type Row = QuestionDraft & { published: string | null };

/**
 * **Proposed questions.** Agents propose; a person publishes. High-stakes
 * drafts (politics, health) need an explicit "I reviewed it" first.
 */
export function Drafts() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [confirm, setConfirm] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const r = await fetch("/api/pulse/admin", { cache: "no-store" });
    if (r.ok) setRows((await r.json()).drafts ?? []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first read of the server's queue
    void load();
  }, [load]);

  async function publish(d: Row) {
    const r = await fetch("/api/pulse/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft: d.id, confirmed: confirm[d.id] === true }),
    });
    const body = await r.json().catch(() => ({}));
    setMsg((m) => ({
      ...m,
      [d.id]: r.ok ? "Published." : (body.message ?? `Failed (${r.status}).`),
    }));
    void load();
  }

  if (!rows) return <p className="text-[14px] text-[#5c6370]">Loading…</p>;
  return (
    <ul className="grid gap-3" data-testid="pulse-drafts">
      {rows.map((d) => (
        <li
          key={d.id}
          className="rounded-2xl border border-[#e7e3da] bg-white p-4"
          data-testid={`pulse-draft-${d.id}`}
        >
          <p className="flex flex-wrap gap-2 text-[12px] font-semibold tracking-wide uppercase">
            <span className="text-[#5c6370]">{d.topic}</span>
            {d.stakes === "high-stakes" ? (
              <span className="text-[#b42318]">High-stakes · needs review</span>
            ) : null}
          </p>
          <p className="mt-1 text-[16px] font-semibold">{d.question}</p>
          <p className="mt-1 text-[14px] text-[#3f4550]">
            {d.options.join(" · ")}
          </p>
          <p className="mt-1 text-[13px] text-[#5c6370]">
            {d.why} <span className="italic">— {d.proposedBy}</span>
          </p>
          {d.sources.length ? (
            <ul className="mt-1 text-[13px]">
              {d.sources.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#2a78d6] underline"
                  >
                    {s.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[13px] text-[#5c6370]">
              No source — a question about people&apos;s own experience.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {d.published ? (
              <a
                href={`/labs/pulse/${d.published}`}
                className="text-[14px] font-semibold text-[#2a78d6] underline"
              >
                Published — open it
              </a>
            ) : (
              <>
                {d.stakes === "high-stakes" ? (
                  <label className="flex items-center gap-2 text-[14px]">
                    <input
                      type="checkbox"
                      checked={confirm[d.id] === true}
                      onChange={(e) =>
                        setConfirm((c) => ({ ...c, [d.id]: e.target.checked }))
                      }
                    />
                    I reviewed the wording and sources
                  </label>
                ) : null}
                <button
                  type="button"
                  onClick={() => publish(d)}
                  className="min-h-10 rounded-full bg-[#14161a] px-4 text-[14px] font-semibold text-white"
                >
                  Publish
                </button>
              </>
            )}
            {msg[d.id] ? (
              <span className="text-[13px] text-[#5c6370]">{msg[d.id]}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ASSESSMENT_INFO, POST_INFO } from "@/lib/pulse/check";
import type {
  CheckEventRow,
  CheckListed,
  ReportedPost,
} from "@/lib/pulse/checkStore";

/**
 * Pulse Check moderation: reported posts (three reports hide one), the
 * newest checks with a moderator's correction, and where visits came from.
 */
export function Checks() {
  const [data, setData] = useState<{
    posts: ReportedPost[];
    recent: CheckListed[];
    usage: CheckEventRow[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/pulse/check/admin", { cache: "no-store" });
    if (res.ok) setData(await res.json());
    else setError(`Couldn't load Pulse Check (${res.status}).`);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first read of the queue from the server
    void load();
  }, [load]);

  async function send(body: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/pulse/check/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const out = await res.json().catch(() => null);
      setError(out?.message ?? `That didn't save (${res.status}).`);
    }
    await load();
  }

  if (error && !data)
    return <p className="text-[14px] text-[#b42318]">{error}</p>;
  if (!data) return <p className="text-[14px] text-[#5c6370]">Loading…</p>;
  const totals = new Map<string, number>();
  for (const r of data.usage)
    totals.set(
      `${r.event}:${r.source}`,
      (totals.get(`${r.event}:${r.source}`) ?? 0) + r.n,
    );
  const rows = (event: string) =>
    [...totals]
      .filter(([k]) => k.startsWith(`${event}:`))
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k.split(":")[1]} ${n}`)
      .join(" · ") || "none";

  return (
    <div className="grid gap-6" data-testid="admin-checks">
      {error ? <p className="text-[14px] text-[#b42318]">{error}</p> : null}
      <div className="rounded-2xl border border-[#e7e3da] bg-white p-4 text-[14px]">
        <p className="font-semibold">Last 30 days (counts only)</p>
        <p className="mt-1">Visits by where they came from: {rows("visit")}</p>
        <p className="mt-1">Shares by channel: {rows("share")}</p>
        <p className="mt-1 text-[12.5px] text-[#5c6370]">
          New investigations and votes are in Usage above, as the “Pulse Check”
          kind.
        </p>
      </div>

      <div>
        <h3 className="text-[16px] font-bold">Reported posts</h3>
        {data.posts.length === 0 ? (
          <p className="mt-1 text-[14px] text-[#5c6370]">Nothing reported.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {data.posts.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-[#e7e3da] bg-white p-3 text-[14px]"
              >
                <p className="text-[12.5px] text-[#5c6370]">
                  {POST_INFO[p.type].label} · {p.status} · {p.reports} report
                  {p.reports === 1 ? "" : "s"} ·{" "}
                  <Link href={`/check/${p.pulseId}`} className="underline">
                    open the check
                  </Link>
                </p>
                <p className="mt-1 whitespace-pre-line">{p.body}</p>
                {p.url ? (
                  <p className="mt-1 truncate text-[13px]">{p.url}</p>
                ) : null}
                <div className="mt-2 flex gap-2">
                  {(["live", "hidden", "removed"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={p.status === s}
                      onClick={() => send({ post: p.id, status: s })}
                      className="min-h-9 rounded-full border border-[#d9d4c8] px-3 text-[13px] font-semibold disabled:opacity-40"
                    >
                      {s === "live"
                        ? "Show"
                        : s === "hidden"
                          ? "Hide"
                          : "Remove"}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-[16px] font-bold">Newest checks</h3>
        <p className="mt-1 text-[13px] text-[#5c6370]">
          To pause or remove a check, use Moderation below (it is a Pulse). A
          moderator&apos;s note is added to the check&apos;s public correction
          history.
        </p>
        <ul className="mt-2 grid gap-2">
          {data.recent.map((c) => (
            <li
              key={c.pulseId}
              className="rounded-xl border border-[#e7e3da] bg-white p-3 text-[14px]"
            >
              <Link
                href={`/check/${c.slug}`}
                className="font-semibold underline-offset-2 hover:underline"
              >
                “{c.claim}”
              </Link>
              <p className="text-[12.5px] text-[#5c6370]">
                {ASSESSMENT_INFO[c.assessment].label} · {c.sources} sources ·{" "}
                {c.votes} votes · {c.posts} posts · id {c.pulseId}
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  aria-label="Moderator note"
                  value={notes[c.pulseId] ?? ""}
                  onChange={(e) =>
                    setNotes((n) => ({ ...n, [c.pulseId]: e.target.value }))
                  }
                  placeholder="Moderator note (public)"
                  className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#d9d4c8] px-3"
                />
                <button
                  type="button"
                  disabled={(notes[c.pulseId] ?? "").trim().length < 8}
                  onClick={() =>
                    send({ check: c.pulseId, note: notes[c.pulseId] }).then(
                      () => setNotes((n) => ({ ...n, [c.pulseId]: "" })),
                    )
                  }
                  className="min-h-10 rounded-lg bg-[#14161a] px-3 text-[13px] font-semibold text-white disabled:opacity-40"
                >
                  Add note
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

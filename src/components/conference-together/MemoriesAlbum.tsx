"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { primary, Problem, secondary } from "@/components/conference/ui";
import { PHOTO_REACTIONS } from "@/domain/conference-memories/memories";
import type { AlbumView } from "@/lib/conference-memories/service";
import { shrinkPhoto } from "@/lib/image/shrinkPhoto";
import { send, usePoll } from "./usePoll";

/**
 * **The shared album.** Take or pick a photo, say what it was, say which
 * plan it belongs to; everyone in the conference sees it, reacts to it, and
 * can download it. The phone shrinks it first (Hockey's rule), so a 12 MB
 * camera file becomes a few hundred kilobytes before it leaves.
 */
export function MemoriesAlbum({
  conferenceId,
  initial,
  planFilter,
}: {
  conferenceId: string;
  initial: AlbumView;
  planFilter?: string;
}) {
  const api = `/api/conferences/${conferenceId}/memories`;
  const { data: album, refresh } = usePoll(
    api,
    (j) => j.album as AlbumView,
    initial,
    15_000,
  );
  const [caption, setCaption] = useState("");
  const [planId, setPlanId] = useState(planFilter ?? "");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const shown = planFilter
    ? album.photos.filter((p) => p.plan?.id === planFilter)
    : album.photos;
  const viewing = album.photos.find((p) => p.id === open) ?? null;

  const upload = async (file: File) => {
    setBusy(true);
    setProblem("");
    try {
      const data = await shrinkPhoto(file);
      const r = await send(api, { data, caption, planId: planId || null });
      if (!r.ok) setProblem(r.message);
      else {
        setCaption("");
        await refresh();
      }
    } catch {
      setProblem("That photo couldn't be read. Try another.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="mx-auto max-w-[1180px] px-5 pb-16 *:max-w-[820px] sm:px-8">
      {album.you.canAdd ? (
        <section
          className="border-cf-line mt-6 rounded-2xl border bg-white p-5 shadow-[0_1px_2px_rgba(23,24,27,0.04)]"
          aria-label="Add a photo"
        >
          <label className="block text-[14px] font-bold">
            What&apos;s happening in it?{" "}
            <span className="text-cf-mist font-normal">(optional)</span>
            <input
              value={caption}
              maxLength={140}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Sunrise on the seawall"
              className="border-cf-line mt-1 w-full rounded-xl border px-4 py-3 text-[16px] font-normal"
            />
          </label>
          {album.plans.length ? (
            <label className="mt-3 block text-[14px] font-bold">
              From which plan?
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="border-cf-line mt-1 w-full rounded-xl border px-3 py-3 text-[16px] font-normal"
              >
                <option value="">Not from a plan</option>
                {album.plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="sr-only"
            id="photo-file"
            data-testid="photo-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <label
            htmlFor="photo-file"
            className={`${primary} mt-4 flex min-h-12 w-full cursor-pointer items-center justify-center ${busy ? "opacity-40" : ""}`}
          >
            {busy ? "Adding…" : "📷 Add a photo"}
          </label>
          <p className="text-cf-mist mt-2 text-[13px]">
            Everyone in the conference sees it ({album.room} spaces left). Only
            you, or an organiser, can take it down.
          </p>
          <Problem>{problem}</Problem>
        </section>
      ) : (
        <p className="bg-cf-sand text-cf-slate mt-6 rounded-2xl p-4 text-[15px]">
          To add photos, choose a name and to be seen on the{" "}
          <Link href={`/conferences/${conferenceId}#you`} className="underline">
            conference page
          </Link>
          .
        </p>
      )}

      {planFilter ? (
        <p className="mt-6 text-[15px]">
          Showing photos from{" "}
          <strong>
            {album.plans.find((p) => p.id === planFilter)?.title ?? "one plan"}
          </strong>
          .{" "}
          <Link
            href={`/conferences/${conferenceId}/memories`}
            className="underline"
          >
            Show everything
          </Link>
        </p>
      ) : null}

      {shown.length ? (
        <ul
          className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3"
          data-testid="album"
        >
          {shown.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpen(p.id)}
                className="bg-cf-sand block w-full overflow-hidden rounded-2xl text-left"
                aria-label={`Photo by ${p.by.name}${p.caption ? `: ${p.caption}` : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- private bytes from a members-only route */}
                <img
                  src={`${api}/${p.id}`}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
                <span className="text-cf-slate block truncate px-2 py-1.5 text-[12px]">
                  {p.reactions.map((r) => `${r.emoji}${r.count}`).join(" ")}{" "}
                  {p.caption || p.by.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-cf-mist mt-8 text-[16px]">
          No photos yet. The first one is the hardest; the second is the group
          shot.
        </p>
      )}

      {viewing ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          className="fixed inset-0 z-50 flex flex-col bg-black/90 text-white"
        >
          <div className="flex items-center justify-between p-3">
            <span className="text-[14px]">
              {viewing.by.name} ·{" "}
              {new Date(viewing.at).toLocaleString([], {
                weekday: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
              {viewing.plan ? ` · ${viewing.plan.title}` : ""}
            </span>
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="min-h-11 px-3 text-[16px] underline"
            >
              Close
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- private bytes */}
            <img
              src={`${api}/${viewing.id}`}
              alt={viewing.caption}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          {viewing.caption ? (
            <p className="px-4 pt-2 text-center text-[16px]">
              {viewing.caption}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {PHOTO_REACTIONS.map((e) => {
              const r = viewing.reactions.find((x) => x.emoji === e);
              return (
                <button
                  key={e}
                  type="button"
                  aria-pressed={!!r?.mine}
                  aria-label={`React ${e}`}
                  onClick={async () => {
                    await send(`${api}/${viewing.id}`, { emoji: e });
                    await refresh();
                  }}
                  className={`min-h-11 min-w-11 rounded-full px-3 text-[18px] ${r?.mine ? "bg-white/30" : "bg-white/10"}`}
                >
                  {e}
                  {r ? (
                    <span className="ml-1 text-[13px]">{r.count}</span>
                  ) : null}
                </button>
              );
            })}
            <a
              href={`${api}/${viewing.id}?download=1`}
              className={`${secondary} inline-flex min-h-11 items-center border-white/30 text-white`}
            >
              Download
            </a>
            {viewing.canRemove ? (
              <button
                type="button"
                className="min-h-11 rounded-xl px-3 text-[15px] text-[#ffb4a8] underline"
                onClick={async () => {
                  const r = await send(
                    `${api}/${viewing.id}`,
                    undefined,
                    "DELETE",
                  );
                  if (r.ok) {
                    setOpen(null);
                    await refresh();
                  }
                }}
              >
                {viewing.by.you ? "Delete my photo" : "Take it down"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

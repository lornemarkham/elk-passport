"use client";

import { useState } from "react";
import { Download, Share2 } from "lucide-react";
import type { Results as R } from "@/lib/pulse/results";

/**
 * **Share the result as a picture.** A portrait card made for phones: the
 * question, the percentages, how many people answered, and — if you choose —
 * your circle or a province beside everyone. The phone's own share sheet sends
 * it (as an image where the phone allows, otherwise as a link to the card).
 */
export function ResultsCard({
  pulseId,
  question,
  circle,
  results,
  pulseUrl,
}: {
  pulseId: string;
  question: string;
  circle: string;
  results: R;
  pulseUrl: string;
}) {
  const circleReady = Boolean(results.circle?.shares);
  const places = results.provinces.filter((p) => p.shares);
  const [withCircle, setWithCircle] = useState(circleReady);
  const [place, setPlace] = useState("");
  const [msg, setMsg] = useState("");
  const [loaded, setLoaded] = useState(false);

  const params = new URLSearchParams();
  if (withCircle && circleReady) params.set("c", circle);
  else if (place) params.set("p", place);
  const src = `/labs/pulse/${pulseId}/card${params.size ? `?${params}` : ""}`;
  const text = `${question} — here's where People's Pulse stands. Add your answer:`;

  async function share() {
    setMsg("");
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], "peoples-pulse-results.png", {
        type: "image/png",
      });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text} ${pulseUrl}` });
        return;
      }
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "People's Pulse",
          text,
          url: new URL(src, location.origin).toString(),
        });
        return;
      }
      await navigator.clipboard.writeText(
        new URL(src, location.origin).toString(),
      );
      setMsg("Link to the card copied.");
    } catch {
      /* closed the share sheet */
    }
  }

  return (
    <section
      aria-labelledby="pulse-card-h"
      className="rounded-2xl border border-[#e7e3da] bg-white p-4"
      data-testid="pulse-results-card"
    >
      <h2 id="pulse-card-h" className="text-[15px] font-semibold">
        Share the results
      </h2>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
        <label className="flex min-h-9 items-center gap-2">
          <input
            type="checkbox"
            checked={withCircle && circleReady}
            disabled={!circleReady}
            onChange={(e) => {
              setWithCircle(e.target.checked);
              if (e.target.checked) setPlace("");
            }}
            className="h-4 w-4"
          />
          Show my circle
          {circleReady ? "" : ` (at ${results.minGroup} votes)`}
        </label>
        {places.length > 0 ? (
          <label className="flex min-h-9 items-center gap-2">
            Or a province
            <select
              value={place}
              onChange={(e) => {
                setPlace(e.target.value);
                if (e.target.value) setWithCircle(false);
              }}
              data-testid="pulse-card-place"
              className="min-h-10 rounded-lg border border-[#d9d4c8] bg-white px-2 text-[14px]"
            >
              <option value="">None</option>
              {places.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-[#e7e3da] bg-[#fbfaf7]">
        {/* eslint-disable-next-line @next/next/no-img-element -- a generated card, never a static asset */}
        <img
          key={src}
          src={src}
          alt={`Results card for “${question}”`}
          width={1080}
          height={1350}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          data-testid="pulse-card-image"
          className={`mx-auto aspect-[4/5] w-full max-w-sm transition-opacity ${loaded ? "opacity-100" : "opacity-40"}`}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={share}
          data-testid="pulse-card-share"
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#14161a] px-5 text-[15px] font-semibold text-white"
        >
          <Share2 className="h-4 w-4" aria-hidden /> Share results card
        </button>
        <a
          href={src}
          download="peoples-pulse-results.png"
          data-testid="pulse-card-download"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[#d9d4c8] bg-white px-5 text-[15px] font-semibold"
        >
          <Download className="h-4 w-4" aria-hidden /> Save
        </a>
      </div>
      <p role="status" className="mt-2 text-[13px] text-[#5c6370]">
        {msg}
      </p>
    </section>
  );
}

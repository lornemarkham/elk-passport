"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Share2 } from "lucide-react";
import {
  FEATURES,
  type FeatureId,
  type PinView,
} from "@/domain/christmas/lights/model";
import { send } from "./api";
import { SeasonBadge } from "./PinCard";

/** Share a published display with friends and neighbours. Never a private one. */
export function ShareDisplay({ pin }: { readonly pin: PinView }) {
  const [said, setSaid] = useState<string | null>(null);
  if (pin.status !== "approved") return null;
  async function share() {
    const url = `${location.origin}/christmas/lights/${pin.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: pin.name,
          text: `Come see ${pin.name} — on the Christmas Lights Map`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setSaid("Link copied — send it to friends and neighbours.");
    } catch {
      setSaid(url);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0f3b2b] px-4 text-sm font-bold text-white"
        data-testid="share-display"
      >
        <Share2 className="h-4 w-4" aria-hidden /> Share my display
      </button>
      {said && (
        <span className="w-full text-sm break-all" role="status">
          {said}
        </span>
      )}
    </>
  );
}

/**
 * **"Are your lights on again this Christmas?"** One tap. A published
 * display last confirmed in an earlier season is not on tonight's map until
 * someone says so — and the person who pinned it is the first to ask.
 */
export function StillOn({ pin }: { readonly pin: PinView }) {
  const router = useRouter();
  const [say, setSay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (pin.status !== "approved" || pin.season === "lit") return null;
  async function tell(what: "on" | "dark") {
    setBusy(true);
    const r = await send(`/christmas/api/lights/${pin.id}`, {
      action: "check",
      what,
    });
    setBusy(false);
    if (r.ok) {
      setSay(
        what === "on"
          ? "💡 Wonderful — it's back on the map for this season."
          : "Thanks for saying. It stays off tours this year; your photos and ratings are kept.",
      );
      router.refresh();
    } else setSay(r.error ?? "That didn't work — try again.");
  }
  return (
    <div
      className="rounded-2xl bg-[#ffd98a] p-3 text-[#082319]"
      data-testid="still-on"
    >
      <p className="font-extrabold">
        {pin.ownLights
          ? "Are your lights on again this Christmas?"
          : "Is it lit again this Christmas?"}
      </p>
      {pin.lastConfirmed && (
        <p className="text-sm">Last confirmed {pin.lastConfirmed}.</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void tell("on")}
          className="min-h-11 rounded-full bg-[#082319] px-4 text-sm font-extrabold text-white"
          data-testid="still-on-yes"
        >
          💡 Yes, they&apos;re on!
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void tell("dark")}
          className="min-h-11 rounded-full px-4 text-sm font-bold ring-1 ring-[#082319]/30"
          data-testid="still-on-no"
        >
          Not this year
        </button>
      </div>
      {say && (
        <p className="mt-2 text-sm font-bold" role="status">
          {say}
        </p>
      )}
    </div>
  );
}

/** Music, hours, walk-through, family-friendly, what's special — after pinning, never required. */
export function AddDetails({
  pin,
  open: startOpen = false,
}: {
  readonly pin: PinView;
  readonly open?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [features, setFeatures] = useState<FeatureId[]>([...pin.features]);
  const [hours, setHours] = useState(pin.hours ?? "");
  const [special, setSpecial] = useState(pin.description ?? "");
  const [say, setSay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-full px-4 text-sm font-bold ring-1 ring-[#e3a83b]"
        data-testid="details-open"
      >
        + Add details (optional)
      </button>
    );
  async function save() {
    setBusy(true);
    const r = await send(`/christmas/api/lights/${pin.id}`, {
      action: "details",
      features,
      hours,
      description: special,
    });
    setBusy(false);
    if (r.ok) {
      setSay("Saved — thank you!");
      router.refresh();
    } else setSay(r.error ?? "That didn't save — try again.");
  }
  return (
    <form
      className="w-full space-y-3 rounded-[20px] bg-white p-4 text-[#082319]"
      data-testid="details"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="font-extrabold">A few details (all optional)</p>
      <div className="flex flex-wrap gap-2">
        {FEATURES.map((f) => {
          const on = features.includes(f.id);
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setFeatures(
                  on ? features.filter((x) => x !== f.id) : [...features, f.id],
                )
              }
              className={`min-h-10 rounded-full px-3 text-sm font-bold ${on ? "bg-[#0f3b2b] text-white" : "ring-1 ring-[#0f3b2b]/20"}`}
              data-testid={`detail-${f.id}`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <label className="block">
        <span className="text-sm font-bold">Operating hours</span>
        <input
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          maxLength={80}
          placeholder="Dusk to 10 pm, Dec 1 – Jan 2"
          className="mt-1 w-full rounded-xl border border-[#0f3b2b]/20 p-3 text-base"
          data-testid="details-hours"
        />
      </label>
      <label className="block">
        <span className="text-sm font-bold">Special features</span>
        <textarea
          value={special}
          onChange={(e) => setSpecial(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Synced to 99.3 FM, a train round the roof…"
          className="mt-1 w-full rounded-xl border border-[#0f3b2b]/20 p-3 text-base"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 rounded-full bg-[#b3242f] px-5 font-extrabold text-white"
        data-testid="details-save"
      >
        {busy ? "Saving…" : "Save details"}
      </button>
      {say && (
        <p className="text-sm font-bold" role="status">
          {say}
        </p>
      )}
    </form>
  );
}

/** The signed-in person's own pins: where each stands, and the one-tap jobs. */
export function MyLights({ pins }: { readonly pins: readonly PinView[] }) {
  if (pins.length === 0) return null;
  return (
    <section className="mt-8" data-testid="my-pins">
      <h2 className="ghad-display text-2xl font-extrabold text-white">
        Your lights
      </h2>
      <p className="text-white/80">
        Only you and the reviewers see a pin until it&apos;s published.
      </p>
      <ul className="mt-3 space-y-3">
        {pins.map((p) => (
          <li
            key={p.id}
            className="space-y-2 rounded-[22px] bg-white/10 p-4 ring-1 ring-white/15"
            data-testid="my-pin"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/christmas/lights/${p.id}`}
                className="font-extrabold hover:underline"
              >
                {p.name}
              </Link>
              <SeasonBadge pin={p} />
            </div>
            <StillOn pin={p} />
            <div className="flex flex-wrap items-center gap-2">
              <ShareDisplay pin={p} />
              <AddDetails pin={p} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

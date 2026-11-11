"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, Crosshair, MapPin, PartyPopper } from "lucide-react";
import {
  FEATURES,
  KINDS,
  KIND_EMOJI,
  KIND_LABEL,
  TOWN_AT,
  TOWN_LABEL,
  TOWNS,
  inArea,
  type FeatureId,
  type Kind,
  type LatLng,
  type PinView,
  type TownId,
} from "@/domain/christmas/lights/model";
import { shrinkPhoto } from "../photo";
import { LightsMap } from "./LightsMap";
import { send } from "./api";

type Consent = "i-live-here" | "owner-said-yes" | "public-listing" | "not-sure";

const HOURS = [
  "Dusk to 10 pm",
  "5–9 pm nightly",
  "Weekends only",
  "Until New Year's",
];

/**
 * **PIN THE MAGIC!** Six small steps on one page: where, a photo, a name,
 * a line about it, when to see it, and — for a home — whose okay it has.
 * Nothing is public until a reviewer publishes it.
 */
export function PinForm({ town }: { readonly town: TownId | null }) {
  const [at, setAt] = useState<LatLng | null>(null);
  const [center, setCenter] = useState<LatLng>(TOWN_AT[town ?? "vernon"]);
  const [locating, setLocating] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoSay, setPhotoSay] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>("home");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [address, setAddress] = useState("");
  const [features, setFeatures] = useState<FeatureId[]>([]);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [consentUrl, setConsentUrl] = useState("");
  const [isHome, setIsHome] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    pin: PinView;
    alsoHere: { id: string; name: string }[];
  } | null>(null);

  const residential = kind === "home" || isHome;

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (!inArea(here)) {
          setError(
            "You look to be outside the map's five towns — tap the map where the display is instead.",
          );
          return;
        }
        setAt(here);
        setCenter(here);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoSay("Shrinking it for the map…");
    try {
      setPhoto(await shrinkPhoto(file));
      setPhotoSay(null);
    } catch {
      setPhoto(null);
      setPhotoSay("That photo didn't work — try another.");
    }
  }

  async function submit() {
    setError(null);
    if (!at) {
      setError("Tap the map where the display is first.");
      return;
    }
    setBusy(true);
    const r = await send("/christmas/api/lights/submit", {
      kind,
      name,
      description,
      hours,
      address,
      features,
      lat: at.lat,
      lng: at.lng,
      residential,
      ...(consent && consent !== "not-sure" ? { consentClaim: consent } : {}),
      ...(consent === "public-listing" && consentUrl ? { consentUrl } : {}),
      ...(photo ? { photo } : {}),
    });
    setBusy(false);
    if (r.ok && r.pin)
      setDone({
        pin: r.pin,
        alsoHere: (r.alsoHere as { id: string; name: string }[]) ?? [],
      });
    else setError(r.error ?? "That didn't send — try again.");
  }

  if (done)
    return (
      <section
        className="rounded-[28px] bg-white p-6 text-center text-[#082319] shadow-2xl"
        data-testid="pin-done"
        role="status"
      >
        <PartyPopper className="mx-auto h-12 w-12 text-[#b3242f]" aria-hidden />
        <h2 className="ghad-display mt-3 text-3xl font-extrabold">
          You pinned the magic!
        </h2>
        <p className="mt-2 text-lg">
          <strong>{done.pin.name}</strong> is with a reviewer now.{" "}
          {residential
            ? "Because it's a home, nobody else sees it — not even roughly where — until its owner's okay is recorded."
            : "Once they've checked it, families will find it on the map."}
        </p>
        <p
          className="mt-3 inline-flex rounded-full bg-[#f7e3e1] px-4 py-2 text-sm font-bold text-[#b3242f]"
          data-testid="pin-status"
        >
          Status: waiting for a reviewer
        </p>
        {done.alsoHere.length > 0 && (
          <p className="mt-3 text-sm">
            There&apos;s already a pin right here:{" "}
            {done.alsoHere.map((a) => a.name).join(", ")}. The reviewer will
            join them up if they&apos;re the same.
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href={`/christmas/lights/${done.pin.id}`}
            className="inline-flex min-h-12 items-center rounded-full bg-[#ffd98a] px-6 font-extrabold"
            data-testid="see-my-pin"
          >
            See my pin
          </Link>
          <button
            type="button"
            onClick={() => location.reload()}
            className="inline-flex min-h-12 items-center rounded-full px-6 font-bold ring-1 ring-[#0f3b2b]/25"
          >
            Pin another
          </button>
        </div>
      </section>
    );

  const step =
    "rounded-[24px] bg-white p-5 text-[#082319] shadow-[0_6px_24px_rgba(8,35,25,0.1)]";
  const n = (i: number) => (
    <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#b3242f] text-sm font-extrabold text-white">
      {i}
    </span>
  );

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      data-testid="pin-form"
    >
      <section className={step}>
        <h2 className="ghad-display flex items-center text-xl font-extrabold">
          {n(1)}Where is it?
        </h2>
        <p className="mt-1 text-sm text-[#3d4a43]">
          Tap the map where the display is, then drag the pin to fine-tune.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={locate}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0f3b2b] px-4 text-sm font-bold text-white"
          >
            <Crosshair className="h-4 w-4" aria-hidden />{" "}
            {locating ? "Finding you…" : "I'm standing in front of it"}
          </button>
          {TOWNS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setCenter(TOWN_AT[t])}
              className="min-h-11 rounded-full px-3 text-sm font-bold ring-1 ring-[#0f3b2b]/20"
            >
              {TOWN_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <LightsMap
            markers={[]}
            center={center}
            zoom={13}
            pick={{ at, onPick: setAt }}
            className="h-[300px]"
            label="Tap where the display is"
          />
        </div>
        <p className="mt-2 text-sm font-bold" data-testid="pick-said">
          {at ? (
            <span className="inline-flex items-center gap-1 text-[#0f3b2b]">
              <MapPin className="h-4 w-4" aria-hidden /> Pinned. Drag it if
              it&apos;s not quite right.
            </span>
          ) : (
            <span className="text-[#5b4a2e]">No pin yet.</span>
          )}
        </p>
      </section>

      <section className={step}>
        <h2 className="ghad-display flex items-center text-xl font-extrabold">
          {n(2)}A photo
        </h2>
        <p className="mt-1 text-sm text-[#3d4a43]">
          From the street, please — the lights, not the people.
        </p>
        <label className="mt-3 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-[#ffd98a] px-5 font-extrabold">
          <Camera className="h-5 w-5" aria-hidden />{" "}
          {photo ? "Change the photo" : "Take or choose a photo"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => void pickPhoto(e.target.files?.[0])}
            data-testid="photo-input"
          />
        </label>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/jpeg;base64,${photo}`}
            alt="Your photo"
            className="mt-3 max-h-64 rounded-2xl object-cover"
            data-testid="photo-preview"
          />
        )}
        {photoSay && (
          <p className="mt-2 text-sm" role="status">
            {photoSay}
          </p>
        )}
      </section>

      <section className={step}>
        <h2 className="ghad-display flex items-center text-xl font-extrabold">
          {n(3)}What is it?
        </h2>
        <div
          className="mt-3 flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="Kind of display"
        >
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`min-h-11 rounded-full px-4 text-sm font-bold ${kind === k ? "bg-[#b3242f] text-white" : "ring-1 ring-[#0f3b2b]/20"}`}
              data-testid={`kind-${k}`}
            >
              {KIND_EMOJI[k]} {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="font-bold">Give it a name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={3}
            maxLength={80}
            placeholder="The Reindeer House on the hill"
            className="mt-1 w-full rounded-xl border border-[#0f3b2b]/20 p-3 text-base"
            data-testid="pin-name-input"
          />
        </label>
        <label className="mt-4 block">
          <span className="font-bold">
            What makes it magic?{" "}
            <span className="font-normal text-[#5b4a2e]">(optional)</span>
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Synced to music on the radio, a train that goes round the roof…"
            className="mt-1 w-full rounded-xl border border-[#0f3b2b]/20 p-3 text-base"
          />
        </label>
        <fieldset className="mt-4">
          <legend className="font-bold">
            Good to know{" "}
            <span className="font-normal text-[#5b4a2e]">(optional)</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {FEATURES.map((f) => {
              const on = features.includes(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setFeatures(
                      on
                        ? features.filter((x) => x !== f.id)
                        : [...features, f.id],
                    )
                  }
                  className={`min-h-10 rounded-full px-3 text-sm font-bold ${on ? "bg-[#0f3b2b] text-white" : "ring-1 ring-[#0f3b2b]/20"}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section className={step}>
        <h2 className="ghad-display flex items-center text-xl font-extrabold">
          {n(4)}When should families come?
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHours(h)}
              className={`min-h-10 rounded-full px-3 text-sm font-bold ${hours === h ? "bg-[#0f3b2b] text-white" : "ring-1 ring-[#0f3b2b]/20"}`}
            >
              {h}
            </button>
          ))}
        </div>
        <input
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          maxLength={80}
          placeholder="Or say it your way"
          className="mt-3 w-full rounded-xl border border-[#0f3b2b]/20 p-3 text-base"
          data-testid="hours-input"
        />
      </section>

      <section className={step} data-testid="privacy-step">
        <h2 className="ghad-display flex items-center text-xl font-extrabold">
          {n(5)}Whose place is it?
        </h2>
        {kind !== "home" && (
          <label className="mt-3 flex min-h-11 items-center gap-2 font-bold">
            <input
              type="checkbox"
              checked={isHome}
              onChange={(e) => setIsHome(e.target.checked)}
            />{" "}
            It&apos;s someone&apos;s home
          </label>
        )}
        {residential ? (
          <>
            <p className="mt-2 text-sm text-[#3d4a43]">
              We never show a home without the owner&apos;s okay. Until a
              reviewer records it, your pin stays private — only you and the
              reviewers see it.
            </p>
            <div
              className="mt-3 space-y-2"
              role="radiogroup"
              aria-label="Permission"
            >
              {(
                [
                  ["i-live-here", "It's my home and I'm happy to share it"],
                  ["owner-said-yes", "The owner told me they'd love visitors"],
                  [
                    "public-listing",
                    "It's on a public list (the town's lights map, the news…)",
                  ],
                  ["not-sure", "I'm not sure — keep it private for now"],
                ] as const
              ).map(([id, label]) => (
                <label key={id} className="flex min-h-11 items-center gap-2">
                  <input
                    type="radio"
                    name="consent"
                    checked={consent === id}
                    onChange={() => setConsent(id)}
                    data-testid={`consent-${id}`}
                  />
                  {label}
                </label>
              ))}
            </div>
            {consent === "public-listing" && (
              <input
                value={consentUrl}
                onChange={(e) => setConsentUrl(e.target.value)}
                placeholder="https://… the page that lists it"
                className="mt-2 w-full rounded-xl border border-[#0f3b2b]/20 p-3 text-base"
              />
            )}
            <label className="mt-3 block">
              <span className="font-bold">
                Street address{" "}
                <span className="font-normal text-[#5b4a2e]">
                  (optional — shown only with the owner&apos;s okay)
                </span>
              </span>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={120}
                className="mt-1 w-full rounded-xl border border-[#0f3b2b]/20 p-3 text-base"
              />
            </label>
          </>
        ) : (
          <label className="mt-3 block">
            <span className="font-bold">
              Venue or street{" "}
              <span className="font-normal text-[#5b4a2e]">(optional)</span>
            </span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={120}
              placeholder="Polson Park, by the bandstand"
              className="mt-1 w-full rounded-xl border border-[#0f3b2b]/20 p-3 text-base"
            />
          </label>
        )}
      </section>

      {error && (
        <p
          className="rounded-2xl bg-[#f7e3e1] p-4 font-bold text-[#b3242f]"
          role="alert"
          data-testid="pin-error"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#b3242f] text-lg font-extrabold text-white disabled:opacity-60"
        data-testid="pin-submit"
      >
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm text-[#b3242f]">
          6
        </span>
        {busy ? "Sending the magic…" : "Pin it!"}
      </button>
    </form>
  );
}

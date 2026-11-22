"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Crosshair,
  ImagePlus,
  MapPin,
  PartyPopper,
  Search,
} from "lucide-react";
import {
  TOWN_AT,
  inArea,
  type LatLng,
  type PinView,
  type TownId,
} from "@/domain/christmas/lights/model";
import { shrinkPhoto } from "../photo";
import { LightsMap } from "./LightsMap";
import { send } from "./api";

type What = "home" | "public-display";

interface Found {
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
}

/** One random token per phone, so a household behind one connection isn't one person. */
function deviceToken(): string {
  try {
    let d = localStorage.getItem("xmas-lights-device");
    if (!d) {
      d = crypto.randomUUID().replace(/-/g, "");
      localStorage.setItem("xmas-lights-device", d);
    }
    return d;
  } catch {
    return "";
  }
}

/**
 * **Add to Christmas Map** — community launch (2026-11-22). Anyone may add a
 * display: no account, three steps — where it is, a photo (from the street,
 * no people, no plates), and what it is. Nobody is asked whose home it is or
 * for anyone's permission: every submission waits for the administrator, and
 * a household can have its listing taken down at once (`requestRemoval`).
 */
export function PinForm({ town }: { readonly town: TownId | null }) {
  const [at, setAt] = useState<LatLng | null>(null);
  const [center, setCenter] = useState<LatLng>(TOWN_AT[town ?? "vernon"]);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoSay, setPhotoSay] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [what, setWhat] = useState<What | null>(null);
  const [about, setAbout] = useState("");
  const [photoOk, setPhotoOk] = useState(false);
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const opened = useRef(0);
  useEffect(() => {
    opened.current = Date.now();
  }, []);
  const [done, setDone] = useState<{
    name: string;
    pin: PinView | null;
    alsoHere: { id: string; name: string }[];
  } | null>(null);

  function place(here: LatLng, say?: string) {
    if (!inArea(here)) {
      setError(
        say ??
          "That's outside the map's towns for now — move the pin to where the display is.",
      );
      return;
    }
    setError(null);
    setAt(here);
    setCenter(here);
  }

  function locate() {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        place(
          { lat: p.coords.latitude, lng: p.coords.longitude },
          "You look to be outside the map's towns — tap the map where the display is instead.",
        );
      },
      () => {
        setLocating(false);
        setError("Couldn't find you — tap the map or search the address.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function search() {
    if (query.trim().length < 3) return;
    setSearching(true);
    setFound(null);
    try {
      const r = await fetch(
        `/christmas/api/lights/find-address?q=${encodeURIComponent(query.trim())}`,
      );
      const data = (await r.json().catch(() => ({}))) as {
        found?: Found[];
        error?: string;
      };
      setFound(data.found ?? []);
      if (!data.found?.length)
        setError(
          data.error ??
            "Nothing found by that name around here — move the pin instead.",
        );
      else if (data.found.length === 1) place(data.found[0]!);
    } catch {
      setError("Address search isn't answering — move the pin instead.");
    }
    setSearching(false);
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
      setError("Step 1 first: put the pin where the lights are.");
      return;
    }
    if (!photo) {
      setError("Step 2: add a photo of the display from the street.");
      return;
    }
    if (!what) {
      setError("Step 3: say what kind of display it is.");
      return;
    }
    if (!photoOk) {
      setError(
        "Please tick the box to confirm the photo has no people, licence plates or private activity.",
      );
      return;
    }
    setBusy(true);
    const r = await send("/christmas/api/lights/submit", {
      kind: what,
      name,
      description: about,
      lat: at.lat,
      lng: at.lng,
      residential: what === "home",
      features: [],
      photo,
      photoOk,
      website: trap,
      device: deviceToken(),
      openedFor: Date.now() - opened.current,
    });
    setBusy(false);
    if (r.ok)
      setDone({
        name:
          (r.received as { name?: string } | undefined)?.name ?? "Your display",
        pin: r.pin ?? null,
        alsoHere: (r.alsoHere as { id: string; name: string }[]) ?? [],
      });
    else setError(r.error ?? "That didn't send — try again.");
  }

  if (done)
    return (
      <section
        className="space-y-4 rounded-[28px] bg-white p-6 text-center text-[#082319] shadow-2xl"
        data-testid="pin-done"
        role="status"
      >
        <PartyPopper className="mx-auto h-12 w-12 text-[#b3242f]" aria-hidden />
        <h2 className="ghad-display text-3xl font-extrabold">
          Thanks — it&apos;s in!
        </h2>
        <p className="text-lg">
          <strong>{done.name}</strong> is now waiting for review. We check every
          display before it appears on the public map, so you won&apos;t see it
          there yet — and nobody else can until it&apos;s approved.
        </p>
        <p
          className="inline-flex rounded-full bg-[#f7e3e1] px-4 py-2 text-sm font-bold text-[#b3242f]"
          data-testid="pin-status"
        >
          Status: pending review — not public yet
        </p>
        <p className="text-sm text-[#3d4a43]">
          Your name isn&apos;t shown anywhere. See{" "}
          <Link
            className="font-bold underline"
            href="/christmas/lights/privacy"
          >
            how submissions and removal work
          </Link>
          .
        </p>
        {done.alsoHere.length > 0 && (
          <p className="text-sm">
            There&apos;s already a display right here:{" "}
            {done.alsoHere.map((a) => a.name).join(", ")}. We&apos;ll join them
            up if they&apos;re the same.
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          {done.pin && (
            <Link
              href={`/christmas/lights?pin=${done.pin.id}`}
              className="inline-flex min-h-12 items-center rounded-full bg-[#ffd98a] px-6 font-extrabold"
              data-testid="see-my-pin"
            >
              See my submission
            </Link>
          )}
          <Link
            href="/christmas/lights"
            className="inline-flex min-h-12 items-center rounded-full px-6 font-bold ring-1 ring-[#0f3b2b]/25"
            data-testid="back-to-map"
          >
            Back to the map
          </Link>
          <button
            type="button"
            onClick={() => location.reload()}
            className="inline-flex min-h-12 items-center rounded-full px-6 font-bold ring-1 ring-[#0f3b2b]/25"
          >
            Add another
          </button>
        </div>
      </section>
    );

  const step =
    "rounded-[24px] bg-white p-4 text-[#082319] shadow-[0_6px_24px_rgba(8,35,25,0.1)]";
  const n = (i: number, ok: boolean) => (
    <span
      className={`mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold text-white ${ok ? "bg-[#0f3b2b]" : "bg-[#b3242f]"}`}
    >
      {ok ? "✓" : i}
    </span>
  );
  const choice = (on: boolean) =>
    `flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 text-left font-bold ${on ? "bg-[#b3242f] text-white" : "ring-1 ring-[#0f3b2b]/20"}`;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      data-testid="pin-form"
    >
      <section className={step} data-testid="step-location">
        <h2 className="ghad-display flex items-center text-xl font-extrabold">
          {n(1, !!at)}Where are the lights?
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={locate}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0f3b2b] px-4 text-sm font-bold text-white"
            data-testid="use-my-location"
          >
            <Crosshair className="h-4 w-4" aria-hidden />{" "}
            {locating ? "Finding you…" : "Use my location"}
          </button>
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
            placeholder="Or search an address"
            aria-label="Search an address"
            className="min-w-0 flex-1 rounded-xl border border-[#0f3b2b]/20 p-3 text-base"
            data-testid="address-input"
          />
          <button
            type="button"
            onClick={() => void search()}
            disabled={searching}
            className="inline-flex min-h-12 shrink-0 items-center gap-1 rounded-xl bg-[#ffd98a] px-4 font-bold"
            data-testid="address-search"
          >
            <Search className="h-4 w-4" aria-hidden />
            {searching ? "…" : "Find"}
          </button>
        </div>
        {found && found.length > 1 && (
          <ul className="mt-2 space-y-1" data-testid="address-found">
            {found.map((f) => (
              <li key={`${f.lat},${f.lng}`}>
                <button
                  type="button"
                  onClick={() => place(f)}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm ring-1 ring-[#0f3b2b]/15 hover:bg-[#fbf6ec]"
                >
                  {f.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <LightsMap
            markers={[]}
            center={center}
            zoom={13}
            pick={{ at, onPick: (p) => place(p) }}
            className="h-[240px]"
            label="Tap where the display is, then drag the pin"
          />
        </div>
        <p className="mt-2 text-sm font-bold" data-testid="pick-said">
          {at ? (
            <span className="inline-flex items-center gap-1 text-[#0f3b2b]">
              <MapPin className="h-4 w-4" aria-hidden /> Pinned. Drag it if
              it&apos;s not quite right.
            </span>
          ) : (
            <span className="text-[#5b4a2e]">
              Or tap the map, then drag the pin.
            </span>
          )}
        </p>
      </section>

      <section className={step} data-testid="step-photo">
        <h2 className="ghad-display flex items-center text-xl font-extrabold">
          {n(2, !!photo)}A photo (required)
        </h2>
        <p className="mt-1 text-sm text-[#3d4a43]">
          Take it from the street, public side only.{" "}
          <strong>No people, faces, licence plates or anything private</strong>{" "}
          — we reject photos that show them.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-[#ffd98a] px-5 font-extrabold">
            <Camera className="h-5 w-5" aria-hidden /> Take photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => void pickPhoto(e.target.files?.[0])}
              data-testid="photo-camera"
            />
          </label>
          <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full px-5 font-bold ring-1 ring-[#0f3b2b]/25">
            <ImagePlus className="h-5 w-5" aria-hidden /> Upload
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void pickPhoto(e.target.files?.[0])}
              data-testid="photo-input"
            />
          </label>
        </div>
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/jpeg;base64,${photo}`}
            alt="Your photo"
            className="mt-3 max-h-48 rounded-2xl object-cover"
            data-testid="photo-preview"
          />
        )}
        {photoSay && (
          <p className="mt-2 text-sm" role="status">
            {photoSay}
          </p>
        )}
        <label className="mt-3 block">
          <span className="text-sm font-bold">
            Display name{" "}
            <span className="font-normal text-[#5b4a2e]">(optional)</span>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="The Reindeer House on the hill"
            className="mt-1 w-full rounded-xl border border-[#0f3b2b]/20 p-3 text-base"
            data-testid="pin-name-input"
          />
        </label>
      </section>

      <section className={step} data-testid="privacy-step">
        <h2 className="ghad-display flex items-center text-xl font-extrabold">
          {n(3, !!what && photoOk)}What is it?
        </h2>
        <div
          className="mt-3 space-y-2"
          role="radiogroup"
          aria-label="What kind of display"
        >
          <button
            type="button"
            role="radio"
            aria-checked={what === "home"}
            onClick={() => setWhat("home")}
            className={choice(what === "home")}
            data-testid="what-home"
          >
            <span aria-hidden>🏠</span> A decorated home
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={what === "public-display"}
            onClick={() => setWhat("public-display")}
            className={choice(what === "public-display")}
            data-testid="what-public"
          >
            <span aria-hidden>✨</span> A park, street, shop or town display
          </button>
        </div>
        <label className="mt-3 block">
          <span className="text-sm font-bold">
            Tell families about it{" "}
            <span className="font-normal text-[#5b4a2e]">(optional)</span>
          </span>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Animated reindeer, music on the weekend, best after dark…"
            className="mt-1 w-full rounded-xl border border-[#0f3b2b]/20 p-3 text-base"
            data-testid="pin-about-input"
          />
        </label>
        <label className="mt-3 flex items-start gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={photoOk}
            onChange={(e) => setPhotoOk(e.target.checked)}
            className="mt-1 h-5 w-5"
            data-testid="photo-ok"
          />
          <span>
            My photo shows no identifiable people, licence plates or private
            activity.
          </span>
        </label>
        {/* A field only a script fills in. */}
        <div
          aria-hidden
          className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
        >
          <label>
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={trap}
              onChange={(e) => setTrap(e.target.value)}
              data-testid="pin-trap"
            />
          </label>
        </div>
        <p className="mt-3 text-sm text-[#3d4a43]" data-testid="spotted-note">
          Every display is checked before it appears on the public map. Your
          name is never shown, and a household can ask for its listing to come
          down at any time.{" "}
          <Link
            className="font-bold underline"
            href="/christmas/lights/privacy"
          >
            Privacy notice
          </Link>
        </p>
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
        {busy ? "Sending…" : "Add to Christmas Map"}
      </button>
    </form>
  );
}

"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PROVINCES, scopeLabel, type Pulse } from "@/lib/pulse/model";
import type { Snapshot } from "@/lib/pulse/service";
import { Disclaimer } from "./Disclaimer";
import { Report } from "./Report";
import { Results } from "./Results";
import { Share } from "./Share";
import { answerColor } from "./brand";

const POLL_MS = 4_000;
const PLACE_KEY = "peoples-pulse-place";

/**
 * **One Pulse on a phone**: the question, a one-screen ballot, then live
 * results, comparison and sharing. Polls while the page is visible, so the
 * numbers move without anyone reloading.
 */
export function PulseRoom({
  pulse,
  ballot,
  via,
  fresh,
}: {
  pulse: Pulse;
  ballot: string;
  via: string | null;
  fresh: boolean;
}) {
  const ids = useId();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [origin, setOrigin] = useState("");
  const viaRef = useRef<string | null>(via);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the page's own address and this phone's remembered place exist only after mount
    setOrigin(window.location.origin);
    const k = `peoples-pulse-via-${pulse.id}`;
    if (via) sessionStorage.setItem(k, via);
    else viaRef.current = sessionStorage.getItem(k);
    try {
      const saved = JSON.parse(localStorage.getItem(PLACE_KEY) ?? "null");
      if (saved?.province) setProvince(saved.province);
      if (saved?.city) setCity(saved.city);
    } catch {
      /* nothing saved */
    }
    if (!localStorage.getItem(PLACE_KEY) && pulse.scope.kind !== "canada") {
      setProvince(pulse.scope.province);
      if (pulse.scope.kind === "city") setCity(pulse.scope.city);
    }
  }, [pulse, via]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/pulse/${pulse.id}${reveal ? "?see=1" : ""}`, {
      cache: "no-store",
    }).catch(() => null);
    if (res?.ok) setSnap(await res.json());
    else if (res?.status === 503)
      setError("People's Pulse isn't set up here yet.");
  }, [pulse.id, reveal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first read of an external system (the server) is the subscription itself
    void load();
    const tick = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  async function vote(e: React.FormEvent) {
    e.preventDefault();
    if (!choice) return;
    setBusy(true);
    setError(null);
    if (province)
      localStorage.setItem(PLACE_KEY, JSON.stringify({ province, city }));
    const res = await fetch(`/api/pulse/${pulse.id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        option: choice,
        via: viaRef.current,
        province: province || null,
        city: province ? city : null,
        ballot,
      }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.ok && body) setSnap(body);
    else
      setError(
        body?.message ??
          body?.because ??
          "Your vote didn't go through. Check your connection and try again.",
      );
    setBusy(false);
  }

  const voted = snap?.me.option ?? null;
  const shareUrl =
    origin && snap
      ? `${origin}/labs/pulse/${pulse.id}?c=${snap.me.circle}`
      : "";
  const closed = snap ? !snap.open : false;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <header className="pt-3">
        <p className="flex flex-wrap gap-x-3 text-[13px] font-medium text-[#5c6370]">
          <span>{scopeLabel(pulse.scope)}</span>
          {pulse.expiresAt ? (
            <span>
              {closed ? "Closed" : "Closes"}{" "}
              {new Date(pulse.expiresAt).toLocaleDateString("en-CA", {
                month: "short",
                day: "numeric",
              })}
            </span>
          ) : null}
          {snap ? (
            <span>{snap.total.toLocaleString("en-CA")} votes</span>
          ) : null}
        </p>
        <h1
          className="font-heading mt-2 text-[30px] leading-[1.15] font-bold tracking-tight sm:text-[38px]"
          data-testid="pulse-question"
        >
          {pulse.question}
        </h1>
        {pulse.description ? (
          <p className="mt-3 text-[16px] leading-relaxed text-[#3f4550]">
            {pulse.description}
          </p>
        ) : null}
        {pulse.sourceUrl ? (
          <p className="mt-2 text-[14px]">
            <a
              href={pulse.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="font-medium text-[#2a78d6] underline underline-offset-2"
            >
              Read the source
            </a>
          </p>
        ) : null}
        <p className="mt-2 text-[12.5px] text-[#8a909a]">
          Asked by a visitor. People&apos;s Pulse doesn&apos;t check questions
          or claims.
        </p>
      </header>

      {fresh && shareUrl ? (
        <Share url={shareUrl} question={pulse.question} prominent />
      ) : null}

      {pulse.status === "review" ? (
        <p
          className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[15px] text-amber-900"
          data-testid="pulse-review"
        >
          This Pulse has been reported and is paused while someone looks at it.
        </p>
      ) : !snap ? (
        <div
          className="h-48 animate-pulse rounded-2xl bg-[#efece5]"
          aria-label="Loading"
        />
      ) : !voted && !closed ? (
        <form onSubmit={vote} className="grid gap-4" data-testid="pulse-ballot">
          <fieldset>
            <legend className="sr-only">Your answer</legend>
            <div className="grid gap-2.5">
              {pulse.options.map((o, i) => (
                <label
                  key={o.id}
                  data-testid={`pulse-option-${o.id}`}
                  className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 bg-white px-4 text-[17px] font-semibold transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#14161a]/40 ${
                    choice === o.id
                      ? "border-[#14161a]"
                      : "border-[#e7e3da] hover:border-[#bdb7aa]"
                  }`}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={o.id}
                    checked={choice === o.id}
                    onChange={() => setChoice(o.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2"
                    style={{ borderColor: answerColor(i) }}
                  >
                    {choice === o.id ? (
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ background: answerColor(i) }}
                      />
                    ) : null}
                  </span>
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>

          <details
            className="rounded-2xl border border-[#e7e3da] bg-white px-4 py-3"
            open={Boolean(province)}
          >
            <summary className="flex min-h-8 cursor-pointer items-center text-[14px] font-medium text-[#3f4550]">
              Where are you?{" "}
              <span className="ml-1.5 font-normal text-[#5c6370]">
                Optional — for comparing places
              </span>
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <select
                aria-label="Your province or territory"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="min-h-12 rounded-xl border border-[#d9d4c8] bg-white px-3 text-[16px]"
                id={`${ids}-prov`}
              >
                <option value="">Prefer not to say</option>
                {PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
              {province ? (
                <input
                  aria-label="Your city or town (optional)"
                  value={city}
                  maxLength={60}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City or town (optional)"
                  className="min-h-12 rounded-xl border border-[#d9d4c8] bg-white px-3 text-[16px]"
                />
              ) : null}
            </div>
            <p className="mt-2 text-[12.5px] text-[#5c6370]">
              Self-reported and never shown for small groups. Remembered on this
              phone only.
            </p>
          </details>

          {error ? (
            <p role="alert" className="text-[14px] font-medium text-[#b42318]">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!choice || busy}
            data-testid="pulse-vote"
            className="min-h-14 rounded-full bg-[#14161a] text-[17px] font-semibold text-white transition hover:bg-black disabled:opacity-40"
          >
            {busy ? "Counting…" : choice ? "Vote" : "Choose an answer"}
          </button>
          {!reveal ? (
            <button
              type="button"
              onClick={() => setReveal(true)}
              className="justify-self-center px-3 py-2 text-[13px] font-medium text-[#5c6370] underline underline-offset-2"
            >
              Just show me the results
            </button>
          ) : null}
        </form>
      ) : null}

      {snap?.me.option ? (
        <p
          role="status"
          className="text-[15px] font-semibold text-[#14161a]"
          data-testid="pulse-voted"
        >
          Thanks — your vote is in. Here&apos;s what people think so far.
        </p>
      ) : null}

      {snap?.results ? (
        <Results results={snap.results} mine={voted} pulse={pulse} />
      ) : null}

      {!fresh && shareUrl ? (
        <Share url={shareUrl} question={pulse.question} />
      ) : null}
      <Disclaimer compact />
      <Report pulseId={pulse.id} />
    </div>
  );
}

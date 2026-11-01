"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, MapPin, Megaphone, X } from "lucide-react";
import { toast } from "sonner";
import {
  NOTICE_KINDS,
  noticeKind,
  type NoticeKind,
} from "@/domain/christmas/together";
import { subjectHref } from "@/domain/experience/destination";
import { dayLabel } from "@/domain/christmas/plans";
import { cn } from "@/lib/utils";
import styles from "./christmas.module.css";
import { useStoredList } from "./stored";

export interface NoticeData {
  readonly id: string;
  readonly kind: NoticeKind;
  readonly headline: string;
  readonly body: string | null;
  readonly atlasRef: string | null;
  readonly askAck: boolean;
  readonly by: string;
  readonly createdAt: string;
  readonly ended: boolean;
  readonly acked: boolean;
  readonly ackedBy: readonly string[];
}

export interface StopOption {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
}

const POLL_MS = 30_000;
const HIDDEN_KEY = "passport.christmas.hidden-notices";

function ago(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return dayLabel(iso.slice(0, 10), true);
}

/**
 * **Announcements: the plan changed, and everyone needs to know.**
 *
 * At a real Hockey Night the restaurant was packed and the move to another
 * one got lost in chat (owner brief M466). Here the host's announcement
 * leads the page, in the group's own colours, until each person says _Got
 * it_ (or, when no answer was asked for, dismisses it). The host sees who
 * has it. Nothing is pushed to a phone (doctrine §6): the page checks every
 * half-minute while it is open and in view.
 */
export function Notices({
  adventureId,
  isOwner,
  memberCount,
  initial,
  stops,
  enabled,
}: {
  readonly adventureId: string;
  readonly isOwner: boolean;
  readonly memberCount: number;
  readonly initial: readonly NoticeData[];
  readonly stops: readonly StopOption[];
  readonly enabled: boolean;
}) {
  const [notices, setNotices] = useState<readonly NoticeData[]>(initial);
  const [hidden, setHidden] = useStoredList(HIDDEN_KEY);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch(`/christmas/api/${adventureId}/notices`, {
      cache: "no-store",
    }).catch(() => null);
    if (response?.ok) setNotices(await response.json());
  }, [adventureId]);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled, refresh]);

  async function act(id: string, action: "ack" | "end") {
    setBusy(id);
    const response = await fetch(
      `/christmas/api/${adventureId}/notices/${id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      },
    ).catch(() => null);
    setBusy(null);
    if (!response?.ok) {
      toast.error("Couldn't reach the group just now. Try again.");
      return;
    }
    await refresh();
  }

  function hide(id: string) {
    setHidden([...hidden, id].slice(-50));
  }

  if (!enabled) {
    return isOwner ? (
      <p
        className="rounded-[20px] bg-white p-4 text-sm text-[var(--gh-ink-soft)] ring-1 ring-black/5"
        data-testid="sharing-off"
      >
        <Megaphone className="mr-1 inline h-4 w-4" aria-hidden />
        Announcements, shared photos and challenges switch on when
        Passport&apos;s sharing step is applied. Planning, voting and invites
        work now.
      </p>
    ) : null;
  }

  const live = notices.filter(
    (n) =>
      !n.ended && !hidden.includes(n.id) && (isOwner || !n.askAck || !n.acked),
  );

  return (
    <div className="space-y-3" data-testid="notices">
      {live.map((n) => {
        const kind = noticeKind(n.kind);
        const place = n.atlasRef
          ? stops.find((s) => s.id === n.atlasRef)
          : undefined;
        const waiting = Math.max(0, memberCount - 1 - n.ackedBy.length);
        return (
          <section
            key={n.id}
            role="status"
            aria-live="polite"
            className="overflow-hidden rounded-[24px] bg-white shadow-[0_10px_40px_rgba(179,36,47,0.25)] ring-2 ring-[#b3242f]"
            data-testid="notice"
          >
            <div className={cn(styles.stripe, "h-2")} aria-hidden />
            <div className="p-5">
              <p className="text-sm font-black tracking-[0.14em] text-[#b3242f]">
                <span aria-hidden>{kind.emoji}</span> {kind.shout}
              </p>
              <p className="ghad-display mt-1 text-2xl leading-tight font-extrabold">
                {n.headline}
              </p>
              {n.body && <p className="mt-2 text-base">{n.body}</p>}
              {/* "3 min ago" is a moment later in the browser than on the server. */}
              <p
                className="mt-2 text-sm text-[var(--gh-ink-soft)]"
                suppressHydrationWarning
              >
                {n.by} · {ago(n.createdAt)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {place && (
                  <Link
                    href={subjectHref(place.kind, place.id)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-black/10 px-4 text-sm font-semibold hover:border-black/30"
                  >
                    <MapPin className="h-4 w-4" aria-hidden />
                    View {place.label}
                  </Link>
                )}
                {!isOwner && n.askAck && !n.acked && (
                  <button
                    type="button"
                    onClick={() => void act(n.id, "ack")}
                    disabled={busy === n.id}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#0f3b2b] px-5 text-sm font-bold text-white"
                    data-testid="notice-ack"
                  >
                    {busy === n.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Check className="h-4 w-4" aria-hidden />
                    )}
                    Got it!
                  </button>
                )}
                {!isOwner && !n.askAck && (
                  <button
                    type="button"
                    onClick={() => hide(n.id)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-black/10 px-4 text-sm font-semibold"
                  >
                    <X className="h-4 w-4" aria-hidden />
                    Dismiss
                  </button>
                )}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => void act(n.id, "end")}
                    disabled={busy === n.id}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-black/10 px-4 text-sm font-semibold"
                    data-testid="notice-end"
                  >
                    End it
                  </button>
                )}
              </div>
              {isOwner && n.askAck && (
                <p
                  className="mt-3 text-sm font-semibold"
                  data-testid="notice-seen"
                >
                  {n.ackedBy.length
                    ? `Got it: ${n.ackedBy.join(", ")}`
                    : "Nobody's said Got it yet"}
                  {waiting > 0 ? ` · waiting on ${waiting}` : ""}
                </p>
              )}
            </div>
          </section>
        );
      })}

      {isOwner &&
        (composing ? (
          <Composer
            adventureId={adventureId}
            stops={stops}
            onDone={async (sent) => {
              setComposing(false);
              if (sent) {
                toast.success(
                  "Announced. It stays at the top until everyone has it.",
                );
                await refresh();
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#b3242f] px-5 text-base font-bold text-white hover:brightness-110"
            data-testid="announce"
          >
            <Megaphone className="h-5 w-5" aria-hidden />
            Announce a change
          </button>
        ))}
    </div>
  );
}

function Composer({
  adventureId,
  stops,
  onDone,
}: {
  readonly adventureId: string;
  readonly stops: readonly StopOption[];
  readonly onDone: (sent: boolean) => void | Promise<void>;
}) {
  const [kind, setKind] = useState<NoticeKind>("change");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [place, setPlace] = useState("");
  const [askAck, setAskAck] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch(`/christmas/api/${adventureId}/notices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        headline,
        body: body || null,
        atlasRef: place || null,
        askAck,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const b = await response?.json().catch(() => ({}));
      setError(b?.error ?? "Couldn't send it. Try again.");
      return;
    }
    await onDone(true);
  }

  const input =
    "min-h-12 w-full rounded-2xl border-2 border-black/10 bg-white px-3 text-base focus:border-[#0f3b2b] focus:outline-none";

  return (
    <form
      onSubmit={send}
      className="space-y-4 rounded-[24px] bg-white p-5 ring-2 ring-[#b3242f]/30"
      aria-label="Announce a change"
    >
      <div className="flex flex-wrap gap-2">
        {NOTICE_KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            aria-pressed={kind === k.id}
            className={cn(
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-semibold",
              kind === k.id
                ? "border-[#b3242f] bg-[#b3242f] text-white"
                : "border-black/10",
            )}
          >
            <span aria-hidden>{k.emoji}</span> {k.label}
          </button>
        ))}
      </div>
      <input
        value={headline}
        onChange={(e) => setHeadline(e.target.value)}
        placeholder="The market's packed — we're going to the lights first"
        className={input}
        maxLength={120}
        required
        data-testid="notice-headline"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Anything else people need (optional)"
        className={cn(input, "min-h-24 py-3")}
        maxLength={600}
      />
      {stops.length > 0 && (
        <select
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          className={input}
          aria-label="Where to go"
        >
          <option value="">No place attached</option>
          {stops.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      )}
      <label className="flex min-h-11 items-center gap-3 text-base font-semibold">
        <input
          type="checkbox"
          checked={askAck}
          onChange={(e) => setAskAck(e.target.checked)}
          className="h-5 w-5 accent-[#0f3b2b]"
        />
        Ask everyone to say &ldquo;Got it&rdquo;
      </label>
      {error && (
        <p role="alert" className="font-semibold text-[#8e1d26]">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#b3242f] px-5 font-bold text-white disabled:opacity-60"
          data-testid="notice-send"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Tell everyone
        </button>
        <button
          type="button"
          onClick={() => void onDone(false)}
          className="inline-flex min-h-12 items-center rounded-full border-2 border-black/10 px-5 font-semibold"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

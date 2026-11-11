"use client";

import { useState } from "react";
import Link from "next/link";
import {
  REACTIONS,
  type PinView,
  type ReactionId,
} from "@/domain/christmas/lights/model";
import { send, signInHref } from "./api";

/**
 * **The five reactions** — big, tappable, one of each per account, tap again
 * to take it back. Signed out, a tap explains why it needs an account and
 * links to sign in.
 */
export function Reactions({
  pin,
  signedIn,
  compact = false,
}: {
  readonly pin: PinView;
  readonly signedIn: boolean;
  readonly compact?: boolean;
}) {
  const [view, setView] = useState(pin);
  const [busy, setBusy] = useState<ReactionId | null>(null);
  const [say, setSay] = useState<string | null>(null);
  const [burst, setBurst] = useState<ReactionId | null>(null);

  async function tap(id: ReactionId) {
    if (!signedIn) {
      setSay("signin");
      return;
    }
    setBusy(id);
    const giving = !view.mine.includes(id);
    // Show it at once; the server's answer replaces it.
    setView((v) => ({
      ...v,
      mine: giving ? [...v.mine, id] : v.mine.filter((m) => m !== id),
      reactions: { ...v.reactions, [id]: v.reactions[id] + (giving ? 1 : -1) },
    }));
    if (giving) setBurst(id);
    const r = await send(`/christmas/api/lights/${pin.id}`, {
      action: "react",
      reaction: id,
    });
    setBusy(null);
    if (r.ok && r.pin) setView(r.pin);
    else {
      setView(pin);
      setSay(
        r.signIn ? "signin" : (r.error ?? "That didn't work — try again."),
      );
    }
  }

  return (
    <div data-testid="reactions">
      <ul className={`flex flex-wrap gap-2 ${compact ? "" : "sm:gap-3"}`}>
        {REACTIONS.map((r) => {
          const on = view.mine.includes(r.id);
          const n = view.reactions[r.id];
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => void tap(r.id)}
                disabled={busy !== null}
                aria-pressed={on}
                data-testid={`react-${r.id}`}
                className={`relative inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-extrabold tracking-tight transition active:scale-95 motion-reduce:transition-none ${
                  on
                    ? "bg-[#b3242f] text-white shadow-[0_0_16px_rgba(255,217,138,.55)]"
                    : "bg-white text-[#082319] ring-1 ring-[#0f3b2b]/15 hover:ring-[#e3a83b]"
                }`}
              >
                <span
                  aria-hidden
                  className={burst === r.id ? "xm-burst" : ""}
                  onAnimationEnd={() => setBurst(null)}
                >
                  {r.emoji}
                </span>
                {compact ? null : r.label}
                <span
                  className={`tabular-nums ${on ? "text-white/90" : "text-[#0f3b2b]/60"}`}
                >
                  {n}
                </span>
                {compact ? <span className="sr-only">{r.label}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {say === "signin" ? (
        <p className="mt-2 text-sm text-[#5b4a2e]" role="status">
          Reactions need an account, so one person can&apos;t be a crowd.{" "}
          <Link
            className="font-bold underline"
            href={signInHref(`/christmas/lights/${pin.id}`)}
          >
            Sign in to react
          </Link>
        </p>
      ) : say ? (
        <p className="mt-2 text-sm text-[#b3242f]" role="status">
          {say}
        </p>
      ) : null}
    </div>
  );
}

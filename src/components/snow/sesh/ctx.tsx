"use client";

import Link from "next/link";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { Action } from "@/domain/snow/sesh/actions";
import type { Feature, Rider, Viewer, World } from "@/domain/snow/sesh/model";
import { mountainById } from "@/domain/snow/mountains";
import type { Earned } from "@/domain/snow/sesh/patches";
import styles from "./sesh.module.css";

/** One screen of Sesh Wars, from its URL (after `/snow/sesh-wars` or `/demo`). */
export type Screen =
  | { k: "home" }
  | { k: "mountain"; id: string }
  | { k: "feature"; id: string }
  | { k: "clip"; id: string }
  | { k: "challenge"; id: string }
  | { k: "rider"; id: string }
  | { k: "feed"; mountain?: string }
  | { k: "post"; feature?: string }
  | { k: "answer"; clip: string }
  | { k: "patches" }
  | { k: "me" }
  | { k: "missing" };

export function parseScreen(segs: readonly string[] = []): Screen {
  const [a, b] = segs;
  if (!a) return { k: "home" };
  const id = b && /^[A-Za-z0-9-]{1,80}$/.test(b) ? b : undefined;
  switch (a) {
    case "m":
      return id ? { k: "mountain", id } : { k: "missing" };
    case "f":
      return id ? { k: "feature", id } : { k: "missing" };
    case "c":
      return id ? { k: "clip", id } : { k: "missing" };
    case "x":
      return id ? { k: "challenge", id } : { k: "missing" };
    case "r":
      return id ? { k: "rider", id } : { k: "missing" };
    case "feed":
      return { k: "feed", mountain: id };
    case "post":
      return { k: "post", feature: id };
    case "answer":
      return id ? { k: "answer", clip: id } : { k: "missing" };
    case "patches":
      return { k: "patches" };
    case "me":
      return { k: "me" };
  }
  return { k: "missing" };
}

export type ActResult =
  { ok: true; created?: string } | { ok: false; reason: string };

export interface Upload {
  readonly video: File;
  readonly poster?: Blob;
}

export interface SeshCtx {
  readonly mode: "real" | "demo";
  /** `/snow/sesh-wars` or `/snow/sesh-wars/demo`. */
  readonly base: string;
  readonly world: World;
  readonly viewer: Viewer;
  readonly now: number;
  act(a: Action, upload?: Upload): Promise<ActResult>;
  readonly signIn: string;
  /** Demo only. */
  readonly demo?: { skip(): void; reset(): void; skippedHours: number };
  /** Patches just earned, shown once. */
  readonly celebrate: (e: Earned[]) => void;
}

const Ctx = createContext<SeshCtx | null>(null);
export const SeshProvider = Ctx.Provider;
export function useSesh(): SeshCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("Sesh Wars context missing");
  return c;
}

export const MOUNTAIN_NAME: Record<string, string> = {
  silverstar: "SilverStar",
  "big-white": "Big White",
  "whistler-blackcomb": "Whistler Blackcomb",
};
export const mountainName = (id: string) =>
  MOUNTAIN_NAME[id] ?? mountainById(id)?.name ?? id;

export function cx(...xs: (string | false | undefined | null)[]) {
  return xs.filter(Boolean).join(" ");
}

export function Chip({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: "demo" | "live";
}) {
  return (
    <span
      className={cx(
        styles.chip,
        tone === "demo" && styles.demoChip,
        tone === "live" && styles.liveChip,
      )}
    >
      {children}
    </span>
  );
}

export function FeatureChip({ f }: { f: Feature }) {
  if (f.demo) return <Chip tone="demo">Demo · fictional feature</Chip>;
  if (f.source)
    return <Chip tone="live">Resort-listed · read {f.source.checked}</Chip>;
  return <Chip>Unverified</Chip>;
}

export function Section({
  title,
  children,
  aside,
  id,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <section className="mt-8" aria-labelledby={id}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id={id} className={cx(styles.display, "text-2xl uppercase")}>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx(styles.card, "p-4", className)}>{children}</div>;
}

export function GoLink({
  href,
  children,
  war,
  className,
}: {
  href: string;
  children: ReactNode;
  war?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        war ? styles.war : styles.go,
        "inline-flex min-h-12 items-center justify-center rounded-full px-6 text-base",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function SoftLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        styles.btn,
        "inline-flex min-h-11 items-center justify-center px-4 text-sm",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function RiderLink({ rider }: { rider?: Rider }) {
  const { base } = useSesh();
  if (!rider) return <span>A rider</span>;
  return (
    <Link
      href={`${base}/r/${rider.id}`}
      className="font-extrabold underline decoration-2 underline-offset-2"
    >
      {rider.name}
    </Link>
  );
}

/** Share through the phone's own share sheet, or copy the link. */
export function ShareButton({
  path,
  title,
  text,
}: {
  path: string;
  title: string;
  text: string;
}) {
  const [said, setSaid] = useState<string | null>(null);
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setSaid("Link copied");
    } catch {
      setSaid(url);
    }
  }
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={share}
        className={cx(styles.btn, "min-h-11 px-4 text-sm")}
      >
        ↗ Share
      </button>
      {said && (
        <span role="status" className="mt-1 max-w-64 text-xs break-all">
          {said}
        </span>
      )}
    </span>
  );
}

export function Refusal({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return (
    <p
      role="alert"
      className="mt-2 rounded-lg border-2 border-[var(--sw-red)] bg-[#f6e3d8] px-3 py-2 text-sm font-semibold"
    >
      {reason}
    </p>
  );
}

export function useAct() {
  const { act } = useSesh();
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  async function run(a: Action, upload?: Upload): Promise<ActResult> {
    setBusy(true);
    setReason(null);
    try {
      const r = await act(a, upload);
      if (!r.ok) setReason(r.reason);
      return r;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, reason, setReason };
}

export { styles };

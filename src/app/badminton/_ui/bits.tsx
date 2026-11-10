"use client";

import { useEffect, useState, type ReactNode } from "react";
import { localClock } from "@/lib/courtqueue/clock";
import type { PersonView } from "@/lib/courtqueue/view";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function Avatar({ p, size = 36 }: { p: PersonView; size?: number }) {
  const initials = p.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return p.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/badminton/photo/${p.id}`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full object-cover ring-1 ring-white/20"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-white/10 font-bold text-white/80"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

export function Person({
  p,
  me,
  small,
  hot,
}: {
  p: PersonView | null;
  me?: string;
  small?: boolean;
  /** On the bright "you're up" card, where lime text would vanish. */
  hot?: boolean;
}) {
  if (!p)
    return (
      <span className={cx("italic", hot ? "opacity-60" : "text-white/40")}>
        open spot
      </span>
    );
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar p={p} size={small ? 26 : 34} />
      <span
        className={cx(
          "truncate",
          p.id === me &&
            (hot ? "font-black underline" : "font-bold text-lime-300"),
        )}
      >
        {p.name}
        {p.id === me ? " (you)" : ""}
      </span>
    </span>
  );
}

export function Card({
  children,
  className,
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone?: "hot" | "calm" | "warn";
}) {
  return (
    <section
      className={cx(
        "rounded-2xl p-4 shadow-lg",
        tone === "hot"
          ? "bg-lime-400 text-slate-950"
          : tone === "warn"
            ? "bg-amber-400/15 ring-1 ring-amber-300/40"
            : "bg-white/[0.06] ring-1 ring-white/10",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Btn({
  children,
  onClick,
  kind = "primary",
  big,
  disabled,
  type = "button",
  className,
  ...rest
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "danger" | "dark";
  big?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "rounded-xl font-bold transition active:scale-[0.98] disabled:opacity-40",
        big ? "w-full py-5 text-2xl tracking-wide" : "px-4 py-3 text-base",
        kind === "primary" && "bg-lime-400 text-slate-950",
        kind === "dark" && "bg-slate-950 text-lime-300",
        kind === "ghost" && "bg-white/10 text-white",
        kind === "danger" && "bg-rose-500/90 text-white",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Minutes and seconds since `from`, on the server's clock. */
export function Elapsed({ from, offset }: { from: number; offset: number }) {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [offset]);
  const s = Math.max(0, Math.floor((now - from) / 1000));
  return (
    <span className="tabular-nums">
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/60"
      role="dialog"
      aria-modal
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-slate-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-white/10 px-3 py-1 text-sm"
            aria-label="Close"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-2">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="relative h-6 w-11 cursor-pointer appearance-none rounded-full bg-white/20 transition before:absolute before:top-0.5 before:left-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition checked:bg-lime-400 checked:before:translate-x-5"
      />
    </label>
  );
}

export const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** On the wall in BC, by the same rule the server uses. */
export const clock = (at: number) => localClock(at);

import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./snow.module.css";

export function SnowPage({ children }: { children: ReactNode }) {
  return <div className={styles.root}>{children}</div>;
}

export function Card({
  children,
  className = "",
  ...rest
}: {
  children: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${styles.card} p-4 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function GoButton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${styles.go} inline-flex min-h-14 items-center justify-center rounded-full px-8 text-lg uppercase`}
    >
      {children}
    </Link>
  );
}

export function SoftLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`${styles.btn} inline-flex min-h-11 items-center justify-center px-5 text-sm font-semibold`}
    >
      {children}
    </Link>
  );
}

/**
 * **Where a fact came from.** Live is something fetched just now from a
 * named source; static is something Passport wrote down and may be out of
 * date. Never the same badge.
 */
export function Source({
  kind,
  children,
}: {
  kind: "live" | "static" | "missing";
  children: ReactNode;
}) {
  const cls = kind === "live" ? styles.live : styles.static;
  const word =
    kind === "live" ? "LIVE" : kind === "static" ? "STATIC" : "NOT CONNECTED";
  return (
    <span
      className={`${cls} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide`}
    >
      <span aria-hidden="true">
        {kind === "live" ? "●" : kind === "static" ? "◆" : "○"}
      </span>
      {word} · {children}
    </span>
  );
}

export const field = `${styles.field} min-h-11 w-full px-3 text-base`;
export const btn = `${styles.btn} min-h-11 px-4 text-sm font-semibold`;
export const btnOn = `${styles.on}`;
export const muted = styles.muted;
export { styles };

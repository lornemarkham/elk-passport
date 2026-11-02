"use client";

import Link from "next/link";
import { track } from "@vercel/analytics";

/** A link that counts one cookieless event when followed. Never anything about who. */
export function TrackedLink({
  href,
  event,
  props,
  className,
  children,
  ...rest
}: {
  href: string;
  event: string;
  props?: Record<string, string | number | boolean>;
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => track(event, props)}
      {...rest}
    >
      {children}
    </Link>
  );
}

import type { ReactNode } from "react";
import type { Experience } from "@/domain/experience/types";
import { QuickEntry } from "./QuickEntry";

/**
 * **The way into a quick experience, for the one subject that has one.**
 *
 * A map with a single entry rather than a framework with none. When a second
 * subject earns one of these, this is where it goes — and if a third never
 * does, nothing was built on the assumption that it would.
 *
 * The link makes a different promise from the card's own: the card opens the
 * detail page, and this says *make me care first*. Both exist, and the detail
 * page is never taken away.
 */
const QUICK: Record<string, { href: string; label: string }> = {
  "ddf146c6-7117-4520-a9fe-8326209fd5db": {
    href: "/quick/draconids",
    label: "Why you'd stand outside for this",
  },
};

export function quickFor(experience: Experience): ReactNode {
  const quick = QUICK[experience.id];
  if (!quick) return undefined;
  return <QuickEntry href={quick.href} label={quick.label} />;
}

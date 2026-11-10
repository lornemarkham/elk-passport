import Link from "next/link";
import { Sparkles } from "lucide-react";

/** The way in for anyone who knows something good: one big, plain button. */
export function ShareButton({
  className = "",
}: {
  readonly className?: string;
}) {
  return (
    <Link
      href="/local/share"
      data-testid="share-something"
      className={`inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--gh-sun,#ffd166)] px-5 text-base font-bold text-[var(--gh-ink,#111)] shadow-sm ${className}`}
    >
      <Sparkles className="h-5 w-5" aria-hidden />
      Know something we&apos;re missing?
    </Link>
  );
}

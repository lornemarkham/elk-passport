import { Compass } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "text-foreground font-heading inline-flex items-center gap-2 text-lg font-semibold tracking-tight",
        className,
      )}
    >
      <Compass className="text-primary size-5" strokeWidth={2.25} />
      ELK Passport
    </Link>
  );
}

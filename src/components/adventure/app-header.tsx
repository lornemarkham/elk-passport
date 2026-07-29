import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/adventure/logo";

export function AppHeader({
  backHref,
  backLabel = "Back",
}: {
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="flex items-center justify-between px-5 py-4 sm:px-8">
      <Logo />
      {backHref ? (
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
      ) : null}
    </header>
  );
}

import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PassportNav } from "@/components/shell/PassportNav";
import { currentUser } from "@/lib/auth/currentUser";
import { INTENTS } from "@/domain/discovery/intents";

/**
 * Passport's front door.
 *
 * ## What was wrong with it
 *
 * Eight tiles — *🍷 Wineries*, *🏖 Beaches*, *🥾 Hiking*, *🚲 Cycling*,
 * *🏌️ Golf*, *🍔 Food*, *🚤 Water*, *🔥 Hidden Gems* — styled exactly like
 * category filters, laid out in a grid, and **every one of them a dead
 * `<div>`**. They were the clearest "looks interactive, is not" control in the
 * product: the first thing a visitor sees and the first thing that does
 * nothing when pressed.
 *
 * Four of the eight also named things Passport cannot currently deliver —
 * there is no Golf or Cycling grouping, and *Hidden Gems* is not a fact Atlas
 * holds about anything. So they were not merely dead; half of them were a
 * promise the product has no way to keep.
 *
 * They are now the real intents, linking into Discovery already in that
 * intent. Five instead of eight, each one a door that opens.
 *
 * The page also had no navigation at all — no header, no sign-in, two links
 * on the whole screen. `PassportNav` is the same bar every other Passport
 * surface now carries.
 */
export default async function HomePage() {
  const user = await currentUser();

  return (
    <>
      <PassportNav displayName={user?.displayName ?? null} />
      <main className="bg-background min-h-screen">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-6 py-16 text-center sm:py-24">
          <div className="text-primary mb-4 flex items-center justify-center gap-2">
            <Compass className="h-5 w-5" aria-hidden />
            <span className="text-sm font-semibold tracking-wide">
              ELK Passport
            </span>
          </div>

          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            Discover the Okanagan.
          </h1>

          <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-lg text-balance">
            Real places, real dates, and a day worth getting out of the house
            for.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" render={<Link href="/discovery" />}>
              What could you do today?
            </Button>
            <Button
              size="lg"
              variant="outline"
              render={<Link href="/places" />}
            >
              Browse places
            </Button>
          </div>

          {/* Doors, not decoration. Each one opens Discovery already narrowed
              to that intent — the same `?intent=` the chips on Discovery set,
              so arriving here and arriving there are the same place. */}
          <nav
            aria-label="Start with what you feel like"
            className="mt-14 flex w-full max-w-3xl flex-wrap justify-center gap-3"
          >
            {INTENTS.map((intent) => (
              <Link
                key={intent.key}
                href={`/discovery?intent=${intent.key}`}
                data-testid={`home-intent-${intent.key}`}
                className="border-primary/20 hover:border-primary/50 hover:bg-primary/5 inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-medium transition-colors"
              >
                {intent.label}
              </Link>
            ))}
          </nav>
        </div>
      </main>
    </>
  );
}

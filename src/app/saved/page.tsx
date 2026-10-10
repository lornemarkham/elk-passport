import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import { PassportNav } from "@/components/shell/PassportNav";
import { SavedReview } from "@/components/saved/SavedReview";
import { currentUser } from "@/lib/auth/currentUser";
import { loadSaved } from "@/lib/data/loadSaved";
import { octoberThingsFor } from "@/lib/october/octoberThings";
import { safeNext } from "@/lib/auth/safeNext";

export const metadata: Metadata = { title: "Saved — Passport" };

/**
 * **The other half of discovering.**
 *
 * Collecting a handful of possibilities and looking at them together is one
 * journey, and it used to be two products: Discovery, then a board
 * administration area with a sharing panel above the things somebody had just
 * saved. The owner's route from one to the other and back took five screens
 * and passed two different pages called *My Places*.
 *
 * This is the round trip. `?back=` carries the exploration so *Back to
 * discovering* is one tap to exactly where they were, validated by the same
 * `safeNext` the sign-in handoff uses.
 */
export default async function SavedPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const asked = (await searchParams)?.["back"];
  const back = safeNext(typeof asked === "string" ? asked : null, "/discovery");

  const [user, saved] = await Promise.all([currentUser(), loadSaved()]);
  // The intentions already recorded, so Saved can show what somebody has
  // already decided rather than offering it to them again. Read-only here:
  // nothing about opening this page changes anybody's October.
  const october =
    saved.status === "ok" && user
      ? await octoberThingsFor(user).catch(() => [])
      : [];

  return (
    <>
      <PassportNav displayName={user?.displayName ?? null} />
      <main className="min-h-screen bg-[#ecdfc4]">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-12">
          <Link
            href={back}
            data-testid="back-to-discovering"
            className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#8a5a24] hover:text-[#2b2015]"
          >
            <Compass className="h-4 w-4" aria-hidden />
            Back to discovering
          </Link>

          <h1 className="font-heading mt-4 text-3xl text-[#2b2015] sm:text-4xl">
            Saved
          </h1>

          {saved.status === "signed-out" && (
            <Panel
              title="Sign in to see what you have saved"
              description="What you collect stays with your account, on any device."
            />
          )}
          {saved.status === "error" && (
            <Panel
              title="Couldn't load what you saved"
              description="Something went wrong reaching Atlas. Your collection is unchanged — try again in a moment."
            />
          )}
          {saved.status === "not-found" && (
            <Panel
              title="Couldn't open your collection"
              description="Nothing has been lost. Try again in a moment."
            />
          )}
          {saved.status === "nothing-yet" && (
            <Panel
              title="Nothing saved yet"
              description="Save anything that looks interesting while you browse, and it will be here to look at together."
            />
          )}

          {saved.status === "ok" && (
            <SavedReview
              boardId={saved.board.id}
              boardName={saved.board.name}
              experiences={saved.experiences}
              unresolved={saved.unresolved}
              october={october}
              back={back}
              readOnly={saved.role === "viewer"}
            />
          )}
        </div>
      </main>
    </>
  );
}

function Panel({
  title,
  description,
}: {
  readonly title: string;
  readonly description: string;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-[#8a5a24]/30 bg-[#f7ecd3]/40 px-5 py-12 text-center">
      <p className="font-heading text-lg text-[#2b2015]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#2b2015]/60">
        {description}
      </p>
    </div>
  );
}

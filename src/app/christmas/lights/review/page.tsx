import type { Metadata } from "next";
import Link from "next/link";
import { PassportNav } from "@/components/shell/PassportNav";
import { ThemeProvider } from "@/components/ghad/theme";
import { ReviewItem } from "@/components/christmas/lights/ReviewItem";
import christmas from "@/components/christmas/christmas.module.css";
import { adventureSession } from "@/lib/adventures/server";
import { lightsFor, viewer } from "../../_server/lights";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Review pins — Christmas Lights Map",
  robots: { index: false },
};

/** The reviewers' queue: new pins, privacy takedowns, and reports. Administrators and ambassadors only. */
export default async function ReviewPage() {
  const [session, v] = await Promise.all([adventureSession(), viewer()]);
  const { pins, ready } = v.reviewer
    ? await lightsFor(v)
    : { pins: [], ready: true };
  const waiting = pins.filter((p) => p.status === "pending");
  const hidden = pins.filter((p) => p.status === "hidden");
  const reported = pins.filter(
    (p) => p.status === "approved" && (p.review?.reports ?? 0) > 0,
  );
  const group = (title: string, list: typeof pins, id: string) => (
    <section className="mt-8" data-testid={`review-${id}`}>
      <h2 className="ghad-display text-2xl font-extrabold text-[#082319]">
        {title} ({list.length})
      </h2>
      {list.length === 0 ? (
        <p className="text-[#3d4a43]">Nothing here.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {list.map((p) => (
            <ReviewItem key={p.id} pin={p} />
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <>
      <PassportNav displayName={session?.user.displayName ?? null} />
      <ThemeProvider className="block">
        <main className={`${christmas.page} min-h-screen pb-24`}>
          <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
            <Link
              href="/christmas/lights"
              className="text-sm font-bold text-[#0f3b2b] underline"
            >
              ← The lights map
            </Link>
            <h1 className="ghad-display mt-2 text-4xl font-extrabold text-[#082319]">
              Review the magic
            </h1>
            {!v.reviewer ? (
              <p className="mt-3" data-testid="review-refused">
                This queue is for the Local Insider Network&apos;s
                administrators and ambassadors.{" "}
                {v.signedIn ? (
                  "Your account isn't one of them."
                ) : (
                  <Link
                    className="font-bold underline"
                    href="/auth?next=/christmas/lights/review"
                  >
                    Sign in
                  </Link>
                )}
              </p>
            ) : (
              <>
                {!ready && (
                  <p className="mt-3 font-bold text-[#b3242f]">
                    The store isn&apos;t answering — nothing can be reviewed
                    right now.
                  </p>
                )}
                <p className="mt-2 text-[#3d4a43]">
                  A home is published only once you record its owner&apos;s okay
                  or a public listing.
                </p>
                {group("Waiting for review", waiting, "waiting")}
                {group("Hidden after a privacy report", hidden, "hidden")}
                {group("Published, with reports", reported, "reported")}
              </>
            )}
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}

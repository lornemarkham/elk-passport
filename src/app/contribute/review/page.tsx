import type { Metadata } from "next";
import Link from "next/link";
import { ReviewQueue } from "@/components/contributions/ReviewQueue";
import { reviewView } from "@/domain/contributions/model";
import { contributor, readSuggestions } from "@/lib/contributions/server";
import { mailStatus } from "@/app/christmas/_server/notify";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Review suggestions — Passport",
  robots: { index: false },
};

/**
 * **One review queue for every experience** (owner brief 2026-11-23, P2):
 * the administrator reads, edits, approves, rejects and copies suggestions
 * for Atlas here, on a phone. Administrators only (`ADMIN_EMAILS`).
 */
export default async function ReviewPage() {
  const h = await headers();
  const fake = new Request(
    `http://${h.get("host") ?? "localhost"}/contribute/review`,
    { headers: h },
  );
  const who = await contributor(fake, null).catch(() => null);
  const reviewer = who?.reviewer ?? null;
  let items: ReturnType<typeof reviewView>[] = [];
  let ready = true;
  if (reviewer) {
    try {
      const { doc } = await readSuggestions();
      items = [...doc.suggestions]
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        .map((s) => reviewView(doc, s));
    } catch {
      ready = false;
    }
  }
  const mail = mailStatus();
  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-24 text-[#111] sm:px-6">
      <Link href="/admin" className="text-sm font-bold underline">
        ← Admin
      </Link>
      <h1 className="ghad-display mt-2 text-4xl font-extrabold tracking-[-0.02em]">
        Community suggestions
      </h1>
      <p className="mt-1 text-sm text-black/60">
        One queue for every experience · Approve, edit, reject, copy for Atlas
      </p>
      {!reviewer ? (
        <p className="mt-3" data-testid="review-refused">
          This page is for the administrator.{" "}
          {who?.signedIn ? (
            "Your account isn't one of them."
          ) : (
            <Link
              className="font-bold underline"
              href="/auth?next=/contribute/review"
            >
              Sign in
            </Link>
          )}
        </p>
      ) : (
        <>
          {!ready && (
            <p className="mt-3 font-bold text-[#b3242f]">
              The store isn&apos;t answering — nothing can be reviewed right
              now.
            </p>
          )}
          <p className="mt-2 text-black/70">
            Nothing a contributor sends is public. Approving counts it toward
            their milestones and, when it has a website, hands the page to Atlas
            to read. Copy for Atlas gives you the facts to paste. The Christmas
            lights map keeps{" "}
            <Link
              href="/christmas/lights/review"
              className="font-bold underline"
            >
              its own queue
            </Link>{" "}
            for pins.
          </p>
          <p
            className={`mt-3 rounded-2xl p-3 text-sm font-bold ${mail.on ? "bg-[#e8f3ec] text-[#0f3b2b]" : "bg-[#fff1ef] text-[#b3242f]"}`}
            data-testid="mail-status"
          >
            {mail.on
              ? `✉️ New suggestions are emailed to ${mail.to}.`
              : `✉️ Email notifications are OFF (${mail.why}). Check this page for new suggestions.`}
          </p>
          <ReviewQueue initial={items} />
        </>
      )}
    </main>
  );
}

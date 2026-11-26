import type { Metadata } from "next";
import Link from "next/link";
import { ThemeProvider } from "@/components/ghad/theme";
import { ReviewItem } from "@/components/christmas/lights/ReviewItem";
import christmas from "@/components/christmas/christmas.module.css";
import { launchStats } from "@/domain/christmas/lights/stats";
import { TOWN_LABEL, TOWNS } from "@/domain/christmas/lights/model";
import { lightsFor, readLights, viewer } from "../../_server/lights";
import { mailStatus } from "../../_server/notify";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Review — Christmas Lights Map",
  robots: { index: false },
};

/** The reviewers' queue: new pins, privacy takedowns, and reports. Administrators and ambassadors only. */
export default async function ReviewPage() {
  const v = await viewer();
  const { pins, ready } = v.reviewer
    ? await lightsFor(v)
    : { pins: [], ready: true };
  const stats = v.reviewer
    ? await readLights()
        .then((r) => launchStats(r.doc))
        .catch(() => null)
    : null;
  const mail = mailStatus();
  const bySubmitted = (a: (typeof pins)[number], b: (typeof pins)[number]) =>
    (b.review?.submittedAt ?? "").localeCompare(a.review?.submittedAt ?? "");
  const removals = pins.filter((p) => p.review?.removalOpen);
  const waiting = pins.filter((p) => p.status === "pending").sort(bySubmitted);
  const hidden = pins.filter(
    (p) => p.status === "hidden" && !p.review?.removalOpen,
  );
  // Researched public pins are Passport's own; the queue is for the community's.
  const published = pins
    .filter((p) => p.status === "approved" && !p.source)
    .sort(bySubmitted);
  const rejected = pins.filter((p) => p.status === "declined");
  const group = (title: string, list: typeof pins, id: string) => (
    <section className="mt-8 scroll-mt-4" id={id} data-testid={`review-${id}`}>
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
      <ThemeProvider className="block">
        <main className={`${christmas.page} min-h-screen pb-24`}>
          <div className="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
            <Link
              href="/christmas/lights"
              className="text-sm font-bold text-[#0f3b2b] underline"
            >
              ← The lights map
            </Link>
            <h1 className="ghad-display mt-2 text-4xl font-extrabold text-[#082319]">
              Review the magic
            </h1>
            <p className="mt-1 text-sm text-[#3d4a43]">
              Administrator dashboard · Christmas Lights Map
            </p>
            {!v.reviewer ? (
              <p className="mt-3" data-testid="review-refused">
                This dashboard is for the administrator.{" "}
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
                <p className="mt-2 text-sm">
                  <Link
                    href="/contribute/review"
                    className="font-bold underline"
                    data-testid="to-suggestions"
                  >
                    Community suggestions
                  </Link>{" "}
                  — restaurants, markets, events and more, from every
                  experience, are reviewed in their own queue.
                </p>
                <p className="mt-2 text-[#3d4a43]">
                  Nothing is public until you approve it. A removal request
                  hides a listing at once; you then delete it or restore it.
                  Check photos for people, faces, licence plates and private
                  activity before approving.
                </p>
                <p
                  className={`mt-3 rounded-2xl p-3 text-sm font-bold ${mail.on ? "bg-[#e8f3ec] text-[#0f3b2b]" : "bg-[#fff1ef] text-[#b3242f]"}`}
                  data-testid="mail-status"
                >
                  {mail.on
                    ? `✉️ New submissions and removal requests are emailed to ${mail.to}.`
                    : `✉️ Email notifications are OFF (${mail.why}). Check this page for new submissions.`}
                </p>
                <nav
                  aria-label="Queues"
                  className="sticky top-12 z-10 -mx-4 mt-4 flex gap-2 overflow-x-auto bg-[#fbf6ec]/95 px-4 py-2 backdrop-blur"
                >
                  {(
                    [
                      ["removals", "Removal requests", removals.length],
                      ["waiting", "Pending", waiting.length],
                      ["published", "Published", published.length],
                      ["hidden", "Hidden", hidden.length],
                      ["rejected", "Rejected", rejected.length],
                    ] as const
                  ).map(([id, label, n]) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white px-4 text-sm font-bold ring-1 ring-[#0f3b2b]/20"
                    >
                      {label} · {n}
                    </a>
                  ))}
                </nav>
                {stats && (
                  <section className="mt-6" data-testid="launch-stats">
                    <h2 className="ghad-display text-2xl font-extrabold text-[#082319]">
                      Launch numbers
                    </h2>
                    <p className="mt-1 text-sm text-[#3d4a43]">
                      Submissions come from the store. Visitors and page views
                      are in Vercel → Analytics (paths{" "}
                      <code>/christmas/lights</code>, <code>/tour</code>,{" "}
                      <code>/bingo</code>, <code>/pin</code>); events{" "}
                      <code>lights_pin_submitted</code>,{" "}
                      <code>lights_tour_saved</code>, <code>lights_report</code>
                      .
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {(
                        [
                          ["Submitted by families", stats.submissions],
                          ["Families", stats.families],
                          ["Waiting", stats.waiting],
                          ["Published", stats.published],
                          ["With a photo", stats.withPhoto],
                          ["Hidden", stats.hidden],
                          ["Declined", stats.declined],
                          ["Reports", stats.reports],
                          ["Reactions", stats.reactions],
                          ["Researched pins", stats.seeded],
                        ] as const
                      ).map(([label, n]) => (
                        <div
                          key={label}
                          className="rounded-2xl bg-white p-3 ring-1 ring-[#0f3b2b]/15"
                        >
                          <dt className="text-xs font-bold text-[#3d4a43]">
                            {label}
                          </dt>
                          <dd className="text-2xl font-extrabold text-[#082319]">
                            {n}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-3 text-sm text-[#3d4a43]">
                      {TOWNS.map(
                        (t) =>
                          `${TOWN_LABEL[t]}: ${stats.byTown[t].published} published, ${stats.byTown[t].waiting} waiting`,
                      ).join(" · ")}
                    </p>
                  </section>
                )}
                {group("Removal requests — hidden now", removals, "removals")}
                {group("Pending review", waiting, "waiting")}
                {group("Published", published, "published")}
                {group("Hidden", hidden, "hidden")}
                {group("Rejected", rejected, "rejected")}
              </>
            )}
          </div>
        </main>
      </ThemeProvider>
    </>
  );
}

import type { Metadata } from "next";
import { PassportNav } from "@/components/shell/PassportNav";
import { currentUser } from "@/lib/auth/currentUser";

export const metadata: Metadata = {
  title: "Conferences · Passport",
  // Private by intent. A conference is not a public listing, and neither is
  // the fact that one exists.
  robots: { index: false, follow: false },
};

/**
 * **`/conferences`: GO HAVE A CONFERENCE.** A private place for a group
 * that's about to be somewhere together. See
 * docs/products/go-have-a-conference/VISION.md.
 *
 * Reachable from the Go Have a Day bar under Experiences (owner decision,
 * 2026-10-15; see `PassportNav`), and from the Day Builder's own sentence.
 */
export default async function ConferencesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  return (
    <>
      <PassportNav displayName={user?.displayName ?? null} />
      <main className="bg-cf-paper text-cf-ink min-h-screen pb-24">
        {children}
      </main>
    </>
  );
}

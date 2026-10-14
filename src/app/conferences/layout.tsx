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
 * Not linked from the Passport nav yet. Whether it should be, and how, waits
 * on the open questions in ROADMAP.md, and the shell is a shared contract.
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
      <main className="min-h-screen bg-white pb-24 text-black">{children}</main>
    </>
  );
}

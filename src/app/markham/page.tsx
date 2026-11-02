import type { Metadata } from "next";
import { PassportNav } from "@/components/shell/PassportNav";
import { MARKHAM } from "@/domain/date-night/adventures/markham";
import { currentUser } from "@/lib/auth/currentUser";
import { OpenNight } from "@/components/night/OpenNight";

export const metadata: Metadata = {
  title: "The Markham Adventure ❤️",
  robots: { index: false },
};

/**
 * The front door of the Markham Adventure. It shows nothing private: a
 * title and a button. The adventure itself is made for you when you press it
 * (signed in), and is yours alone until you invite somebody.
 */
export default async function MarkhamPage() {
  const user = await currentUser().catch(() => null);
  return (
    <>
      <PassportNav displayName={user?.displayName ?? null} />
      <OpenNight
        slug={MARKHAM.slug}
        title={MARKHAM.title}
        tagline={MARKHAM.tagline}
        signedIn={user !== null}
      />
    </>
  );
}

import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/currentUser";
import { JoinNight } from "@/components/hockey/JoinNight";
import { inviteIsValid } from "../../_server/night";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "You're invited — Passport",
  robots: { index: false, follow: false },
};

/**
 * **The other end of an invitation.**
 *
 * Same rule as board invites (`/invite/[token]`): say what this is before
 * asking for an account, and ask for one at the moment it is genuinely needed.
 * Stricter than boards in one way — a signed-out visitor learns only that the
 * link is good. Not the night's name, not the host, not who else is going;
 * this is a private thing among coworkers and a forwarded link should not be
 * a guest list.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [valid, user] = await Promise.all([
    inviteIsValid(token).catch(() => false),
    currentUser(),
  ]);
  return (
    <JoinNight
      token={token}
      valid={valid}
      signedIn={user !== null}
      displayName={user?.displayName ?? null}
    />
  );
}

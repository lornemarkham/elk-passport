import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/currentUser";
import { describeInvite } from "@/lib/collaboration/invites";
import { InviteLanding } from "@/components/boards/InviteLanding";

export const metadata: Metadata = {
  title: "You've been invited — Passport",
};

/**
 * **The other end of a share link.**
 *
 * The rule this page exists to honour: somebody who taps a link should
 * understand what they are being invited to *before* being asked to make an
 * account. So the invitation is described while signed out, and identity is
 * requested at the moment of joining — which is the moment it is genuinely
 * required, because a membership row needs somebody to belong to.
 *
 * What it deliberately does not show: the board's name or anything on it. Those
 * belong to the owner, and a link that leaked would otherwise leak them to
 * whoever found it.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [invite, user] = await Promise.all([
    describeInvite(token).catch(() => null),
    currentUser(),
  ]);

  return (
    <InviteLanding
      token={token}
      valid={invite?.valid ?? false}
      role={invite?.role ?? null}
      known={invite !== null}
      signedIn={user !== null}
      displayName={user?.displayName ?? null}
    />
  );
}

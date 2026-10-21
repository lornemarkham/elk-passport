import type { Metadata } from "next";
import { JoinAdventure } from "@/components/adventures/JoinAdventure";
import { currentUser } from "@/lib/auth/currentUser";
import { visitorDb } from "@/lib/adventures/server";
import { describeInvite } from "@/lib/adventures/store";
import { kindLabel } from "@/lib/adventures/kinds";
import { TOKEN_PATTERN } from "@/lib/adventures/rules";

export const metadata: Metadata = {
  title: "You've been invited — Passport",
  robots: { index: false },
};

/** The landing for an invitation link. Works signed out; joins signed in. */
export default async function JoinAdventurePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [described, user] = await Promise.all([
    TOKEN_PATTERN.test(token)
      ? visitorDb()
          .then((db) => describeInvite(db, token))
          .catch(() => null)
      : Promise.resolve(null),
    currentUser().catch(() => null),
  ]);

  return (
    <JoinAdventure
      token={token}
      state={described?.state ?? "unknown"}
      kindLabel={described ? kindLabel(described.kind) : null}
      signedIn={user !== null}
    />
  );
}

import type { Metadata } from "next";
import { JoinAdventure } from "@/components/adventures/JoinAdventure";
import { currentUser } from "@/lib/auth/currentUser";
import { visitorDb } from "@/lib/adventures/server";
import { describeInvite } from "@/lib/adventures/store";
import { kindLabel } from "@/lib/adventures/kinds";
import { MARKHAM } from "@/domain/date-night/adventures/markham";
import { PHOTOS } from "@/domain/date-night/adventures/evenings";
import { TOKEN_PATTERN } from "@/lib/adventures/rules";

export const metadata: Metadata = {
  title: "You've been invited — Passport",
  robots: { index: false },
};

/** The landing for an invitation link. Works signed out; joins signed in. */
/** A texted Date Night link lands on its play: nowhere else is accepted. */
const NEXT = /^\/night\/[A-Za-z0-9_-]{1,64}(\?p=[0-9a-f-]{36})?$/i;

export default async function JoinAdventurePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { token } = await params;
  const { next } = await searchParams;
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
      next={typeof next === "string" && NEXT.test(next) ? next : null}
      invitation={
        described?.kind === "date-night-plan" ? MARKHAM.invitation : null
      }
      backdrop={
        described?.kind === "date-night-plan"
          ? {
              src: PHOTOS.dusk.src,
              credit: `${PHOTOS.dusk.where} · ${PHOTOS.dusk.credit}, ${PHOTOS.dusk.license}`,
            }
          : null
      }
    />
  );
}

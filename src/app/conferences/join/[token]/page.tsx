import Link from "next/link";
import { inkOn, safeAccent } from "@/domain/conference/branding";
import { KIND_WORDS } from "@/domain/conference/details";
import { conferenceSetup } from "@/lib/conference/config";
import { deps } from "@/lib/conference/request";
import { describeInvite } from "@/lib/conference/service";
import { AcceptInvite } from "@/components/conference/AcceptInvite";
import { Closed } from "@/components/conference/Closed";
import { Hero } from "@/components/conference/Hero";

export const dynamic = "force-dynamic";

/**
 * **An invitation, before you've accepted it.** It shows what the
 * invitation is to (name, place, dates, look), because the link is a
 * credential the organiser handed out. It never shows who else is in.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const setup = conferenceSetup();
  if (!setup.open) return <Closed missing={setup.missing} />;
  const { token } = await params;
  const d = deps();
  const landing = await describeInvite(d, token);

  if (!landing?.conference)
    return (
      <div className="mx-auto max-w-[560px] px-5 pt-16">
        <h1 className="text-[32px] leading-none font-black">
          This invitation has stopped working.
        </h1>
        <p className="mt-3 text-black/60">
          {landing?.state === "expired"
            ? "It ran out of time."
            : "Ask whoever sent it for a fresh one."}{" "}
          If you&apos;re already in, it&apos;s in{" "}
          <Link className="font-semibold underline" href="/conferences">
            your conferences
          </Link>
          .
        </p>
      </div>
    );

  const c = landing.conference;
  const accent = safeAccent(c.branding.accent);
  return (
    <Hero details={{ ...c, welcome: undefined, modules: [] }} now={d.now}>
      <p className="mt-6 text-[17px] opacity-85">
        You&apos;re invited to this {KIND_WORDS[c.kind].noun}. Nobody sees
        you&apos;re here unless you choose to be seen, and you don&apos;t need
        an account.
      </p>
      <AcceptInvite token={token} accent={inkOn(accent)} ink={accent} />
    </Hero>
  );
}

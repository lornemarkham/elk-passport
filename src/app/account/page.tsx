import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { currentUser } from "@/lib/auth/currentUser";
import { profileFor } from "@/lib/profile/profileService";
import { preferencesFor } from "@/lib/preferences/preferenceService";
import { AccountSettings } from "@/components/account/AccountSettings";
import { AccountControl } from "@/components/auth/AccountControl";
import { headers } from "next/headers";
import {
  experienceForPath,
  experienceHomeFor,
} from "@/lib/domains/experience-domains";
import { safeNext, DEFAULT_NEXT } from "@/lib/auth/safeNext";

export const metadata: Metadata = {
  title: "Your account — Passport",
};

/**
 * Account and settings, in one page.
 *
 * Two pages would be tidier on a desktop and worse on a phone, where the whole
 * thing is one short scroll and the split would be an extra tap for nothing.
 *
 * ## Why this page asks where you came from
 *
 * It is shared, and it looks like Passport — cream, serif, titled Passport,
 * with `← Discovery` as its only exit. An October reader who tapped their own
 * name in October's bar arrived here and had no route back to the product they
 * were using; measured on production, the link was a bare `/account`.
 *
 * So the nav carries the path, and the way out is the place the person
 * actually came from, named as they would name it. Nothing else about the page
 * changes: one account page, one implementation, and no forked auth.
 */
export default async function AccountPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly next?: string }>;
}) {
  const [user, asked, requestHeaders] = await Promise.all([
    currentUser(),
    searchParams.then((p) => p.next),
    headers(),
  ]);

  // The host decides home when nothing was asked for, exactly as the auth
  // chain does — on `iamoctober.com` that is October, not Passport.
  const home = experienceHomeFor(requestHeaders.get("host")) ?? DEFAULT_NEXT;
  const back = safeNext(asked, home);
  const experience = experienceForPath(back);
  const backLabel = experience?.name ?? "Discovery";

  if (!user) {
    return (
      <main className="min-h-screen bg-[#ecdfc4]">
        <div className="mx-auto max-w-2xl px-5 py-12">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#8a5a24]/25 bg-white/40 px-6 py-16 text-center">
            <Compass className="h-8 w-8 text-[#8a5a24]" aria-hidden />
            <p className="font-serif text-2xl text-[#2c1f10]">
              Your account lives here
            </p>
            <p className="max-w-sm text-sm text-[#6b5637]">
              Sign in to set a display name, tell Passport what you are into,
              and keep your boards. Browsing needs no account.
            </p>
            <Link
              href={`/auth?next=${encodeURIComponent(`/account?next=${back}`)}`}
              className="mt-2 min-h-11 rounded-full bg-[#8a5a24] px-5 py-2.5 text-sm font-medium text-white"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const [profile, preferences] = await Promise.all([
    profileFor(user),
    preferencesFor(user),
  ]);

  return (
    <main className="min-h-screen bg-[#ecdfc4]">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href={back}
            data-testid="account-back"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-[#6b5637]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </Link>
          <AccountControl
            displayName={profile.displayName}
            returnTo={`/account?next=${back}`}
          />
        </div>

        <h1 className="font-serif text-3xl text-[#2c1f10]">Your account</h1>
        <p className="mt-1 mb-8 text-sm text-[#6b5637]">
          Everything here is optional. Passport works without any of it.
        </p>

        <AccountSettings profile={profile} preferences={preferences} />
      </div>
    </main>
  );
}

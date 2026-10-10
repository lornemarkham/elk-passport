import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { currentUser } from "@/lib/auth/currentUser";
import { profileFor } from "@/lib/profile/profileService";
import { preferencesFor } from "@/lib/preferences/preferenceService";
import { AccountSettings } from "@/components/account/AccountSettings";
import { AccountControl } from "@/components/auth/AccountControl";
import { headers } from "next/headers";
import { OctoberNav } from "@/components/october/shell/OctoberNav";
import { PassportNav } from "@/components/shell/PassportNav";
import {
  EXPERIENCE_HEADER,
  experienceFromHeader,
  experienceHomeFor,
  themeFor,
} from "@/lib/domains/experience-domains";
import { safeNext, DEFAULT_NEXT } from "@/lib/auth/safeNext";

/**
 * **The tab should not announce a different product than the one you are
 * in.** On `iamoctober.com` this said *Your account — Passport*, which is the
 * first thing a person sees and the name that lands in their history.
 */
export async function generateMetadata(): Promise<Metadata> {
  const experience = experienceFromHeader(
    (await headers()).get(EXPERIENCE_HEADER),
  );
  return { title: `Your account — ${experience?.name ?? "Passport"}` };
}

type Props = {
  readonly searchParams: Promise<{ readonly next?: string }>;
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
 * actually came from, named as they would name it.
 *
 * ## And why it now looks like it too
 *
 * A correct back link under a cream page titled Passport still told the
 * reader they had left. The page's colours were literal hex rather than
 * tokens, so there was nothing a theme could change; they are tokens now, the
 * cream is a named `passport` theme holding the very same values, and October
 * sets its own. Above the page, October's own bar — so the way back is the
 * one the reader already knows, not a single link they have to find.
 *
 * One account page, one implementation, two presentations. No forked auth.
 */
export default async function AccountPage({ searchParams }: Props) {
  const [user, asked, requestHeaders] = await Promise.all([
    currentUser(),
    searchParams.then((p) => p.next),
    headers(),
  ]);

  // The host decides home when nothing was asked for, exactly as the auth
  // chain does — on `iamoctober.com` that is October, not Passport.
  const host = requestHeaders.get("host");
  const home = experienceHomeFor(host) ?? DEFAULT_NEXT;
  const back = safeNext(asked, home);
  // The middleware already decided this, from the host and the `?next=`, and
  // stated it on the request — so the account page, the auth pages and the
  // metadata above all answer from one place rather than three.
  const experience = experienceFromHeader(
    requestHeaders.get(EXPERIENCE_HEADER),
  );
  const backLabel = experience?.name ?? "Discovery";
  const theme = themeFor(experience);

  if (!user) {
    return (
      <main
        data-theme={theme}
        data-experience={experience?.name ?? "Passport"}
        className="bg-background min-h-screen"
      >
        {/* Whichever product you are in gets its own bar. Before this, an
            October reader got October's and a Passport one got nothing at all
            — `/account` rendered a single link and was a dead end. */}
        {experience ? (
          <OctoberNav displayName={null} activePath={back} />
        ) : (
          <PassportNav displayName={null} />
        )}
        <div className="mx-auto max-w-2xl px-5 py-12">
          <div className="border-primary/25 bg-card/50 flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
            <Compass className="text-primary h-8 w-8" aria-hidden />
            {/* An `h1`, not a styled paragraph: the signed-out state is a
                whole page and it had no heading at any level — the same
                defect `/quick/draconids` had. The signed-in state below has
                always had one. */}
            <h1 className="text-foreground font-serif text-2xl">
              Your account lives here
            </h1>
            {/* The product you are standing in is the one that should be
                named. "Tell Passport what you are into" was shown to people
                who had never heard of Passport. */}
            <p className="text-muted-foreground max-w-sm text-sm">
              Sign in to set a display name, say what you are into, and keep
              what you choose. Browsing {experience?.name ?? "Passport"} needs
              no account.
            </p>
            <Link
              href={`/auth?next=${encodeURIComponent(`/account?next=${back}`)}`}
              className="bg-primary text-primary-foreground mt-2 min-h-11 rounded-full px-5 py-2.5 text-sm font-medium"
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
    <main
      data-theme={theme}
      data-experience={experience?.name ?? "Passport"}
      className="bg-background min-h-screen"
    >
      {experience ? (
        <OctoberNav displayName={profile.displayName} activePath={back} />
      ) : (
        <PassportNav displayName={profile.displayName} />
      )}
      <div className="mx-auto max-w-2xl px-5 py-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href={back}
            data-testid="account-back"
            className="text-muted-foreground inline-flex min-h-11 items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {backLabel}
          </Link>
          <AccountControl
            displayName={profile.displayName}
            returnTo={`/account?next=${back}`}
          />
        </div>

        <h1 className="text-foreground font-serif text-3xl">Your account</h1>
        <p className="text-muted-foreground mt-1 mb-8 text-sm">
          Everything here is optional. {experience?.name ?? "Passport"} works
          without any of it.
        </p>

        <AccountSettings profile={profile} preferences={preferences} />
      </div>
    </main>
  );
}

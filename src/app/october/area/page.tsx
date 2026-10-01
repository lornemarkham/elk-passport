import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth/currentUser";
import { profileFor } from "@/lib/profile/profileService";
import { OCTOBER_PLACES, placeFrom } from "@/domain/environment/places";
import { AreaPicker } from "@/components/october/environment/AreaPicker";

export const metadata: Metadata = { title: "Your October area — Passport" };

/**
 * Choosing where your October happens, one tap, from October itself.
 *
 * It was only in Account, three levels down a settings page, which is where
 * you put something a person configures once and never thinks about — not
 * where you put the setting that decides what the whole product shows them.
 */
export default async function OctoberAreaPage() {
  const user = await currentUser().catch(() => null);
  const profile = user ? await profileFor(user).catch(() => null) : null;
  const current = placeFrom(profile?.homeArea);

  return (
    <main className="mx-auto max-w-2xl px-6 pt-10 pb-24">
      <Link
        href="/october"
        className="inline-flex min-h-11 items-center text-sm text-[#e9e6da]/45 underline-offset-4 hover:underline"
      >
        ← October
      </Link>
      <h1 className="font-heading mt-4 text-3xl tracking-tight text-[#f3efe4]">
        Where is your October?
      </h1>
      <p className="mt-2 max-w-md text-sm text-[#e9e6da]/50">
        October uses this to work out what is near you, when it gets dark, and
        what the sky is doing. Approximate is the point — Passport never reads
        your device location.
      </p>

      {user ? (
        <AreaPicker places={OCTOBER_PLACES} current={current?.name ?? null} />
      ) : (
        <p className="mt-8 text-sm text-[#e9e6da]/60">
          <Link
            href="/auth?next=/october/area"
            className="text-[#d09a4e] underline-offset-4 hover:underline"
          >
            Sign in
          </Link>{" "}
          to keep an area. Until then October still knows the date and when it
          gets dark.
        </p>
      )}
    </main>
  );
}

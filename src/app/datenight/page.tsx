import type { Metadata } from "next";
import { PassportNav } from "@/components/shell/PassportNav";
import { MARKHAM } from "@/domain/date-night/adventures/markham";
import { isNightTitle } from "@/domain/date-night/adventures";
import { justUs } from "@/domain/date-night/adventures/heading";
import { PHOTOS } from "@/domain/date-night/adventures/evenings";
import { currentUser } from "@/lib/auth/currentUser";
import { OpenNight } from "@/components/night/OpenNight";
import { todayIn } from "@/lib/adventures/overview";
import { redirect } from "next/navigation";
import { adventureSession } from "@/lib/adventures/server";
import { adventuresOf } from "@/lib/adventures/store";

/** The night this person already has (theirs, or one they joined). */
async function nightOf(): Promise<string | null> {
  const session = await adventureSession().catch(() => null);
  if (!session) return null;
  const mine = await adventuresOf(session.db, session.user.id).catch(() => []);
  return (
    mine.find(
      (a) => a.kind === "date-night-plan" && isNightTitle(MARKHAM, a.title),
    )?.id ?? null
  );
}

export const metadata: Metadata = {
  title: "Just us",
  robots: { index: false },
};

/**
 * The front door of Date Night: a landscape, the title, when,
 * and one button. Nothing private — no names, no place. The adventure itself
 * is made for you when you press it (signed in), and is yours alone until
 * you invite somebody. Once you have one, this goes straight to it: the
 * adventures are the first thing there.
 */
export default async function DateNightPage() {
  const user = await currentUser().catch(() => null);
  const existing = user ? await nightOf() : null;
  if (existing) redirect(`/night/${encodeURIComponent(existing)}`);
  const day = MARKHAM.day!;
  const today = todayIn(day.timeZone);
  const past = today > day.on;
  const date = new Date(`${day.on}T12:00:00Z`).toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    <>
      <PassportNav displayName={user?.displayName ?? null} />
      <OpenNight
        slug={MARKHAM.slug}
        title={past ? "Just us" : justUs(day.on, today)}
        lines={["We disappear for a little while.", MARKHAM.tagline]}
        when={[date, "Afternoon into the stars"]}
        signedIn={user !== null}
        backdrop={PHOTOS.dusk}
      />
    </>
  );
}

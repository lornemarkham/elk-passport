import type { Metadata } from "next";
import { PassportNav } from "@/components/shell/PassportNav";
import { MARKHAM } from "@/domain/date-night/adventures/markham";
import { PHOTOS } from "@/domain/date-night/adventures/evenings";
import { currentUser } from "@/lib/auth/currentUser";
import { OpenNight } from "@/components/night/OpenNight";
import { todayIn } from "@/lib/adventures/overview";

export const metadata: Metadata = {
  title: "The Markham Adventure",
  robots: { index: false },
};

/** "Tomorrow", "Tonight", or nothing once it's past. */
function soon(on: string, today: string): string | null {
  const days = Math.round(
    (Date.parse(`${on}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) /
      86_400_000,
  );
  return days === 1 ? "Tomorrow" : days === 0 ? "Tonight" : null;
}

/**
 * The front door of the Markham Adventure: a landscape, the title, when,
 * and one button. Nothing private — no names, no place. The adventure itself
 * is made for you when you press it (signed in), and is yours alone until
 * you invite somebody.
 */
export default async function DateNightPage() {
  const user = await currentUser().catch(() => null);
  const day = MARKHAM.day!;
  const when = soon(day.on, todayIn(day.timeZone));
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
        title="The Markham Adventure"
        lines={[
          when
            ? `${when}, we disappear for a little while.`
            : "We disappear for a little while.",
          MARKHAM.tagline,
        ]}
        when={[date, "Around 5 PM"]}
        signedIn={user !== null}
        backdrop={PHOTOS.dusk}
      />
    </>
  );
}

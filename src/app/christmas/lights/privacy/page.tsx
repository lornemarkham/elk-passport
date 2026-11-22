import type { Metadata } from "next";
import Link from "next/link";
import { ThemeProvider } from "@/components/ghad/theme";
import christmas from "@/components/christmas/christmas.module.css";

export const metadata: Metadata = {
  title: "Privacy — Christmas Lights Map",
  description:
    "How community-submitted Christmas displays are reviewed, and how a household can have a listing removed.",
};

/** The plain-words privacy notice the Christmas Lights Map links from every form and listing. */
export default function LightsPrivacyPage() {
  const h2 = "ghad-display mt-8 text-2xl font-extrabold text-[#082319]";
  return (
    <ThemeProvider className="block">
      <main className={`${christmas.page} min-h-screen pb-24`}>
        <div className="mx-auto max-w-2xl px-4 pt-8 text-[#082319] sm:px-6">
          <Link
            href="/christmas/lights"
            className="text-sm font-bold text-[#0f3b2b] underline"
          >
            ← The lights map
          </Link>
          <h1
            className="ghad-display mt-2 text-4xl font-extrabold"
            data-testid="privacy-title"
          >
            Privacy on the Christmas Lights Map
          </h1>
          <p className="mt-3 text-lg">
            The map is built by neighbours. Anyone can tell us about a
            public-facing Christmas display — a decorated house you can see from
            the street, a park, a shop, a town tree — so other families can go
            and enjoy it.
          </p>

          <h2 className={h2}>What gets shown</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              A photo, the display&apos;s place on the map, a short description
              and community ratings.
            </li>
            <li>
              <strong>Never</strong> the name, email or any other detail of the
              person who submitted it, and never the name of whoever lives
              there.
            </li>
          </ul>

          <h2 className={h2}>Everything is checked first</h2>
          <p className="mt-2">
            Nothing appears on the public map until an administrator has
            reviewed it. We turn away photos that show identifiable people,
            licence plates, private activity or anything inappropriate, and we
            remove spam and harassment.
          </p>

          <h2 className={h2}>Is it your home? You can have it removed</h2>
          <p className="mt-2">
            Every listing has an{" "}
            <strong>“Is this your home? Request removal”</strong> button. You
            don&apos;t need an account and you don&apos;t need to prove anything
            first: the moment you ask, the listing is hidden from everybody. The
            administrator then reviews your request and, in nearly every case,
            removes the listing for good — its photo, words and any contact you
            left are deleted, and the place is kept off the map so it isn&apos;t
            added again.
          </p>
          <p className="mt-2">
            If a request looks mistaken or abusive, the administrator may
            restore a listing after looking at it. If you left an email or phone
            number you may be contacted; it&apos;s optional, seen only by the
            administrator and erased when the listing is deleted.
          </p>

          <h2 className={h2}>What we keep</h2>
          <p className="mt-2">
            A private record of each decision (approved, rejected, hidden,
            removed) with the date, so that every action can be accounted for.
            Submitters are kept as a one-way scrambled code, only to limit spam
            — it can&apos;t be turned back into a person.
          </p>

          <p className="mt-8">
            <Link
              href="/christmas/lights/pin"
              className="inline-flex min-h-12 items-center rounded-full bg-[#b3242f] px-6 font-extrabold text-white"
            >
              Add a display
            </Link>
          </p>
        </div>
      </main>
    </ThemeProvider>
  );
}

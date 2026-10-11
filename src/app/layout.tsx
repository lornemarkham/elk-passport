import type { Metadata } from "next";
import { Archivo, Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { AdminNavEntry } from "@/components/admin/AdminNavEntry";
import { Measurement } from "@/components/analytics/Measurement";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

/**
 * **GO HAVE A DAY's own voice.**
 *
 * Archivo, carrying its width axis, used only on the consumer-facing
 * surfaces — the wordmark, the question the page asks, a section's name. Set
 * slightly expanded and very heavy, it reads the way the signage of an outdoor
 * company does: confident, modern, and nothing like the Fraunces serif the
 * rest of Passport's internal surfaces still use.
 *
 * Deliberately a third face rather than a change to the global stack. October,
 * the Place template and every admin surface keep exactly the typography they
 * have; this one is scoped to the pages the brief is about.
 */
const archivo = Archivo({
  variable: "--font-ghad",
  subsets: ["latin"],
  axes: ["wdth"],
});

export const metadata: Metadata = {
  // The name a person reads. The repository, the architecture and every
  // internal document are still Passport; see `Wordmark`.
  title: "Go Have A Day",
  description: "Real places, real dates, and a day worth getting out for.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${jakarta.variable} ${archivo.variable} h-full antialiased`}
    >
      <body className="bg-topo flex min-h-full flex-col">
        <QueryProvider>{children}</QueryProvider>
        <Toaster />
        <AdminNavEntry />
        {/* First-party, cookieless, query strings stripped. See `Measurement`
            for why it is this and not GTM, GA4 and session replay.

            **Only on Vercel**, because only Vercel serves the scripts:
            `/_vercel/insights/script.js` is injected by the platform, so a
            local `next start` answered 404 twice on every page load and the
            NFR suite's "nothing is quietly broken" assertion caught it. A tag
            that cannot load is not worth shipping to a developer's machine,
            and the alternative — teaching the test to ignore two 404s —
            would have blunted the one assertion that notices broken
            requests. */}
        {process.env.VERCEL && <Measurement />}
      </body>
    </html>
  );
}

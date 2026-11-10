import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "CourtQueue — Everybody Plays",
  description:
    "Fair turns for drop-in badminton. Tap PLAY, put your phone down, we'll call you.",
  robots: { index: false, follow: false },
  manifest: "/badminton/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CourtQueue",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/badminton/app-icon/192",
    apple: "/badminton/app-icon/180",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * CourtQueue has its own skin — dark, high-contrast, big buttons for a gym —
 * and none of Passport's shell. Everything under /badminton is its own
 * product with its own sign-in (a name and a PIN); see src/lib/courtqueue.
 */
export default function BadmintonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-slate-950 text-white antialiased">
      {children}
    </div>
  );
}

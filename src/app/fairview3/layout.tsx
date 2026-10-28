import type { Metadata, Viewport } from "next";
import "./fairview3.css";

export const metadata: Metadata = {
  title: "Fairview 3 — No More Crystal Balls",
  description:
    "Four teams. One mission. Zero imaginary baselines. We believe in magic; we just don't use it to measure results.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#06041a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * The show has its own skin: no Passport shell, no topo paper, a dark stage
 * that works on a projector and a phone. Everything under /fairview3 is
 * public except the presenter console, which guards itself.
 */
export default function Fairview3Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fv3 min-h-dvh w-full overflow-x-hidden">{children}</div>
  );
}

import type { Metadata } from "next";
import { BRAND } from "@/lib/pulse/model";
import { PulseFrame } from "./_ui/PulseFrame";

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s — ${BRAND.name}` },
  description: BRAND.tagline,
};

/**
 * People's Pulse sits inside Passport, under Labs, with its own quiet frame:
 * a paper page, its name, and "Powered by ELK" at the foot.
 */
export default function PulseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PulseFrame home="/labs/pulse" aside={{ href: "/labs", label: "Labs" }}>
      {children}
    </PulseFrame>
  );
}

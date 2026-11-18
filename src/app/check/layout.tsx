import type { Metadata } from "next";
import { CHECK_BRAND } from "@/lib/pulse/check";
import { BRAND } from "@/lib/pulse/model";
import { PulseFrame } from "@/app/labs/pulse/_ui/PulseFrame";

export const metadata: Metadata = {
  title: {
    default: `${CHECK_BRAND.name} — ${BRAND.name}`,
    template: `%s — ${CHECK_BRAND.name}`,
  },
  description: CHECK_BRAND.line,
};

/**
 * Pulse Check is People's Pulse, reached at a short public address so a link
 * pasted under a post reads cleanly: `/check/<claim-words>-<id>`.
 */
export default function CheckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PulseFrame
      home="/check"
      sub="Pulse Check"
      aside={{ href: "/labs/pulse", label: "More Pulses" }}
    >
      {children}
    </PulseFrame>
  );
}

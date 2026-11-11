import type { ReactNode } from "react";
import { Alfa_Slab_One, Special_Elite } from "next/font/google";
import { CelebrationHost } from "@/components/snow/sesh/celebrate";

/**
 * Sesh Wars' own type: a slab poster face for the headlines and a
 * typewriter for the dossier labels. Scoped to /snow/sesh-wars — the rest
 * of Snow and Passport keep theirs.
 */
const display = Alfa_Slab_One({
  variable: "--font-sesh-display",
  subsets: ["latin"],
  weight: "400",
});
const type = Special_Elite({
  variable: "--font-sesh-type",
  subsets: ["latin"],
  weight: "400",
});

export default function SeshWarsLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${display.variable} ${type.variable}`}>
      <CelebrationHost>{children}</CelebrationHost>
    </div>
  );
}

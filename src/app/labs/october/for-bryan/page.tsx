import type { Metadata } from "next";
import { ForBryan } from "./ForBryan";

export const metadata: Metadata = {
  title: "For Bryan",
  robots: { index: false, follow: false },
};

/**
 * `/labs/october/for-bryan`
 *
 * Nothing above the experience explains it. It opens on the most ordinary
 * sentence in the project and goes from there.
 */
export default function Page() {
  return <ForBryan />;
}

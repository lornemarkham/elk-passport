import type { Metadata } from "next";
import { ChristmasPassportExperience } from "./ChristmasPassportExperience";

export const metadata: Metadata = {
  title: "ELK Labs — Christmas Passport",
  description:
    "Passport's emotional interpretation of Christmas. Not a Christmas website — a feeling.",
  robots: { index: false, follow: false },
};

/**
 * /about/experiment-05-christmas — Christmas Passport, ported from the
 * original standalone `christmas-passport.html` prototype into a real
 * route, matching every other ELK Labs sandbox. `noindex`, same
 * discipline as every ELK Labs sandbox.
 */
export default function ChristmasPassportPage() {
  return <ChristmasPassportExperience />;
}

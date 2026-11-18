import type { Metadata } from "next";
import { CheckWizard } from "./CheckWizard";

export const metadata: Metadata = {
  title: "Check a claim",
  description:
    "Bring a post, screenshot or headline, read what the sources say, and publish a check you can share back.",
  robots: { index: false, follow: true },
};

export default function NewCheck() {
  return <CheckWizard />;
}

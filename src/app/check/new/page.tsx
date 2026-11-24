import type { Metadata } from "next";
import { CheckWizard } from "./CheckWizard";

export const metadata: Metadata = {
  title: "Check a claim",
  description:
    "Bring a post, screenshot or headline, read what the sources say, and publish a check you can share back.",
  robots: { index: false, follow: true },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** `?q=` is whatever was pasted on the front page: a link, or the claim's words. */
export default async function NewCheck({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 600);
  const isLink = /^https?:\/\/\S+$/i.test(q);
  return (
    <CheckWizard initialLink={isLink ? q : ""} initialClaim={isLink ? "" : q} />
  );
}

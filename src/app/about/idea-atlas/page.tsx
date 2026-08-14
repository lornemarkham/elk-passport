import type { Metadata } from "next";
import { IdeaAtlasExperience } from "./IdeaAtlasExperience";

export const metadata: Metadata = {
  title: "ELK Labs — Idea Atlas",
  description:
    "The master creative wall. Everything Passport could become, kept in one place, growing for years.",
  robots: { index: false, follow: false },
};

/**
 * /about/idea-atlas — the master creative wall. Not documentation, not a
 * roadmap, not a backlog. Indexes everything the ELK Labs family has
 * produced so far (personalities, moments, seasons, principles, dreams)
 * and everything it hasn't built yet, in one place, meant to be revisited
 * and grown for years. `noindex`, same discipline as every ELK Labs page
 * — internal, for the people building Passport, not for travelers or
 * search engines.
 *
 * Server component wrapper — `IdeaAtlasExperience.tsx` itself is a server
 * component too; the only client state on this entire page lives in
 * `PersonalityCard.tsx`'s own expand/collapse, kept as its own small
 * island rather than making the whole page a client component for the
 * sake of one interaction.
 */
export default function IdeaAtlasPage() {
  return <IdeaAtlasExperience />;
}

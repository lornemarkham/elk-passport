import type { Metadata } from "next";
import {
  CATEGORIES,
  CREATIVE_ARCHIVE,
  STATUS_LABEL,
  availability,
  githubUrl,
} from "./archive";
import { CreativeArchive, type ArchiveCard } from "./CreativeArchive";

export const metadata: Metadata = {
  title: "ELK Creative Archive",
  description:
    "Every original experiment, prototype, design round and founding document behind Passport, and where each one lives.",
  robots: { index: false, follow: false },
};

// Which originals can be opened depends on the environment this process runs
// in (Atlas, the Labs gates), so it is asked per request, as Labs does.
export const dynamic = "force-dynamic";

/**
 * `/creative` — the ELK Creative Archive.
 *
 * A vault of everything we made, not a navigation menu: nothing in the
 * product links here except Labs, and nothing here changes an original. The
 * record is `archive.ts`; this page only shows it, with search and drawers.
 */
export default async function CreativeArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; c?: string }>;
}) {
  const { q, c } = await searchParams;
  const cards: ArchiveCard[] = CREATIVE_ARCHIVE.map((work) => ({
    work,
    open: availability(work),
    sources: work.sources.map((path) => ({
      path,
      url: work.onGitHub ? githubUrl(path) : undefined,
    })),
  }));
  return (
    <CreativeArchive
      cards={cards}
      categories={CATEGORIES}
      statusLabel={STATUS_LABEL}
      initialQuery={q ?? ""}
      initialCategory={c ?? ""}
    />
  );
}

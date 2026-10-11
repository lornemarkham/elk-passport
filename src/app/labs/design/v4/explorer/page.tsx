import type { Metadata } from "next";
import { byDoing, gallery, themes } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";
import { BrandBar } from "@/components/design-lab/brand";
import { ExplorerBoard } from "@/components/design-lab/ExplorerBoard";

export const metadata: Metadata = {
  title: "The Everyday Explorer — design lab",
};
export const dynamic = "force-dynamic";

/** See `ExplorerBoard` for what this direction is and why. */
export default async function EverydayExplorer() {
  const { featured, total } = await gallery(60);
  const verbs = byDoing(featured, 3).slice(0, 9);
  const now = new Date();
  const allThemes = themes(featured, now);

  return (
    <main className="min-h-screen bg-white text-black">
      <LabNote direction="the everyday explorer" />
      <BrandBar total={total} href="/labs/design/v4/explorer" />
      <ExplorerBoard
        subjects={featured}
        verbs={verbs.map((verb) => ({
          label: verb.label,
          ids: verb.subjects.map((subject) => subject.id),
        }))}
        allThemes={allThemes}
        base="/labs/design/v4/explorer"
        now={now.toISOString()}
      />
    </main>
  );
}

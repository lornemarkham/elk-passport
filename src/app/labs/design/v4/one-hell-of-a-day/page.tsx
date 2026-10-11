import type { Metadata } from "next";
import { byDoing, gallery, themes } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";
import { DayBoard } from "@/components/design-lab/DayBoard";

export const metadata: Metadata = { title: "One Hell of a Day — design lab" };
export const dynamic = "force-dynamic";

/** See `DayBoard` for what this direction is and why. */
export default async function OneHellOfADay() {
  const { featured, total } = await gallery(60);
  const verbs = byDoing(featured, 3).slice(0, 9);
  const now = new Date();
  const allThemes = themes(featured, now);

  return (
    <main className="min-h-screen bg-white text-black">
      <LabNote direction="one hell of a day" />
      <DayBoard
        subjects={featured}
        verbs={verbs.map((verb) => ({
          label: verb.label,
          ids: verb.subjects.map((subject) => subject.id),
        }))}
        allThemes={allThemes}
        base="/labs/design/v4/one-hell-of-a-day"
        now={now.toISOString()}
        total={total}
      />
    </main>
  );
}

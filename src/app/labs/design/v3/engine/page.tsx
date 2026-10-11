import type { Metadata } from "next";
import { byDoing, gallery } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";
import { EngineBoard } from "@/components/design-lab/EngineBoard";

export const metadata: Metadata = {
  title: "The Discovery Engine — design lab",
};
export const dynamic = "force-dynamic";

/**
 * **ROUND THREE, DIRECTION THREE — THE DISCOVERY ENGINE.**
 *
 * The other eight prototypes make *looking* the hero. This makes **finding**
 * the hero: the page opens with one enormous question and four plain answers,
 * and the photographs arrive underneath once you have said something.
 *
 * ## Not a chatbot and not a filter dashboard
 *
 * There is no text box, because Passport cannot honour a free-text request and
 * a box that looks like it can is a lie with a cursor in it. There is also no
 * panel of checkboxes: four questions, each a single row of large words, each
 * optional, each answerable in one tap.
 *
 * ```
 * What do you feel like doing   Atlas's own verbs, by how many places state them
 * Who is coming                 on your own · with a young child · with friends
 * How long                      an hour · half a day · all day
 * How far                       anywhere · this town · worth a drive
 * ```
 *
 * **Every result says why it is there** — *"Atlas states Swimming here"*, *"5
 * km from you"*, *"Saturdays"* — because a recommendation whose reason is
 * invisible is indistinguishable from a guess.
 *
 * ## What is honestly unsupported
 *
 * *How far* needs the reader's position, so it is inert until they share it
 * and says so rather than quietly ordering by something else. *How long* does
 * not filter: Atlas states a duration for seventeen subjects out of 2,680, so
 * it changes how many ideas are offered and nothing more, and the page says
 * that too.
 */
export default async function DiscoveryEngine() {
  const { featured, rest, total } = await gallery(40);
  const verbs = byDoing(featured, 2).slice(0, 8);

  return (
    <main className="min-h-screen bg-white text-black">
      <LabNote direction="the discovery engine" />
      <EngineBoard
        verbs={verbs.map((verb) => ({
          label: verb.label,
          ids: verb.subjects.map((subject) => subject.id),
        }))}
        subjects={featured}
        unphotographed={rest.slice(0, 12)}
        total={total}
      />
    </main>
  );
}

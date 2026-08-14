/**
 * Sketch data only — every entry below is invented for this prototype and
 * does not correspond to a real Atlas place. This is the one deliberate
 * exception to this workspace's "evidence over invention" rule: a
 * throwaway sandbox is allowed to use throwaway content, as long as it's
 * never mistaken for something real. Labeled as such directly on the page
 * too, not just here.
 */
export interface SketchPlace {
  readonly id: string;
  readonly name: string;
  readonly mood: string;
  readonly line: string;
}

export const SKETCH_PLACES: readonly SketchPlace[] = [
  {
    id: "1",
    name: "A lake nobody in the group has seen",
    mood: "Cold water, warm rocks.",
    line: "Three beaches. One dive spot. No lifeguards, no rules.",
  },
  {
    id: "2",
    name: "A trail that gets steep near the top",
    mood: "Legs burning, worth it.",
    line: "Ninety minutes up. Twenty back down. The view doesn't wait for you.",
  },
  {
    id: "3",
    name: "A town with one good bakery",
    mood: "Flour on the counter, still warm.",
    line: "Get there before ten or get there tomorrow.",
  },
  {
    id: "4",
    name: "A viewpoint most people drive past",
    mood: "Pull over. You'll see why.",
    line: "No sign. No parking lot. Just a wide shoulder and a reason.",
  },
  {
    id: "5",
    name: "A brewery at the end of a dirt road",
    mood: "Dust on your boots, cold glass in hand.",
    line: "Bring cash. Bring an appetite. Stay for the sunset.",
  },
  {
    id: "6",
    name: "A beach that's better at low tide",
    mood: "Sand for miles, tide pools everywhere.",
    line: "Check the tide chart before you go. It changes everything.",
  },
];

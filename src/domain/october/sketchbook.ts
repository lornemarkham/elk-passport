/**
 * **The sketchbook.** Rooms we have thought about building.
 *
 * Not a backlog, not a roadmap, not a spec. A scene here is an *idea we liked*,
 * written down in enough of its own language that it still means something in
 * six months — the feeling it is reaching for, not a feature description.
 *
 * ## One scene, many interpretations
 *
 * The thing this exists to protect: **a scene is not an implementation.** There
 * can be three Witching Hours and two contradictory Scariest Rooms, and none of
 * them is the wrong one. Adding a fourth interpretation of a scene never
 * replaces the first — a new entry in `interpretations` and nothing else moves.
 * We are sketching, not converging.
 *
 * ## What an interpretation's `status` means
 *
 * `built` — you can open it right now, and the link goes there.
 * `sketch` — written down, not made. Most of this list.
 *
 * Nothing here is a promise that any of it ships.
 *
 * ## This is the workshop, not the gallery
 *
 * **From October** (on October home) is the product-facing surface: doors into
 * rooms October has actually made, for a person who should never have to know
 * the words "labs", "prototype" or "sketchbook". This file is the workshop
 * behind it — unfinished ideas, seeds, and two readings that disagree.
 *
 * Marking an interpretation `built` does **not** publish it. Putting a room in
 * From October is a separate, deliberate editorial act with its own language,
 * which is why that list is written out there by hand rather than derived from
 * this one. An idea stays in here until there is something worth entering.
 */

export type InterpretationStatus = "built" | "sketch";

export interface Interpretation {
  /** A name for *this reading* of the scene, not for the scene. */
  readonly title: string;
  readonly status: InterpretationStatus;
  /** Where it lives, if it was actually built. */
  readonly href?: string;
  /** What this particular version is. Written as an idea, not a ticket. */
  readonly note: string;
  /**
   * The words this reading turns on, if it has any.
   *
   * Separate from `note` because a line like *"No. The other one."* stops
   * working the moment it is folded into a sentence about itself. Some readings
   * are an idea; a few of them are a thing October says, and those need to sit
   * on the page the way they would be heard.
   */
  readonly lines?: readonly string[];
}

export interface Scene {
  readonly slug: string;
  readonly title: string;
  /** The one line that says why this is interesting at all. */
  readonly hook: string;
  /** The idea, in the language it was first said in. */
  readonly body: readonly string[];
  /** Kept because a good line is the whole idea, and paraphrase loses it. */
  readonly quotes?: readonly string[];
  readonly interpretations: readonly Interpretation[];
}

export const SCENES: readonly Scene[] = [
  {
    slug: "video-store",
    title: "The Video Store",
    hook: "October has been collecting movies for a very long time.",
    body: [
      "An old, slightly impossible 1980s video store that October owns, or has inhabited long enough that the difference stopped mattering. It has taste, favourites, obscure knowledge, nostalgia, strange categories, and occasional contempt for your choices.",
      "The wall is real: VHS cases you can pick up, turn over and put back. October has already been through the horror section, and sometimes refuses to let you take a tape.",
      "This one has been built once. That does not close it — a second video store with a weirder idea is welcome, and would not replace the first.",
    ],
    quotes: ["Somebody has already been through the horror section."],
    interpretations: [
      {
        title: "The VHS Wall",
        status: "built",
        href: "/labs/october/video-store",
        note: "Cases composited into a real shelf, pickup by perspective rather than by modal, a refusal you have to fight, and somebody standing at the back of the aisle who runs past you afterwards.",
      },
      {
        title: "Video Store B — the back room",
        status: "sketch",
        note: "There is a room behind the counter. You are not supposed to be in it. Nothing in it is for rent.",
      },
    ],
  },
  {
    slug: "scariest-room",
    title: "The Scariest Room in Your House",
    hook: "The person chooses the room. October does not decide what should scare them.",
    body: [
      "It opens by asking for something ordinary and slightly impossible to refuse: go and take a picture of the scariest room in your house. Everyone has one, and nobody has to be told which it is — the choosing is the whole mechanism. October never has to guess what frightens you, because you just told it.",
      "A basement, a hallway, a bedroom, the furnace room, the garage, or somewhere completely ordinary that nobody else would think twice about — the answer is different every time, and the choice itself is the interesting part. What a photograph gives October is not a generic haunted room. It is a place inside their world.",
      "One idea for the response is almost nothing. A pause, and then recognition.",
      "The part that matters comes later, in a different interaction entirely, when you are not braced for it. October remembers the room. It does not describe it, or show it back to you, or explain how it knows.",
      "No jump scare is required and one would probably ruin it. The feeling being aimed at is the one where you are alone in the scariest room in your house and become suddenly, specifically aware that you are alone in it. Dread and memory, not surprise.",
    ],
    quotes: [
      "Go take a picture of the scariest room in your house.",
      "Oh. Yes. October spent many years here.",
      "Come find me. I'm playing in your favourite room.",
    ],
    interpretations: [
      {
        title: "October has been here",
        status: "built",
        href: "/labs/october/scariest-room/has-been-here",
        note: "The photograph arrives and nothing happens for a moment — a pause long enough to be uncomfortable, as though something is actually looking. Then recognition, and then it stops. It does not say what it can see. It does not name the objects, or explain why the room is frightening, or perform any of the image-analysis theatre that would turn a haunting into a party trick. Your imagination is better at this than any description, and the only thing the beat has to establish is that October now knows this room exists.",
        lines: ["Oh.", "Yes.", "October spent many years here."],
      },
      {
        title: "The callback",
        status: "sketch",
        note: "The photograph does not pay off on the night you take it. It pays off much later — another session, another evening, when you have long stopped bracing for it — and the scare is not the picture. The scare is the realisation that October kept it, and knows which room you chose. A harmless little prompt from weeks ago quietly becomes the most personal thing the product has ever said to you. Persistence and memory are the hard parts and are deliberately not being solved.",
        lines: ["Come find me.", "I'm playing in your favourite room."],
      },
      {
        title: "The other one",
        status: "sketch",
        note: "You upload the room you believe is the scariest room in your house. October looks at it, pauses, and disagrees. Nothing follows — no explanation, no second chance, no hint about which room it means, because you already know which room it means. The obvious objection is the whole reason this is worth keeping: there is no honest way for October to know that. Maybe it is theatrical sleight of hand, maybe it is impossible, maybe it is terrible, maybe it is the best idea on this page. Do not answer the question yet.",
        lines: ["No.", "The other one."],
      },
      {
        title: "Go back and take it again",
        status: "sketch",
        note: "Much later, October asks for a second photograph of the same room, and says nothing else — no reason, no reaction to the first one, no reaction to the second. The experience is not on the screen at all. It is you, standing up, walking to the worst room in your house at eleven at night with your phone held out in front of you, doing an errand you agreed to. October never has to be frightening, because it got you to do the frightening thing yourself and then stayed silent about it.",
        lines: ["Take another picture of that room."],
      },
      {
        title: "The room you didn't choose",
        status: "sketch",
        note: "This one barely needs the photograph. Everybody has a first flinch and then a second thought — a room that came to mind instantly and got talked out of before the answer was given. So October asks about that one instead. It is not surveillance and it is not a trick; it is just true about how people answer this question, which is exactly why it lands. The uncomfortable part is not that October knows something about your house. It is that October knows something about you.",
        lines: [
          "And the room you thought of first, before you decided it wasn't the one.",
          "Tell me about that one.",
        ],
      },
      {
        title: "Not the only one in a basement",
        status: "sketch",
        note: "The weird one. October has asked everybody this, and one night it mentions the arithmetic — plainly, without menace, the way you would remark on the weather. Every other reading here makes the room smaller and more private; this makes it enormous. You are alone in the dark, and so are a great many other people, right now, and that is somehow much worse than being alone. Nothing here is invented or implied — it is an ordinary true count, which is the entire reason it works.",
        lines: [
          "Forty-one people are standing in a basement tonight.",
          "Yours is the fourth one this hour.",
        ],
      },
      {
        title: "October wears your house",
        status: "sketch",
        note: "No callback, no line, no acknowledgement of any kind. Some time after you send the photograph, the room begins showing up behind Passport — very faint, very slow, underneath an ordinary screen about corn mazes and opening hours. Your own hallway, at the back of the product, where a stock photograph of somewhere else used to be. October never mentions it and there is no moment to point at. Either you notice, or you don't, and the day you do is the day the app stops being furniture.",
      },
      {
        title: "No photograph at all",
        status: "sketch",
        note: "A contradictory reading, kept on purpose. You only ever name the room. October never sees it, which may be worse — it means the room it describes back is the one you are picturing.",
      },
    ],
  },
  {
    slug: "witching-hour",
    title: "Witching Hour",
    hook: "A time, not a place. We have not decided what it is yet.",
    body: [
      "Something that only exists between certain hours, and behaves differently depending on when you arrive — or whether anyone else is there at the same time.",
      "Deliberately underspecified. This entry exists so there is somewhere to come back to and build a reading of it, rather than a definition to argue with.",
    ],
    interpretations: [
      {
        title: "Witching Hour v0.1",
        status: "built",
        href: "/labs/october/witching-hour",
        note: "The earliest pass, kept as it was. The pauses now hold what they contain.",
      },
      {
        title: "Only at the hour",
        status: "sketch",
        note: "The page is ordinary at every other time. There is no countdown and no announcement, and finding out is the point.",
      },
    ],
  },
  {
    slug: "dragons-eyes",
    title: "Dragon's Eyes / Meteor Mission",
    hook: "Look up. Something is already looking back.",
    body: [
      "A seed, kept deliberately thin because almost nothing has been built for it yet and inventing detail now would only make it harder to have the real idea later.",
      "What there is: the night sky as the surface, something to go outside for, and two readings of the same lights — a meteor shower, and a pair of eyes.",
    ],
    interpretations: [
      {
        title: "Unwritten",
        status: "sketch",
        note: "No interpretation has been made. That is the honest state of it.",
      },
    ],
  },
  {
    slug: "secret-room",
    title: "The Secret Room",
    hook: "A room that is not on the map, and more than one way out of it.",
    body: [
      "A seed. Somewhere in Passport there is a way into a room nobody mentioned, and getting in is the experience rather than what is inside.",
      'The discovery that made this interesting: the room has more than one way out, and they do not test the same thing. A real exit exists and can be found. When somebody cannot find it, October intervenes — almost helpfully — and offers an alternative, which is a small game standing in a doorway. That framing is what makes "October is being nice to you. This time." land as funny and generous and slightly threatening all at once.',
      "Eventually the room might simply ask how you would like to leave. Exits could test drawing, trivia, film trivia, memory, observation, logic, sound, charades, a little arcade game, something Tetris-shaped, zombies, a task in the physical world, something that needs a second person, or Let October Decide. That is idea inventory, not a requirements list, and nothing about it needs a framework — each exit is allowed to be its own hand-made toy.",
      "October is not punishing anybody in any of this. The games are allowed to be plainly fun; the situation around them supplies all the strangeness they need.",
    ],
    quotes: [
      "You haven't found it. That's all right. I'll give you another way out.",
      "October is being nice to you. This time.",
      "How would you like to get out?",
    ],
    interpretations: [
      {
        title: "Keep it alight",
        status: "built",
        href: "/labs/october/secret-room/another-way-out",
        note: "The first exit made playable, and a toy rather than a system. You are shut in a room with a door that will not open and a few things worth trying, none of which help. October watches for a while, then offers a different way out: a candle, thirty seconds, and draughts coming in from every direction. You cup a hand around the flame and turn it to meet them. Three hits and it goes out, which costs a dry remark and another go. Survive and the door finally opens.",
        lines: [
          "You haven't found it.",
          "That's all right.",
          "I'll give you another way out.",
        ],
      },
      {
        title: "How would you like to get out?",
        status: "sketch",
        note: "The room offers a choice of exits and you pick the one that suits you — draw your way out, remember your way out, shoot your way out, or hand the decision back and let October choose. The open question is whether choosing is better than being given, and there is a real case that being given is better: a choice makes it a menu, and a menu is a product. Do not build the picker before there are two exits worth picking between.",
      },
      {
        title: "The real one",
        status: "sketch",
        note: "The exit that was always there, and the reason October's games are alternates rather than the thing itself. Somebody who finds it never sees a game at all, and that has to stay true or the whole frame collapses into a quiz with a story on top. Nobody has designed the real exit yet, which is fine — it is the part most worth getting right and the part most easily ruined by hurrying.",
      },
    ],
  },
  {
    slug: "milk",
    title: "Milk — the escalation room",
    hook: 'Not "something scared me". "I don\'t want to be in this room anymore."',
    body: [
      "Named after the Moderat track, and the musical observation is the whole design. The underlying pattern never dramatically changes. It repeats, and repeats, and repeats. What changes is intensity: it accumulates, gets louder, denser, heavier, and progressively harder to ignore.",
      "One reading as a room. You enter something nearly empty. One small thing is happening, on a loop. Nothing is obviously frightening and nothing jumps out.",
      "Every interaction adds a little more — sound, light, movement, objects, language, pressure — and the loop underneath stays exactly the same. You are not being chased. The room is simply becoming more itself.",
      "The success condition is not a scare. It is that you leave, and that leaving was your idea.",
    ],
    quotes: [
      "The pattern doesn't change. The room escalates.",
      "I don't want to be in this room anymore.",
    ],
    interpretations: [
      {
        title: "The room that accumulates",
        status: "sketch",
        note: "As above. The hard question is what the loop actually is, and whether the escalation is driven by time in the room or by how much you touch.",
      },
    ],
  },
];

export const sceneBySlug = (slug: string): Scene | undefined =>
  SCENES.find((s) => s.slug === slug);

/** Every interpretation across every scene — the count the room leads with. */
export const interpretationCount = (): number =>
  SCENES.reduce((n, s) => n + s.interpretations.length, 0);

export const builtCount = (): number =>
  SCENES.reduce(
    (n, s) => n + s.interpretations.filter((i) => i.status === "built").length,
    0,
  );

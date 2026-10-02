/**
 * **Things worth actually making this October.**
 *
 * Authored by hand, like the film catalogue and for the same reason: nobody
 * can scrape taste. Every line here is somebody's opinion about what is worth
 * an evening, and the test applied to each one was whether a person would read
 * it and think *yeah, let's do that Saturday*. Anything that only passed
 * "this is a craft" was cut.
 *
 * ## What a Doing is
 *
 * An intention, not an entity. There is no venue, no start time, no publisher
 * and no Atlas record — *I am going to carve a pumpkin this weekend* is not a
 * fact about the world, so Atlas correctly knows nothing about it. The id is
 * a slug in this file, exactly as a film's id is a slug in that one.
 *
 * ## Deliberately not here
 *
 * No step-by-step instructions, no materials lists, no difficulty stars, no
 * times-to-complete. This is not a recipe site and the product being tested is
 * whether *saving* an intention makes a month feel lived — not whether
 * Passport can explain how to cut a pumpkin. A `how` line exists where one
 * sentence genuinely helps, and is absent everywhere else.
 *
 * And nothing here claims anybody else did it, liked it or recommends it.
 */

export type MakeShelf =
  /** A pumpkin, a knife, newspaper on the floor. */
  | "pumpkin-night"
  /** The house, made strange. */
  | "make-the-house-weird"
  /** Small hands involved. */
  | "together"
  /** You, as something else, by the 31st. */
  | "be-something";

/**
 * **A picture of somebody else's, and why that is now allowed.**
 *
 * The first pass refused imagery on the grounds that a stranger's perfect
 * pumpkin is not yours. That confused two different jobs: the photograph you
 * take afterwards is **memory**, and it belongs in My October. A photograph of
 * a genuinely frightening pumpkin is **discovery**, and it is the thing that
 * makes somebody decide to carve one at all. A page with neither is a list.
 *
 * Every image here is openly licensed, found in a Wikimedia Commons category
 * rather than a keyword search, and **looked at before it was used** — the
 * rule being that no image beats a wrong one. Credit and licence travel with
 * the file because the licence requires it, and `page` is the source so a
 * claim can be checked.
 */
export interface DoingImage {
  readonly src: string;
  /** Whoever took it. Rendered, because CC BY and BY-SA require it. */
  readonly credit: string;
  readonly licence: string;
  /** The Commons page, so the attribution can be verified. */
  readonly page: string;
  /** What it actually shows. Never implies it is the reader's own. */
  readonly alt: string;
}

/**
 * **Enough to get from "that looks good" to "we could actually do that".**
 *
 * Only on the handful of Doings that earn it. A field is present when it
 * genuinely helps and absent otherwise — there is no empty "difficulty: N/A",
 * because this is a world of ideas and not an instruction manual, and the
 * moment every Doing has a materials list it has become one.
 */
export interface DoingDetail {
  /** The hook. One line, October's voice, on the page itself. */
  readonly hook: string;
  /** What you need. Short, honest, things people have or can buy. */
  readonly need: readonly string[];
  /** The one piece of advice that actually changes the result. */
  readonly trick: { readonly title: string; readonly body: string };
  /** Two or three ways to take it further. */
  readonly tryThis?: readonly string[];
  /** Rough, and said as a person would say it. Never a precise number. */
  readonly time?: string;
  /** Said only where it is true and useful. */
  readonly mess?: string;
  readonly withAnAdult?: true;
}

export interface Doing {
  /** Stable for ever: this is what My October stores. */
  readonly id: string;
  readonly title: string;
  readonly shelf: MakeShelf;
  /** October's one line. The reason to do it, not a description of it. */
  readonly line: string;
  /** One sentence of how, only where one sentence genuinely helps. */
  readonly how?: string;
  /** Said where a thing genuinely suits small hands. Never a rating. */
  readonly withKids?: true;
  /** Inspiration, where a truthful one was found. */
  readonly image?: DoingImage;
  /** The enriched content, on the few that lead this world. */
  readonly detail?: DoingDetail;
  /** Said where it genuinely needs a run at it rather than an hour. */
  readonly takesAnEvening?: true;
}

export const MAKING: readonly Doing[] = [
  // ------------------------------------------------------- pumpkin night
  {
    id: "carve-pumpkins",
    title: "Carve pumpkins",
    shelf: "pumpkin-night",
    line: "The whole evening, really: newspaper down, something on in the background, everyone's hands cold.",
    withKids: true,
    image: {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/99/Aavak-o-lantern_1.jpg/960px-Aavak-o-lantern_1.jpg",
      credit: "Sarr Cat",
      licence: "CC BY-SA 4.0",
      page: "https://commons.wikimedia.org/wiki/File%3AAavak-o-lantern%201.jpg",
      alt: "A carved pumpkin on a kitchen table, newspaper and cut-out pieces beside it",
    },
    detail: {
      hook: "Not a craft. An evening.",
      need: [
        "A pumpkin each",
        "Newspaper, more than you think",
        "A serrated knife and a spoon",
        "A marker",
        "Tealights",
      ],
      trick: {
        title: "Scoop more than feels necessary",
        body: "Thin the wall to about two centimetres and the light actually comes through. Most disappointing pumpkins are simply too thick.",
      },
      tryThis: [
        "Draw the face on in marker first — it is much easier to redraw than to un-cut.",
        "Cut the lid at an angle so it does not drop in when it shrinks.",
        "Save the seeds. They go in the oven while you finish.",
      ],
      time: "An evening, really",
      mess: "Considerable",
      withAnAdult: true,
    },
  },
  {
    // No photograph here on purpose. The best openly-licensed candidate was
    // a collapsing pumpkin on a Berlin windowsill in daylight — toothy, but
    // it reads as "old vegetable" rather than frightening, and a wrong
    // picture undoes the line above it. Still looking.
    id: "genuinely-creepy-pumpkin",
    title: "Carve one that is actually frightening",
    shelf: "pumpkin-night",
    line: "Not a triangle-eyed grin. Something with a long face and too few teeth that you half regret at 2 a.m.",
    how: "Thin the wall from the inside and it glows through — the scary ones are carved shallow, not all the way out.",
    takesAnEvening: true,
    detail: {
      hook: "Skip the triangle eyes.",
      need: [
        "A tall pumpkin rather than a round one",
        "A small serrated knife",
        "A lino or clay tool if you have one",
        "A single candle, not a string of lights",
      ],
      trick: {
        title: "Start with the mouth, and make it too wide",
        body: "Then make the teeth uneven. Perfectly spaced teeth read as friendly however sharp you cut them; it is the irregularity that does the work.",
      },
      tryThis: [
        "Set one eye slightly higher than the other. Nobody will know why it bothers them.",
        "Scrape rather than cut in places — thin flesh glows instead of showing a hole.",
        "Light it with one candle low down so the shadows go upward.",
      ],
      time: "About 45 minutes once you are going",
      mess: "Considerable",
      withAnAdult: true,
    },
  },
  {
    id: "stupid-pumpkin",
    title: "Carve a deliberately stupid one",
    shelf: "pumpkin-night",
    line: "A pumpkin eating a smaller pumpkin. One with your own face. The joke lasts a week on the porch.",
  },
  {
    id: "first-pumpkin",
    title: "Somebody's first pumpkin",
    shelf: "pumpkin-night",
    line: "Draw it on in marker first and let them cut the easy bits. The wonky one is the one that gets photographed.",
    withKids: true,
    image: {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/25/Budapest%2C_BarCraft_2%2C_Halloween%2C_4.jpg/960px-Budapest%2C_BarCraft_2%2C_Halloween%2C_4.jpg",
      credit: "Christo",
      licence: "CC BY-SA 4.0",
      page: "https://commons.wikimedia.org/wiki/File%3ABudapest%2C%20BarCraft%202%2C%20Halloween%2C%204.jpg",
      alt: "A small lit pumpkin with a simple carved design glowing orange",
    },
    detail: {
      hook: "The wonky one gets photographed. Every year.",
      need: [
        "A small pumpkin — easier hands, easier arms",
        "A marker",
        "Cookie cutters and a mallet, if you have them",
        "A spoon they can actually hold",
      ],
      trick: {
        title: "Let them draw it, you cut it",
        body: "The drawing is the part they care about and the knife is the part they should not have. Trace what they drew exactly, crooked lines included.",
      },
      tryThis: [
        "Cookie cutters tapped through with a mallet make clean shapes with no blade involved.",
        "Open it from the bottom instead of the top — it sits over the candle rather than around it.",
      ],
      time: "Half an hour before anyone loses interest",
      mess: "Considerable",
      withAnAdult: true,
    },
  },
  {
    id: "painted-pumpkin",
    title: "Paint one instead",
    shelf: "pumpkin-night",
    line: "No knives, no gut-scooping, lasts three times as long. Black and white only looks far better than it should.",
    withKids: true,
  },
  {
    id: "pumpkin-cluster",
    title: "Build a pile of them",
    shelf: "pumpkin-night",
    line: "Nine pumpkins on the steps in three sizes beats one carved one. Not one of them has to have a face.",
  },
  {
    id: "roast-the-seeds",
    title: "Roast the seeds while you carve",
    shelf: "pumpkin-night",
    line: "The bit everyone forgets and nobody regrets. Salt, oil, hot oven, eat them straight off the tray.",
    withKids: true,
  },

  // ------------------------------------------------- make the house weird
  {
    id: "paper-ghosts",
    title: "Hang paper ghosts",
    shelf: "make-the-house-weird",
    line: "Twenty minutes, costs nothing, and a dozen of them in a dark window is better than anything you can buy.",
    how: "Tissue over a ball of newspaper, tie at the neck, two dots for eyes. Thread rather than string.",
    withKids: true,
  },
  {
    id: "window-silhouettes",
    title: "Put silhouettes in the windows",
    shelf: "make-the-house-weird",
    line: "Black paper, a lamp behind it, and from the street your house has somebody standing in the upstairs window.",
    how: "Cut them slightly too large. From outside, slightly too large reads as a person.",
    detail: {
      hook: "From the street, your upstairs window has somebody in it.",
      need: [
        "Black card or thick paper",
        "A craft knife",
        "Tape that will not mark paint",
        "A lamp behind the glass",
      ],
      trick: {
        title: "Cut them slightly too large",
        body: "A life-size silhouette reads as a decoration. One that is a little too big reads as a person, and that is the entire effect.",
      },
      tryThis: [
        "One figure in one window beats six figures in six windows.",
        "Put the lamp low and to one side so the shape is not evenly lit.",
        "Hands and shoulders carry more than faces at that distance.",
      ],
      time: "An hour, mostly cutting",
      mess: "None to speak of",
    },
  },
  {
    id: "gravestones",
    title: "Make gravestones for the lawn",
    shelf: "make-the-house-weird",
    line: "Cardboard, grey paint, and names you have to read twice. The jokes are the point.",
    takesAnEvening: true,
  },
  {
    id: "spooky-porch",
    title: "Do something to the porch",
    shelf: "make-the-house-weird",
    line: "One good idea beats a shop's worth of plastic. A single bare orange bulb does more than a whole aisle.",
    image: {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d7/2019-10-23_YES_WE_DO_CELEBRATE_HALLOWEEN_%28HERE_IN_IRELAND%29-1574596.jpg/960px-2019-10-23_YES_WE_DO_CELEBRATE_HALLOWEEN_%28HERE_IN_IRELAND%29-1574596.jpg",
      credit: "William Murphy",
      licence: "CC BY-SA 2.0",
      page: "https://commons.wikimedia.org/wiki/File%3A2019-10-23%20YES%20WE%20DO%20CELEBRATE%20HALLOWEEN%20%28HERE%20IN%20IRELAND%29-1574596.jpg",
      alt: "A house front decorated for Halloween with a hanging figure beside the door",
    },
    detail: {
      hook: "One good idea beats an aisle of plastic.",
      need: ["One orange bulb", "Whatever you already own", "Restraint"],
      trick: {
        title: "Change the light before you add anything",
        body: "A single bare orange or red bulb by the door does more than every inflatable on the street. Start there and you may find you are finished.",
      },
      tryThis: [
        "Something tall and still beside the door, rather than many small things on the ground.",
        "Leave the path clear — people have to walk up it in the dark.",
      ],
      time: "An hour",
    },
  },
  {
    id: "jar-lanterns",
    title: "Make jar lanterns",
    shelf: "make-the-house-weird",
    line: "Old jars, tissue paper, a tealight. Line the path with eight of them and the whole approach changes.",
    withKids: true,
    detail: {
      hook: "Eight of them down the path and the whole approach changes.",
      need: [
        "Jars you were going to recycle anyway",
        "Tissue paper",
        "PVA glue, watered down",
        "Tealights — battery ones if children are about",
      ],
      trick: {
        title: "Glue the tissue on the outside, not the inside",
        body: "Inside, it curls and catches the flame. Outside, the overlaps are what make the light uneven, which is what makes it look like something rather than a jar.",
      },
      tryThis: [
        "Orange and deep red overlapping is better than either on its own.",
        "A black paper face stuck on afterwards turns it into a lantern rather than a candle.",
        "Space them further apart than feels right — a gap of darkness between each one.",
      ],
      time: "Forty minutes, plus drying",
      mess: "Sticky",
    },
  },
  {
    id: "bats-up-the-stairs",
    title: "Send bats up the stairwell",
    shelf: "make-the-house-weird",
    line: "Black card, one bat shape traced forty times, each one a little higher than the last. Indoors, where you will actually see them.",
    withKids: true,
  },
  {
    id: "one-wrong-thing",
    title: "Put one wrong thing somewhere",
    shelf: "make-the-house-weird",
    line: "Not a decoration — a single thing slightly out of place that nobody mentions for three days. October's best trick.",
  },

  // ------------------------------------------------------------- together
  {
    id: "leaf-collecting",
    title: "Go and get the good leaves",
    shelf: "together",
    line: "The maples go first and they go fast. Press them in a heavy book and they last until Christmas.",
    withKids: true,
  },
  {
    id: "leaf-creatures",
    title: "Make something out of the leaves",
    shelf: "together",
    line: "Glue them onto paper as animals. It is forty minutes at a kitchen table and it ends up on the fridge.",
    withKids: true,
  },
  {
    id: "spider-web-corner",
    title: "Web a corner of a room",
    shelf: "together",
    line: "White wool, drawing pins, one corner. Easier than it looks and children will keep adding to it for a week.",
    withKids: true,
  },
  {
    id: "monster-drawings",
    title: "Draw each other's monsters",
    shelf: "together",
    line: "Everyone describes one, somebody else draws it. The misunderstandings are the good bit.",
    withKids: true,
  },
  {
    id: "halloween-playlist",
    title: "Build the house playlist",
    shelf: "together",
    line: "Everyone adds three. It will be terrible and it will be played every evening until November.",
    withKids: true,
  },
  {
    id: "make-a-potion",
    title: "Make a potion",
    shelf: "together",
    line: "Cold tea, food colouring, something that fizzes. Entirely undrinkable and absolutely worth the mess.",
    withKids: true,
  },
  {
    id: "shadow-puppets",
    title: "Cut shadow puppets",
    shelf: "together",
    line: "Card, skewers, a torch against a wall. Half an hour of making, an hour of pretending.",
    withKids: true,
    image: {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e3/Children_making_shadows.jpg/960px-Children_making_shadows.jpg",
      credit: "Ramjchandran",
      licence: "CC BY-SA 4.0",
      page: "https://commons.wikimedia.org/wiki/File:Children_making_shadows.jpg",
      alt: "Several children hold cut-out birds and animals on sticks in front of a lamp, throwing overlapping shadows across a pale wall.",
    },
    detail: {
      hook: "Half an hour of making. An hour of pretending.",
      need: [
        "Cereal-box card",
        "Scissors, and a skewer or straw each",
        "A torch or a lamp with the shade off",
        "A pale wall, or a sheet",
      ],
      trick: {
        title: "Do it with your hands first",
        body: "Before anybody cuts anything, put a hand in front of the lamp and walk it towards the wall. It grows. That one move teaches the whole thing — close to the light is huge and soft, close to the wall is small and sharp — and after it, children aim their puppets instead of just holding them up.",
      },
      tryThis: [
        "Cut the outline bolder than feels necessary. Detail inside the shape disappears entirely.",
        "A hinge of tape at the jaw, and the wolf can talk.",
        "Turn every other light off. Half-lit, it is a craft table; dark, it is a theatre.",
      ],
      time: "Half an hour to make",
      mess: "Scraps of card everywhere",
    },
  },

  // --------------------------------------------------------- be something
  {
    id: "build-a-costume",
    title: "Build a costume",
    shelf: "be-something",
    line: "Start now and it is a project. Start on the 30th and it is a bedsheet.",
    takesAnEvening: true,
    image: {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/%27_Bhoot_Chaturdashi_%27_festivel_-_Costume_%26_makeup.jpg/960px-%27_Bhoot_Chaturdashi_%27_festivel_-_Costume_%26_makeup.jpg",
      credit: "TAPAS KUMAR HALDER",
      licence: "CC BY-SA 4.0",
      page: "https://commons.wikimedia.org/wiki/File%3A%27%20Bhoot%20Chaturdashi%20%27%20festivel%20-%20Costume%20%26%20makeup.jpg",
      alt: "A person in elaborate Halloween costume and face paint",
    },
    detail: {
      hook: "Start now and it is a project. Start on the 30th and it is a bedsheet.",
      need: [
        "A decision, first",
        "Whatever the idea actually requires",
        "More evenings than you think",
      ],
      trick: {
        title: "Decide the silhouette before the detail",
        body: "What shape are you from across a room? Get that right and the rest is decoration. Get it wrong and no amount of detail rescues it.",
      },
      tryThis: [
        "Pick something with one strong feature and build everything around it.",
        "Try it on in a mirror in the dark. Most costumes are seen in the dark.",
      ],
      time: "Several evenings",
      withAnAdult: true,
    },
  },
  {
    id: "costume-from-the-cupboard",
    title: "Make one out of what is already in the house",
    shelf: "be-something",
    line: "The constraint is the fun. A black coat and a good hat is ninety percent of most things.",
    image: {
      src: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/79/020221016_Halloween_2022_in_Poland%2C_accessories.jpg/960px-020221016_Halloween_2022_in_Poland%2C_accessories.jpg",
      credit: "Silar",
      licence: "CC BY-SA 4.0",
      page: "https://commons.wikimedia.org/wiki/File%3A020221016%20Halloween%202022%20in%20Poland%2C%20accessories.jpg",
      alt: "A pile of Halloween costume pieces including a witch's hat and a skull mask",
    },
    detail: {
      hook: "The constraint is the fun.",
      need: ["What is already in the house", "One bought thing, at most"],
      trick: {
        title: "A coat and a hat is ninety percent of most things",
        body: "Pick the silhouette out of the wardrobe first. The single detail you add after that is what names it.",
      },
      tryThis: [
        "All black, plus one wrong detail, is a dozen different costumes.",
        "Borrowing from somebody taller changes the shape more than anything you can buy.",
      ],
      time: "An hour of rummaging",
    },
  },
  {
    id: "family-costume",
    title: "Agree on one idea for everybody",
    shelf: "be-something",
    line: "Harder to negotiate than to build. Settle it early in the month while it is still funny.",
    withKids: true,
  },
  {
    id: "the-easy-terrifying-one",
    title: "The easy frightening one",
    shelf: "be-something",
    line: "No mask, no shop. Ordinary clothes and one detail that is wrong — too-long sleeves, a blank white eye.",
  },
  {
    id: "make-a-mask",
    title: "Make a mask",
    shelf: "be-something",
    line: "Papier-mâché over a balloon takes three evenings of nothing and comes out better than anything plastic.",
    takesAnEvening: true,
  },
];

export const SHELVES: readonly {
  readonly id: MakeShelf;
  readonly title: string;
  readonly line: string;
}[] = [
  {
    id: "pumpkin-night",
    title: "Pumpkin night",
    line: "One evening, newspaper on the floor, everybody's hands cold.",
  },
  {
    id: "make-the-house-weird",
    title: "Make the house weird",
    line: "What the street sees, and what you have to walk past at night.",
  },
  {
    id: "together",
    title: "Make something together",
    line: "Kitchen table things. Forty minutes, ends up on the fridge.",
  },
  {
    id: "be-something",
    title: "Be something",
    line: "There are only so many evenings before the 31st.",
  },
];

export const doingById = (id: string): Doing | undefined =>
  MAKING.find((d) => d.id === id);

export const doingsOnShelf = (shelf: MakeShelf): Doing[] =>
  MAKING.filter((d) => d.shelf === shelf);

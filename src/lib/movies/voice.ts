import type { Audience, Fear } from "./catalogue";

/**
 * **October's voice, adjusted for the room.**
 *
 * The first draft asked everyone *"So what kind of mistake are we making
 * tonight?"* — which is exactly right for two adults at 11 p.m. and absurd
 * for a five-year-old, and pretending a child's movie night is a horror
 * mistake would be the same failure as pretending a haunted house is cozy.
 *
 * The fix is small on purpose: the **interaction is identical** for every
 * audience — who's here, how much, three films — and only the wording moves.
 * One table, one lookup, no separate Kids Movie Night. October is the same
 * presence in all three rooms; it just knows who is in the room.
 */
export const OPENING = "Nobody's going anywhere tonight.";

export const AUDIENCE_QUESTION = "Who's watching?";

export const AUDIENCES: readonly {
  id: Audience;
  label: string;
  whisper: string;
}[] = [
  {
    id: "kids",
    label: "There are kids here",
    whisper: "Nothing that keeps anybody up.",
  },
  {
    id: "teens",
    label: "Older kids, or teenagers",
    whisper: "It can have some teeth.",
  },
  { id: "adults", label: "Just adults", whisper: "Anything at all." },
];

/** The fear question, in the room's own register. */
export const FEAR_QUESTION: Record<Audience, string> = {
  kids: "How spooky are we feeling?",
  teens: "How far do we want to go?",
  adults: "So what kind of mistake are we making tonight?",
};

/** What each level is called, and promises, per room. */
export const FEAR_COPY: Record<
  Audience,
  Record<Fear, { label: string; whisper: string }>
> = {
  kids: {
    cozy: {
      label: "Just fun",
      whisper: "Pumpkins and songs. No scares at all.",
    },
    spooky: {
      label: "A bit spooky",
      whisper: "Tense for a minute, then it lets you go.",
    },
    creepy: {
      label: "Properly spooky",
      whisper: "Older kids. Some of this sticks.",
    },
    nightmare: { label: "Too far", whisper: "Not tonight." },
  },
  teens: {
    cozy: {
      label: "Something warm",
      whisper: "Gothic and funny, not frightening.",
    },
    spooky: {
      label: "Fun scary",
      whisper: "Jumps you'll laugh at afterwards.",
    },
    creepy: {
      label: "Actually scary",
      whisper: "The kind that follows you upstairs.",
    },
    nightmare: { label: "Regret it", whisper: "You have been warned." },
  },
  adults: {
    cozy: {
      label: "Something warm",
      whisper: "We don't have to do this every night.",
    },
    spooky: {
      label: "Something fun",
      whisper: "Popcorn horror. Nobody's losing sleep.",
    },
    creepy: {
      label: "Something disturbing",
      whisper: "The kind that follows you upstairs.",
    },
    nightmare: {
      label: "Make me regret asking",
      whisper: "Fine. But you asked.",
    },
  },
};

/** After they pick a film. */
export const COMMITTED: Record<Audience, string> = {
  kids: "Good pick. Lights off.",
  teens: "Good. Lights off.",
  adults: "Good. Lights off.",
};

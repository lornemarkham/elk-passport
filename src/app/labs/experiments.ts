import { arrivalsEnabled } from "@/lib/conference-arrivals/enabled";
import { conferenceSetup } from "@/lib/conference/config";

/**
 * **What Labs may honestly offer, decided from the environment it is running in.**
 *
 * A Labs card that opens onto an error is worse than no card, so a card links
 * only while its experiment can actually be played *here*. Everything else is
 * listed with the reason it is closed and no link at all:
 *
 * - `playable` — opens, works, and the note says what is not real about it.
 * - `blocked`  — cannot work in this environment (or at all yet). No link.
 *
 * Nothing here applies a migration, opens a sign-in flow or flips a flag: it
 * only reads what the experiments' own gates already say.
 *
 * October is deliberately absent. It belongs to iamoctober.com, not Labs.
 */
export type LabStatus = "playable" | "blocked";

export interface LabExperiment {
  readonly id: string;
  readonly emoji: string;
  readonly kicker: string;
  readonly title: string;
  readonly status: LabStatus;
  /** Present only when `status` is `playable`. */
  readonly href?: string;
  /** What is real, and what is not, in one honest sentence. */
  readonly note: string;
}

type Env = Readonly<Record<string, string | undefined>>;

export function labExperiments(
  env: Env = process.env,
  isDev: boolean = process.env.NODE_ENV !== "production",
): readonly LabExperiment[] {
  // Discovery and Go have a day are made of what Atlas knows. Without an
  // Atlas to ask there is nothing to discover, and the pages would be empty.
  const atlas = Boolean(env.ATLAS_API_URL);
  const needsAtlas =
    "Needs Atlas, which is not configured in this environment.";

  const conference = conferenceSetup(env, isDev);
  const arrivals = arrivalsEnabled(env, isDev);

  return [
    {
      id: "go-have-a-day",
      emoji: "🗓️",
      kicker: "Go have a day",
      title: "Say what you want. Get a day you can print and leave the phone.",
      status: atlas ? "playable" : "blocked",
      href: atlas ? "/go" : undefined,
      note: atlas
        ? "Real places from Atlas. Travel times are Atlas's routed estimate, or a straight line that says so."
        : needsAtlas,
    },
    {
      id: "vancouver-discovery",
      emoji: "🧭",
      kicker: "Discovery · Vancouver",
      title: "Possibilities near you, measured from where you actually are",
      status: atlas ? "playable" : "blocked",
      href: atlas ? "/discovery" : undefined,
      note: atlas
        ? "Pick Vancouver under “from where”. Distances and stated drive limits are Atlas's to check."
        : needsAtlas,
    },
    {
      id: "hockey-night",
      emoji: "🏒",
      kicker: "Hockey Night",
      title: "Canucks night: call the game, argue about where to eat",
      status: "playable",
      href: "/labs/experience/sycle-hockey-night",
      note: "Invented fixture people and standings. Everything lives in this browser only; nobody else is really there.",
    },
    {
      id: "hockey-shared",
      emoji: "🔒",
      kicker: "Hockey Night · shared",
      title: "A private night you share with real friends",
      status: "blocked",
      note: "Needs real sign-in and a database migration that has not been applied. Held back on purpose; not in this build.",
    },
    {
      id: "conference",
      emoji: "🎪",
      kicker: "Go have a conference",
      title: "Everyone's going to be in the same place",
      status: conference.open ? "playable" : "blocked",
      href: conference.open ? "/labs/conference" : undefined,
      note: conference.open
        ? conference.config.guests
          ? `In-memory: it forgets everything when the server restarts. ${
              conference.config.allowGuestOrganisers
                ? "Anyone can start one."
                : "Joining needs no account; starting one needs a Passport account."
            }`
          : "Durable and private. Everyone needs a Passport account."
        : `Closed here, not broken: ${conference.missing.join(", ")} not set.`,
    },
    {
      id: "arrivals",
      emoji: "✈️",
      kicker: "Conference · Arrivals",
      title: "Watch your colleagues' flights come in",
      status: arrivals ? "playable" : "blocked",
      href: arrivals ? "/labs/conference" : undefined,
      note: arrivals
        ? "Open inside a conference you create. Flights are kept in memory and vanish on restart."
        : "Closed on purpose: it has no durable store yet, so it never runs outside development.",
    },
    {
      id: "experience-lab",
      emoji: "🧪",
      kicker: "Experience Lab",
      title: "Five experiences, one engine",
      status: "playable",
      href: "/labs/experience",
      note: "Invented fixtures. State lives in this browser only.",
    },
  ];
}

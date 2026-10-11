import type { Metadata } from "next";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { defaultFeed } from "@/domain/discovery/defaultFeed";
import { GoHaveADay } from "@/components/go/GoHaveADay";
import { ThemeProvider } from "@/components/ghad/theme";
import { PassportNav } from "@/components/shell/PassportNav";
import { currentUser } from "@/lib/auth/currentUser";
import { ZONE } from "@/domain/experience/eventTime";
import {
  scenarioFrom,
  simulatedEnvironment,
  SIMULATED_SOURCE,
} from "@/lib/environment/scenario";
import { OCTOBER_PLACES } from "@/domain/environment/places";
import { hoursBetween } from "@/domain/environment/types";
import { readWeather } from "@/domain/discovery/situation";
import type { PlanWeather } from "@/domain/day/build";

export const metadata: Metadata = {
  title: "Go have a day",
  description:
    "Say what kind of day you want. Passport builds one out of real places, and prints it so you can put your phone away.",
};

/**
 * **`/go` — say what kind of day you want.**
 *
 * The whole loop in one route: a sentence, a day built from Atlas subjects,
 * revisions in the person's own words, and a printable guide at the end of
 * it. The doctrine's SHAPE step (§2.5) and *less phone, more life* (§6),
 * which until now existed as a sketch at `/about/experiment-06-analog-adventures`
 * and nowhere a person could reach.
 *
 * ## What it reuses
 *
 * All of it. `listDiscoveryCandidates` is the same cached corpus read
 * Discovery makes, `defaultFeed` is the same quality policy, the cards link
 * to the same entity pages, and the brief is read by the same town list the
 * questionnaire uses. No new store, no copy of Atlas, no second source of
 * truth — the mission's own rule.
 *
 * ## Why the age is asked of Atlas here too
 *
 * `?age=N` reaches `listDiscoveryCandidates(childAge)` exactly as it does on
 * Discovery, so `suitability.forAge` is Atlas's verdict rather than
 * Passport's inference. Without one, nobody is asked about.
 *
 * ## And the day
 *
 * The first version read the corpus without `?on=`, so Atlas never answered
 * `schedule.onDate` and the builder's "stated closed that day" rule — and its
 * "published as open" line — could not fire for anybody. The day goes to
 * Atlas now, today unless `?on=` says otherwise, exactly as Discovery sends it.
 *
 * ## The weather
 *
 * The forecast is fetched in the browser for whichever town the sentence
 * names (`/api/environment`, Environment Canada, labelled with its city). In
 * development only, `?sim=<scenario>` substitutes the same simulated
 * conditions October and Discovery use, labelled *SIMULATED — not real
 * weather* on screen. Neither is ever stored.
 */
type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

export default async function GoPage({ searchParams }: Props) {
  const query = (await searchParams) ?? {};
  const asked = Number(one(query.age));
  const childAge =
    Number.isInteger(asked) && asked >= 0 && asked <= 17 ? asked : undefined;

  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ZONE,
  })
    .format(now)
    .replace(/(\d+)\/(\d+)\/(\d+)/, "$1-$2-$3");
  const askedDay = one(query.on);
  const on =
    askedDay && /^\d{4}-\d{2}-\d{2}$/.test(askedDay) ? askedDay : today;

  const [candidates, user] = await Promise.all([
    listDiscoveryCandidates(childAge, on),
    currentUser(),
  ]);

  // The same feed policy Discovery applies — a typo'd parking lot is not a
  // stop on anybody's afternoon — and the same trimming, because this page
  // serialises its pool for the same reason Discovery does.
  const pool = defaultFeed(candidates.map(candidateToExperience)).map((e) =>
    e.description === e.shortDescription
      ? ({ ...e, description: undefined } as typeof e)
      : e,
  );

  const simulated = simulatedWeather(one(query.sim));

  return (
    <ThemeProvider>
      <PassportNav displayName={user?.displayName ?? null} />
      <main className="min-h-screen bg-white">
        <GoHaveADay
          pool={pool}
          today={today}
          {...(one(query.say) ? { initialSay: one(query.say)! } : {})}
          {...(one(query.mode) ? { initialMode: one(query.mode)! } : {})}
          {...(childAge !== undefined ? { childAge } : {})}
          {...(one(query.at) ? { townId: one(query.at)! } : {})}
          on={on}
          {...(simulated ? { simulatedWeather: simulated } : {})}
        />
      </main>
    </ThemeProvider>
  );
}

/**
 * **Development-only weather**, from the same scenarios October uses. Inert
 * in production (`scenarioFrom` refuses outside `development`), and labelled
 * with `SIMULATED_SOURCE` everywhere it is shown.
 */
function simulatedWeather(sim: string | undefined): PlanWeather | undefined {
  const scenario = scenarioFrom(sim);
  if (!scenario) return undefined;
  const area = OCTOBER_PLACES.find((p) => p.id === scenario.areaId);
  if (!area) return undefined;
  const environment = simulatedEnvironment(scenario, area);
  const end = new Date(scenario.now);
  end.setHours(23, 59, 59, 999);
  const reading = readWeather(
    hoursBetween(environment, scenario.now.toISOString(), end.toISOString()),
    SIMULATED_SOURCE,
  );
  return reading ? { ...reading, area: area.name } : undefined;
}

import type { Metadata } from "next";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { defaultFeed } from "@/domain/discovery/defaultFeed";
import { GoHaveADay } from "@/components/go/GoHaveADay";
import { ThemeProvider } from "@/components/ghad/theme";
import { PassportNav } from "@/components/shell/PassportNav";
import { currentUser } from "@/lib/auth/currentUser";
import { ZONE } from "@/domain/experience/eventTime";

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

  const [candidates, user] = await Promise.all([
    listDiscoveryCandidates(childAge),
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

  const now = new Date();
  const today = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ZONE,
  })
    .format(now)
    .replace(/(\d+)\/(\d+)\/(\d+)/, "$1-$2-$3");

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
          {...(one(query.on) ? { on: one(query.on)! } : {})}
        />
      </main>
    </ThemeProvider>
  );
}

import Link from "next/link";
import { ArrowRight, CalendarClock, Compass, Lock, MapPin } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import type { BoardRole } from "@/lib/collaboration/boardAccess";
import {
  activityFacts,
  dayDoors,
  staffActivities,
  type Gathering,
  type StaffActivity,
} from "@/lib/data/boards-gatherings";
import {
  InterestProvider,
  InterestToggle,
  KindredPanel,
  ShowNameChoice,
  type InterestPicture,
} from "./GatheringInterest";

/**
 * **A conference activities board.**
 *
 * The featured staff game, anything else organisers have confirmed, the
 * informal adventures colleagues have saved to the board, and doors into Go
 * Have A Day from the conference's own town.
 *
 * What a visitor sees and what a colleague sees are different on purpose.
 * The plan itself — an activity and the facts nobody has confirmed yet — names
 * no person and is shown to anyone with the link. Everything about people
 * (who is interested, who else likes the same things) needs a signed-in
 * member of the gathering's board, and is never rendered for anyone else.
 */
export type GatheringViewer =
  | { readonly kind: "signed-out" }
  /** The organiser has not opened a staff board yet. */
  | { readonly kind: "no-board" }
  | { readonly kind: "not-member" }
  | { readonly kind: "board-error" }
  | {
      readonly kind: "member";
      readonly boardId: string;
      readonly role: BoardRole;
      readonly yourName: string;
      /** `null` when Passport could not read interest — not "nobody". */
      readonly interest: InterestPicture | null;
      readonly adventures: readonly Experience[];
      readonly unresolved: number;
    };

const AWAITING = "Awaiting confirmation";

function Facts({ activity }: { readonly activity: StaffActivity }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {activityFacts(activity).map((fact) => (
        <div key={fact.label} className="rounded-lg border px-4 py-3">
          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {fact.label}
          </dt>
          <dd
            className={
              fact.value
                ? "mt-1 font-medium"
                : "text-muted-foreground mt-1 italic"
            }
          >
            {fact.value ?? AWAITING}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Notice({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="bg-muted/40 flex gap-3 rounded-xl border p-4 text-sm">
      <Lock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">{title}</p>
        <div className="text-muted-foreground mt-1">{children}</div>
      </div>
    </div>
  );
}

function WhoNotice({
  viewer,
  gathering,
}: {
  readonly viewer: GatheringViewer;
  readonly gathering: Gathering;
}) {
  const path = `/boards/conference/${gathering.slug}`;
  switch (viewer.kind) {
    case "signed-out":
      return (
        <Notice title={`Interest is for ${gathering.forWhom}`}>
          <Link className="underline" href={`/auth?next=${path}`}>
            Sign in
          </Link>{" "}
          and open the staff invite link to say what you&apos;re into and find
          colleagues who are into it too.
        </Notice>
      );
    case "no-board":
      return (
        <Notice title="The staff board isn't open yet">
          Once an organiser opens it, colleagues join with an invite link and
          can say what they&apos;re interested in. Nothing about anyone is shown
          until then.
        </Notice>
      );
    case "not-member":
      return (
        <Notice title={`This board is for ${gathering.forWhom}`}>
          Ask whoever is organising for the staff invite link. Joining is up to
          you, and only people on the board see who&apos;s interested.
        </Notice>
      );
    case "board-error":
      return (
        <Notice title="Couldn't reach the staff board">
          The activities are below; who&apos;s interested will be back when
          Passport can reach the board again.
        </Notice>
      );
    case "member":
      return viewer.interest === null ? (
        <Notice title="Passport can't record interest here yet">
          The board is open, but saying you&apos;re interested isn&apos;t
          switched on for it yet. Nothing has been lost.
        </Notice>
      ) : null;
  }
}

function canMark(viewer: GatheringViewer): viewer is Extract<
  GatheringViewer,
  { kind: "member" }
> & {
  interest: InterestPicture;
} {
  return viewer.kind === "member" && viewer.interest !== null;
}

function Featured({
  gathering,
  viewer,
}: {
  readonly gathering: Gathering;
  readonly viewer: GatheringViewer;
}) {
  const { featured } = gathering;
  const gameDoor = dayDoors(gathering).gameDay;
  return (
    <section
      aria-labelledby="featured"
      className="rounded-2xl border-2 p-6 sm:p-8"
    >
      <p className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
        Featured
      </p>
      <h2
        id="featured"
        className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
      >
        {featured.title}
      </h2>
      <p className="text-muted-foreground mt-2">{featured.shortDescription}</p>

      <div className="mt-6">
        <Facts activity={featured} />
      </div>
      {featured.confirmedBy && (
        <p className="text-muted-foreground mt-3 text-xs">
          Confirmed by {featured.confirmedBy}.
        </p>
      )}

      {canMark(viewer) && (
        <div className="mt-6">
          <InterestToggle itemId={featured.id} title={featured.title} />
        </div>
      )}

      <div className="mt-6 border-t pt-4 text-sm">
        {gameDoor ? (
          <Link
            href={gameDoor.href}
            className="text-primary inline-flex items-center gap-1 font-medium"
          >
            {gameDoor.title}: {gameDoor.blurb}{" "}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <p className="text-muted-foreground inline-flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Once the game&apos;s date is confirmed, you can build the rest of
            that day around it.
          </p>
        )}
      </div>
    </section>
  );
}

function OtherActivities({
  gathering,
  viewer,
}: {
  readonly gathering: Gathering;
  readonly viewer: GatheringViewer;
}) {
  return (
    <section aria-labelledby="activities">
      <h2 id="activities" className="mb-3 text-xl font-semibold">
        Other staff activities
      </h2>
      {gathering.activities.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nothing else confirmed yet. Organisers add activities here as
          they&apos;re confirmed.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {gathering.activities.map((activity) => (
            <li key={activity.id} className="rounded-xl border p-5">
              <h3 className="font-semibold">{activity.title}</h3>
              <p className="text-muted-foreground mt-1 mb-4 text-sm">
                {activity.shortDescription}
              </p>
              <Facts activity={activity} />
              {canMark(viewer) && (
                <div className="mt-4">
                  <InterestToggle itemId={activity.id} title={activity.title} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Adventures({
  gathering,
  viewer,
}: {
  readonly gathering: Gathering;
  readonly viewer: GatheringViewer;
}) {
  if (viewer.kind !== "member") return null;
  const back = encodeURIComponent(`/boards/conference/${gathering.slug}`);
  const discover = `/discovery?at=${encodeURIComponent(gathering.townId)}`;
  const canAdd = viewer.role !== "viewer";

  return (
    <section aria-labelledby="adventures">
      <h2 id="adventures" className="mb-1 text-xl font-semibold">
        Informal adventures
      </h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Things colleagues have saved to this board from around{" "}
        {gathering.cityName}.
        {canAdd ? (
          <>
            {" "}
            <Link className="underline" href={discover}>
              Find one in Discovery
            </Link>{" "}
            and save it here.
          </>
        ) : null}
      </p>

      {viewer.unresolved > 0 && (
        <p className="text-muted-foreground mb-4 text-sm">
          {viewer.unresolved} saved{" "}
          {viewer.unresolved === 1 ? "adventure" : "adventures"} can&apos;t be
          shown right now — they&apos;re still on the board.
        </p>
      )}

      {viewer.adventures.length === 0 ? (
        viewer.unresolved === 0 && (
          <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">
            Nothing saved yet.
          </p>
        )
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {viewer.adventures.map((experience) => (
            <li
              key={experience.id}
              className="flex flex-col gap-3 rounded-xl border p-5"
            >
              <div>
                <h3 className="font-semibold">{experience.title}</h3>
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {experience.shortDescription}
                </p>
              </div>
              {canMark(viewer) && (
                <InterestToggle
                  itemId={experience.id}
                  title={experience.title}
                />
              )}
              <Link
                href={`/day/${encodeURIComponent(experience.id)}?back=${back}`}
                className="text-primary inline-flex items-center gap-1 text-sm font-medium"
              >
                Let&apos;s do this <ArrowRight className="h-4 w-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DayDoors({ gathering }: { readonly gathering: Gathering }) {
  const doors = dayDoors(gathering).free;
  return (
    <section aria-labelledby="go">
      <h2 id="go" className="mb-1 text-xl font-semibold">
        Go have a day in {gathering.cityName}
      </h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Say what kind of time you&apos;ve got. Passport builds it from real
        places, prints it, and you leave the phone in your pocket.
      </p>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {doors.map((door) => (
          <li key={door.title}>
            <Link
              href={door.href}
              className="hover:border-primary/40 flex h-full flex-col rounded-xl border p-4 transition-colors"
            >
              <span className="font-semibold">{door.title}</span>
              <span className="text-muted-foreground mt-1 text-sm">
                {door.blurb}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GatheringBoard({
  gathering,
  viewer,
}: {
  readonly gathering: Gathering;
  readonly viewer: GatheringViewer;
}) {
  const titles = Object.fromEntries([
    ...staffActivities(gathering).map((a) => [a.id, a.title] as const),
    ...(viewer.kind === "member"
      ? viewer.adventures.map((e) => [e.id, e.title] as const)
      : []),
  ]);

  const body = (
    <div className="flex flex-col gap-10">
      <header>
        <p className="text-primary text-xs font-semibold tracking-[0.12em] uppercase">
          {gathering.forWhom}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          {gathering.title}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-[60ch]">
          {gathering.what}
        </p>
        <p className="text-muted-foreground mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-4 w-4" /> {gathering.cityName}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-4 w-4" />
            {gathering.days
              ? `${gathering.days.from} – ${gathering.days.to}`
              : `Dates ${AWAITING.toLowerCase()}`}
          </span>
        </p>
      </header>

      <WhoNotice viewer={viewer} gathering={gathering} />

      <Featured gathering={gathering} viewer={viewer} />

      {canMark(viewer) && (
        <div className="flex flex-col gap-4">
          <ShowNameChoice />
          <KindredPanel titles={titles} />
        </div>
      )}

      <OtherActivities gathering={gathering} viewer={viewer} />
      <Adventures gathering={gathering} viewer={viewer} />
      <DayDoors gathering={gathering} />

      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <Compass className="h-3.5 w-3.5" />
        Nothing on this page is a booking. Details marked awaiting confirmation
        will appear when an organiser confirms them.
      </p>
    </div>
  );

  return canMark(viewer) ? (
    <InterestProvider
      boardId={viewer.boardId}
      initial={viewer.interest}
      yourName={viewer.yourName}
    >
      {body}
    </InterestProvider>
  ) : (
    body
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ZONE } from "@/domain/experience/eventTime";
import { Leaf } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  scopeExperiences,
  scopeLabel,
  type GeographicScope,
} from "@/domain/discovery/geographicScope";
import type { Experience } from "@/domain/experience/types";
import {
  clearStoredActiveBoardId,
  getStoredActiveBoardId,
  setStoredActiveBoardId,
} from "@/lib/data/activeBoardStorage";
import {
  createBoard,
  deleteBoard,
  isSignedOut,
  listBoardItems,
  listBoards,
  removeExperienceFromBoard,
  renameBoard,
  saveExperienceToBoard,
  type Board,
  type BoardItem,
} from "@/lib/data/boards-repo";
import { listOctoberThings, wantToDo } from "@/lib/october/october-repo";
import { isOctoberKind } from "@/lib/october/types";
import { DeleteBoardDialog } from "./DeleteBoardDialog";
import {
  DiscoveryListSidebar,
  type SavedListItem,
} from "./DiscoveryListSidebar";
import { FeelLikeDoing } from "@/components/ghad/FeelLikeDoing";
import { ThemeProvider } from "@/components/ghad/theme";
import { excludesAge, ageEvidence } from "@/domain/discovery/suitability";
import { countElsewhere, elsewhere, otherAreas } from "@/domain/discovery/area";
import {
  byPreference,
  statedNotOn,
  type Preferences,
} from "@/domain/discovery/preference";
import { useDistances } from "@/lib/location/useDistances";
import { useTravelTimes } from "@/lib/routing/useTravelTimes";
import { attributionFor } from "@/lib/routing/attribution";
import { TOWN_GROUPS, homeArea, townById } from "@/domain/discovery/towns";

/**
 * Why a distance pill is not pressable yet.
 *
 * Said as the two things that would fix it rather than only the one — the
 * previous wording, *"Share where you are first"*, named a permission many
 * readers had already refused and left them nowhere to go.
 */
const NEEDS_ORIGIN = "Share your location or pick a town first";
import { ruledOutOn } from "@/domain/discovery/recurrence";
import { TodayPanel } from "./TodayPanel";
import type { DayWeather, Situation } from "@/domain/discovery/situation";
import {
  distanceTo,
  measuredWithin,
  nearSection,
  nearYou,
  nearestFirst,
  placedBeyond,
  sortKm,
} from "@/domain/discovery/proximity";
import { invitationSection } from "@/domain/discovery/directions";
import {
  activityExplorer,
  activityForDoing,
  activityOffers,
  placesByActivity,
  relatedActivities,
  type Activity,
} from "@/domain/discovery/activities";
import { areaOf } from "@/domain/discovery/area";
import { ActivityExplorer, ActivityExplorerButton } from "./ActivityExplorer";
import { OriginPicker } from "./OriginPicker";
import { useHere } from "@/lib/location/useHere";
import { DiscoverySections } from "./DiscoverySections";
import { withoutRepeatedIllustrations } from "@/domain/discovery/illustrations";
import { PossibilityCard } from "./PossibilityCard";
import {
  composeDiscovery,
  dayOf,
  dominantArea,
  pictureFirst,
} from "@/domain/discovery/compose";
import { INTENTS, intentOf, type IntentKey } from "@/domain/discovery/intents";
import {
  pendingParam,
  readPending,
  readSession,
  sessionHref,
  sessionQuery,
  situationOf,
  type DiscoverySession,
  type PendingAction,
} from "@/domain/discovery/session";
import { availableKinds, defaultFeed } from "@/domain/discovery/defaultFeed";
import type { ExperienceKind } from "@/domain/experience/types";
import { readAsk, readBack, type DiscoveryAsk } from "@/lib/ai/ask/read";
import {
  answerAsk,
  dayHref,
  fitsConversation,
  readNothing,
} from "@/lib/ai/ask/answer";
import { findByName } from "@/lib/ai/ask/byName";
import { kindLabel } from "@/domain/discovery/defaultFeed";
import { applyAsk, daySentence, windowSentence } from "@/lib/ai/ask/apply";
import { readConversation } from "@/lib/ai/ask/conversation";
import { AskDiscovery, startersFor } from "./AskDiscovery";

/** How many activities the row offers before it would become a wall. */
const ACTIVITY_CHIPS = 8;

/**
 * **The rows are the truth for what they hold.** A sentence sets them; a tap
 * after it wins. So who is coming, the age, the day and the activity are
 * read back from the rows into what the conversation adds up to.
 */
function withRows(ask: DiscoveryAsk, session: DiscoverySession): DiscoveryAsk {
  const out: Record<string, unknown> = { ...ask };
  out.company = session.company;
  if (session.company !== "child") delete out.childAge;
  out.childAge = session.age;
  out.on = session.on;
  const doing = activityForDoing(session.doing)?.key;
  if (doing) out.doing = doing;
  // A tapped length of day that is not what the hours said: the tap wins.
  if (
    ask.window !== undefined &&
    session.window !== undefined &&
    session.window !== ask.window
  ) {
    delete out.hours;
    out.window = session.window;
  }
  return Object.fromEntries(
    Object.entries(out).filter(([, v]) => v !== undefined),
  ) as unknown as DiscoveryAsk;
}

/**
 * **The next few days, named the way a person would.**
 *
 * Built from the server's instant so the client never reads its own clock, and
 * in the Okanagan's own zone — a date read at UTC midnight is the previous
 * evening there, which is how Sunday gets offered as Saturday.
 */
function nextDays(now: Date): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (let ahead = 0; ahead < 7; ahead += 1) {
    const at = new Date(now.getTime() + ahead * 86_400_000);
    const value = new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
    const weekday = new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONE,
      weekday: "long",
    }).format(at);
    out.push({
      value,
      label: ahead === 0 ? "today" : ahead === 1 ? "tomorrow" : weekday,
    });
  }
  return out;
}

/**
 * What a subject Atlas could not place reads as, once Discovery holds a
 * distance reading — so it can never be sorted or filtered as near.
 */
const UNPLACED = { state: "unknown" } as const;

/** How many results a page of search or browse shows before offering more. */
const RESULT_PAGE = 24;

interface DiscoveryListViewProps {
  experiences: Experience[];
  /**
   * Where Passport is looking, or `undefined` for everywhere — resolved once by
   * `activeScope()` and passed in, so no component decides this for itself. A
   * prop rather than a constant, so a viewport or radius scope arrives here
   * without touching this file.
   */
  scope?: GeographicScope;
  /**
   * The signed-in person's name, or `null` for a visitor.
   *
   * Resolved on the server and passed down, so the view never has to guess and
   * never flickers from anonymous to named. It decides one thing only: whether
   * saving writes to a board or offers a sign-in. Everything else on this page
   * — the feed, the scope, search, kinds, Inspiration — is identical either way.
   */
  displayName?: string | null;
  /**
   * The instant the server rendered, as an ISO string.
   *
   * Composition is time-aware, and a client reading its own clock during
   * render hydrates into a mismatch with the markup it was sent. One instant,
   * resolved once, used by both halves.
   */
  now?: string;
  /** That instant written out, e.g. `Saturday, October 10`. */
  today?: string;
  /**
   * Today's real forecast for the area Discovery is mostly about, or nothing.
   * Resolved on the server so nobody has to type "it is raining".
   */
  weather?: DayWeather & { area?: string };
}

/**
 * List mode: Discovery optimized for finding and saving quickly, not for
 * immersion. Same repository → Atlas → BoardService → AtlasStore save
 * and board-management path the immersive experience uses (boards-repo,
 * activeBoardStorage) — this is a new presentation over the existing
 * board workflow, not a new one. See DiscoverySpace.tsx for the
 * Atlas-first patterns (switchToBoard, handleConfirmDeleteBoard, etc.)
 * this mirrors.
 */
export function DiscoveryListView({
  experiences,
  scope,
  displayName = null,
  now,
  today,
  weather,
}: DiscoveryListViewProps) {
  const signedIn = displayName !== null;

  const [boards, setBoards] = useState<Board[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [boardsLoaded, setBoardsLoaded] = useState(false);
  const [boardItems, setBoardItems] = useState<BoardItem[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [confirmingDeleteBoard, setConfirmingDeleteBoard] = useState(false);
  const [isDeletingBoard, setIsDeletingBoard] = useState(false);
  // Which board-changing operation (switch, create-then-switch, or
  // rename) is the most recent. Root cause of the "rename only takes
  // effect after another interaction" bug: switchToBoard and
  // handleRenameBoard each independently `await` a request and then call
  // setBoard(...) with whatever they started with. With no coordination,
  // an in-flight rename that resolves *after* the user has switched
  // boards would win the race and silently snap `board` back to the
  // renamed one. Every operation claims a ticket before its request goes
  // out; only the operation still holding the latest ticket when its
  // request resolves is allowed to apply setBoard.
  const boardRequestRef = useRef(0);

  // The day a person actually has. Situational and deliberately not persisted
  // — see `situation.ts`. Nothing here becomes a profile.
  const { place, weather: here, at: shared, ask } = useHere();

  /**
   * What the person said they feel like, in their words rather than Atlas's.
   * `null` is the composed page; a key narrows the whole pool to that intent.
   *
   * **Held in the URL**, so an intent is a place rather than a mood the page
   * happens to be in: the back button leaves it, a link can arrive already in
   * it, and the eight dead category tiles on Passport's own homepage became
   * five working front doors instead of being deleted.
   */
  const router = useRouter();
  const params = useSearchParams();

  /**
   * **The whole exploration, held in the URL.**
   *
   * Read once on mount and mirrored back with `history.replaceState` rather
   * than a router navigation: this page's server half reads Atlas, and a soft
   * navigation per keystroke would re-run that. The URL is a record of where
   * somebody is, not a request to fetch it again.
   *
   * Everything that used to be local state lives here — the category, what
   * they typed, who is with them, how long they have, the verb they tapped —
   * so a refresh, a trip to the board, and a round trip through sign-in all
   * put them back where they were.
   */
  const [session, setSession] = useState<DiscoverySession>(() =>
    readSession(new URLSearchParams(params.toString())),
  );
  const intent = session.intent ?? null;
  const kind = session.kind ?? null;
  const doing = session.doing;
  /** The town they picked, where they picked one. Verified, or absent. */
  const town = townById(session.at);
  const childAge = session.age;
  const on = session.on;
  const within = session.within;
  const situation = situationOf(session);

  const change = (next: DiscoverySession) => {
    setSession(next);
    const query = sessionQuery(next);
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : window.location.pathname,
    );
  };
  const setIntent = (next: IntentKey | null) =>
    change({
      ...session,
      ...(next ? { intent: next } : { intent: undefined }),
    });
  const setKind = (next: ExperienceKind | null) =>
    change({ ...session, ...(next ? { kind: next } : { kind: undefined }) });
  const setSituation = (next: Situation) =>
    change({ ...session, company: next.company, window: next.window });
  const setDoing = (next: string | undefined) =>
    change({ ...session, doing: next });

  /**
   * **The two choices that go back to the server.**
   *
   * Everything else on this page is mirrored with `history.replaceState`,
   * because a soft navigation per keystroke would re-run an Atlas read. An age
   * and a day are different: Atlas has to be asked `childAge=N` to answer with
   * a verdict, and `on=YYYY-MM-DD` to say whether stated hours, a season or a
   * held interval cover that day. So these are real navigations, and the
   * exploration survives them because the exploration is already in the URL.
   */
  const navigate = (next: DiscoverySession) => {
    setSession(next);
    const query = sessionQuery(next);
    // **The address first, then the server.** The navigation commits only
    // once Atlas has answered for the new day or age — seconds, cold — and a
    // card tapped before then abandoned it, so Back returned to a bare
    // `/discovery` and the question was gone. Written now, the URL is right
    // whatever happens to the navigation.
    window.history.replaceState(
      null,
      "",
      query ? `?${query}` : window.location.pathname,
    );
    router.replace(query ? `?${query}` : "/discovery", { scroll: false });
  };
  const setOn = (next: string | undefined) =>
    navigate({ ...session, on: next });
  const setEverywhere = (next: boolean) =>
    change({ ...session, everywhere: next || undefined });
  const setWithin = (next: number | undefined) =>
    change({ ...session, within: next });
  const setTown = (next: string | undefined) =>
    change({ ...session, at: next });

  const setChildAge = (next: number | undefined) =>
    navigate({ ...session, age: next });

  // How many search/browse results are on screen.
  const [shown, setShown] = useState(RESULT_PAGE);
  // Which Things are already in this person's October. Loaded once for a
  // signed-in person; a visitor has none and is never asked.
  const [wantedIds, setWantedIds] = useState<ReadonlySet<string>>(new Set());

  // **Reset during render, not in an effect.** A new question starts at the
  // top of a short page rather than halfway down a long one — and doing that
  // in an effect renders the stale page first and corrects it a frame later,
  // which is the pattern React documents as adjusting state when a prop
  // changes, not as something to put in `useEffect`.
  const question = JSON.stringify([kind, intent]);
  const [lastQuestion, setLastQuestion] = useState(question);
  if (question !== lastQuestion) {
    setLastQuestion(question);
    setShown(RESULT_PAGE);
  }

  // Same bootstrap contract as the immersive DiscoverySpace (resolve the
  // persisted active board, or Atlas's first, and load its real items) —
  // Atlas is still the one source of truth, this is just a second
  // renderer of the same board data, not a second copy of it.
  useEffect(() => {
    // A visitor has no boards to load. Calling anyway would 401 on every page
    // view and toast an error at somebody who has done nothing wrong.
    if (!signedIn) {
      // The next person to sign in on this browser must not inherit the last
      // one's active board.
      clearStoredActiveBoardId();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [allBoards, octoberThings] = await Promise.all([
          listBoards(),
          listOctoberThings().catch(() => []),
        ]);
        if (cancelled) return;
        setWantedIds(new Set(octoberThings.map((t) => t.entityId)));
        setBoards(allBoards);
        setBoardsLoaded(true);
        const storedId = getStoredActiveBoardId();
        const resolved =
          (storedId && allBoards.find((b) => b.id === storedId)) ||
          allBoards[0];
        if (!resolved) return;
        // **Which board this is, before what is on it.** These used to be
        // one step, so a failed item fetch left `board` null — the sidebar
        // showed no board, *Review board* vanished, and the next save created
        // a second board called "My Places" beside the real one.
        setBoard(resolved);
        setStoredActiveBoardId(resolved.id);
        try {
          const items = await listBoardItems(resolved.id);
          if (!cancelled) setBoardItems(items);
        } catch (error) {
          // The board is still theirs and still reachable. Only its contents
          // are missing, and saying so beats pretending it is not there.
          console.error(
            `Failed to load items for board ${resolved.id}:`,
            error,
          );
          toast.error("Couldn't load what is on your board.");
        }
      } catch (error) {
        console.error("Failed to load boards from Atlas:", error);
        setBoardsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-runs when the person changes — signing in mid-session has to load
    // their boards, and signing out has to stop showing the previous one's.
  }, [signedIn]);

  /**
   * What the page actually shows.
   *
   * Signing out has to clear what is on screen, not merely stop fetching — the
   * previous person's board name and saved places sitting in the sidebar is the
   * exact failure this mission exists to prevent. Derived rather than cleared
   * in an effect: an effect that copies one piece of state into another renders
   * the stale value first and corrects it a frame later, which for *whose data
   * this is* is not an acceptable frame.
   */
  const visibleBoards = signedIn ? boards : [];
  const visibleBoard = signedIn ? board : null;
  // Memoised because two `useMemo`s below depend on it; a fresh `[]` every
  // render would defeat both.
  const visibleBoardItems = useMemo(
    () => (signedIn ? boardItems : []),
    [signedIn, boardItems],
  );
  const boardsReady = signedIn ? boardsLoaded : true;

  /**
   * **The button they pressed before Passport interrupted them.**
   *
   * They tapped *Want to do* on Kangaroo Creek Farm, were asked to sign in,
   * signed in — and nothing had happened, because the press was never carried
   * anywhere. It rides in the URL now (`?do=want:<id>`) and is replayed here,
   * exactly once, as soon as there is somebody to replay it for.
   *
   * Stripped from the URL before the call, not after: a replay that failed and
   * left the parameter in place would fire again on the next render, and
   * saving twice is the duplicate this is supposed to avoid. Both underlying
   * calls are idempotent anyway — `wantToDo` is a PUT, and `saveExperienceToBoard`
   * is guarded below — so the cost of the belt is nothing.
   */
  const replayed = useRef(false);
  useEffect(() => {
    if (replayed.current || !signedIn || !boardsReady) return;
    const pending = readPending(new URLSearchParams(window.location.search));
    if (!pending) return;
    replayed.current = true;
    const stay = sessionQuery(
      readSession(new URLSearchParams(window.location.search)),
    );
    window.history.replaceState(
      null,
      "",
      stay ? `?${stay}` : window.location.pathname,
    );
    const experience = experiences.find((e) => e.id === pending.id);
    if (!experience) {
      // The exploration came back but the thing did not — a candidate Atlas
      // no longer serves. Said rather than silently dropped.
      toast.error("That one is no longer available.");
      return;
    }
    void (pending.act === "want"
      ? handleWant(experience)
      : handleSave(experience));
    // `handleWant`/`handleSave` are hoisted declarations; listing them would
    // re-run this on every render for no benefit, and `replayed` already makes
    // it once-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, boardsReady, experiences]);

  const savedIds = useMemo(
    () => new Set(visibleBoardItems.map((item) => item.experienceId)),
    [visibleBoardItems],
  );

  // The list represents what's still available to discover — once an
  // experience is saved to the active board, the sidebar is its home
  // (see savedItems below). Presentation-only: nothing is deleted, and
  // removing it from the board (handleRemoveSaved) drops it from
  // savedIds, which brings it right back here.
  // **Candidate eligibility is not feed inclusion.** Atlas says 189 things are
  // worth considering; the default view is a conservative projection of that
  // (see `defaultFeed`), and a typed query or an explicit kind searches the
  // *whole* corpus. So `Snowboarding` leaves the feed and is still findable,
  // which is the entire point of keeping the two questions apart.
  // **Browsing means the person asked for something specific.** Then the page
  // owes them one ranked answer rather than a composed magazine, and the whole
  // corpus is in scope — `Snowboarding` leaves the composed page and is still
  // findable, which is the entire point of keeping the two questions apart.
  //
  // **One box.** A typed name search used to be a second way into this mode,
  // from a second text box; names are now answered by the sentence box
  // (`findByName`). A kind picked under *Refine*, or an intent from an old
  // link, still browses — but not over a conversation, which it narrows
  // instead.
  const talking = (session.ask?.length ?? 0) > 0;
  const browsing = !talking && (kind !== null || intent !== null);
  // Where Passport is looking, said once and used by the opening, the composed
  // remainder section and nothing else.
  const where = scopeLabel(scope);

  /**
   * **Somewhere to measure from, by either honest route.**
   *
   * The distance controls were dead for every reader, because the only way to
   * produce an origin was a browser permission — and once `ask` had been
   * pressed it was withheld for the rest of the visit whatever the answer was
   * (see `useHere`). A denial, a timed-out fix or an unreachable Environment
   * Canada all ended with three disabled pills saying *"Share where you are
   * first"* and nothing left to press.
   *
   * So there are two routes now. The shared position wins when there is one —
   * it is the reader's actual position rather than the centre of a town they
   * named — and a picked town answers whenever there is not. A town is also
   * the better answer for somebody planning a Sunday somewhere they are not
   * currently standing, which the geolocation route cannot express at all.
   *
   * The point for a town comes from `OCTOBER_PLACES`: twenty-two centroids
   * verified against Wikidata and already used for the forecast. Nothing is
   * geocoded and nothing is invented.
   */
  const at = useMemo(
    () =>
      shared ??
      (town
        ? { latitude: town.latitude, longitude: town.longitude }
        : undefined),
    [shared, town],
  );
  /** Which of the two the number on screen is measured from. Said out loud. */
  const originLabel = shared ? "where you are" : town?.name;

  /**
   * **Atlas measures; Passport asks** (ADR 094).
   *
   * Once there is an origin, Atlas is asked how far everything it can place
   * is from it — straight-line kilometres, a town centre where that is all it
   * has, and `unknown` for the rest. With a radius, that reading *is* the
   * geographic filter: inside it, measured, or not on the page. The old
   * client-side `km <= within` kept every subject it could not measure, which
   * is how an unlocated tour and a UBC exhibition stayed "near" Vernon.
   *
   * Without a radius the reading still labels and orders, measured against
   * 60 km so "near you" means the same thing it always did.
   */
  const radius = at && within !== undefined ? within : undefined;
  const { reading, status: measuring } = useDistances(at, radius ?? 60);
  /**
   * **Atlas's drive times from the same origin** (ADR 097), beside the
   * distances. They label a card and nothing else: the radius filter stays
   * Atlas's straight-line reading, and a card with no routed time keeps its
   * straight line.
   */
  const driving = useTravelTimes(at, "driving");
  const placedExperiences = useMemo(
    () =>
      reading || driving.journeys
        ? experiences.map((experience) => {
            const travel = driving.journeys?.[experience.id];
            return {
              ...experience,
              ...(reading
                ? { distance: reading.distances[experience.id] ?? UNPLACED }
                : {}),
              ...(travel ? { travel } : {}),
            };
          })
        : experiences,
    [experiences, reading, driving.journeys],
  );
  /** Said under the origin once any card shows a routed time, with credit. */
  const drivingNote = useMemo(() => {
    const journeys = Object.values(driving.journeys ?? {});
    const credit = attributionFor(journeys);
    return credit.length > 0
      ? ` Drive times on cards are routed estimates; a card without one shows a straight line. ${credit.join(" · ")}.`
      : "";
  }, [driving.journeys]);
  /** A radius is in force: it is set, and Atlas has not failed to measure it. */
  const radiusActive = radius !== undefined && measuring !== "failed";
  const radiusReady = radiusActive && measuring === "ready";
  /**
   * **What the exploration carries with it into a card's destination.**
   *
   * The day somebody picked, the age they named, and the way back here. An
   * entity page forwards all three to `/day/{id}`, so "Let's do this" plans
   * the Sunday that was actually chosen rather than today in general — and the
   * back link returns the exploration instead of a bare `/discovery`.
   *
   * Deliberately **not** the reader's position: a coordinate never goes in a
   * URL (ADR 002). The plan asks again, in the browser, or says it cannot
   * measure.
   */
  const carry = useMemo(() => {
    const query = new URLSearchParams();
    if (session.on) query.set("on", session.on);
    if (session.age !== undefined) query.set("childAge", String(session.age));
    // `sessionHref` is the same encoding the board's way back already uses,
    // so one exploration has one URL however you leave it. A bare page has
    // nothing to come back to, so it adds nothing: `?back=/discovery` is
    // noise on every link on the page and tells the reader's browser history
    // something it already knows.
    const href = sessionHref(session);
    if (href !== "/discovery") query.set("back", href);
    return query.toString();
  }, [session]);
  /**
   * **Which area this page is about — the reader's, when they have said.**
   *
   * It was `dominantArea(experiences)` and nothing else: the area most of the
   * corpus is in, which is a fact about Atlas rather than about the person
   * reading. Measured on production, a reader in Vancouver was shown **"2,189
   * ideas in Okanagan"** and had the thirty-four subjects actually near them
   * suppressed as *elsewhere*, with no town in the picker closer than Osoyoos.
   *
   * A chosen town now decides it, and the corpus only answers when nobody
   * has. See `towns.ts`.
   */
  const home = useMemo(
    () => homeArea(session.at, dominantArea(experiences)),
    [session.at, experiences],
  );
  // The calendar day, derived from the server's instant so a card can say
  // "Last day" instead of printing a stated interval nobody reads.
  const todayKey = useMemo(
    () => (now ? dayOf(new Date(now)) : undefined),
    [now],
  );

  /**
   * **The chosen day, written out — and `undefined` when today was chosen.**
   *
   * Everything that said *today* has to say the chosen day instead, or the
   * page describes one day in its headings and a different one in its cards.
   * `undefined` is the signal that nothing needs to change.
   */
  const chosenDayLine = useMemo(() => {
    if (!on || on === todayKey) return undefined;
    const at = new Date(`${on}T12:00:00Z`);
    return Number.isNaN(at.getTime())
      ? undefined
      : new Intl.DateTimeFormat("en-CA", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: "UTC",
        }).format(at);
  }, [on, todayKey]);

  /**
   * **What a card may say about when it is on.**
   *
   * A card given `today` speaks relatively — "Tomorrow", "Ends tomorrow",
   * "Last day". Relative to *today*, which is the wrong anchor the moment
   * somebody picks another day: the page said "Tomorrow" on a card under a
   * heading about Sunday. Rather than teach the card a second anchor and a
   * second vocabulary, a chosen day drops the relative line and the card
   * prints the stated interval — which is true from any day.
   */
  const cardDay = chosenDayLine ? undefined : todayKey;

  /**
   * **"Further afield", one tap and never on by default.** Without a radius
   * it brings back the areas the page holds back (Metro Vancouver from
   * Vernon); with one, it adds a clearly labelled shelf of what Atlas
   * measured beyond it.
   */
  const [further, setFurther] = useState(false);

  /** The sky, where it is a forecast for the day on screen. */
  const wet = !chosenDayLine && Boolean((here ?? weather)?.wet);
  const preferences: Preferences = useMemo(
    () => ({
      ...(childAge !== undefined ? { age: childAge } : {}),
      wet,
      day: Boolean(on),
    }),
    [childAge, wet, on],
  );

  /**
   * **The hard answers — the only ones that remove anything.**
   *
   * A stated rule against this age; stated hours, a stated season or a held
   * interval that leave the chosen day out. Silence removes nothing: 90% of
   * the corpus has no age evidence and 80% no stated hours.
   */
  const answersQuestions = useCallback(
    (experience: Experience): boolean => {
      if (childAge !== undefined && excludesAge(experience, childAge))
        return false;
      if (on && (ruledOutOn(experience, on) || statedNotOn(experience)))
        return false;
      return true;
    },
    [childAge, on],
  );

  /**
   * **Where the page is looking.** With a radius, Atlas's measured `within`,
   * and nothing it could not place. Without one, everything except the areas
   * a local page holds back (see `area.ts`).
   */
  const inPlace = useCallback(
    (experience: Experience): boolean => {
      if (radiusActive) return radiusReady && measuredWithin(experience);
      return further || !elsewhere(experience, home);
    },
    [radiusActive, radiusReady, further, home],
  );

  const inContext = useCallback(
    (experience: Experience) =>
      answersQuestions(experience) && inPlace(experience),
    [answersQuestions, inPlace],
  );

  /**
   * **Search and browse, inside the answers by default.**
   *
   * Search used to read the whole province whatever the five rows said, so
   * "farm" after choosing Vernon, 15 km and a five-year-old returned farms in
   * Abbotsford. It now searches what the page is about — the same distance,
   * day and age — and says so, with one explicit way to search everywhere.
   * Browsing still widens past the default feed (Activities, every kind),
   * because that is what an explicit search is for.
   */
  const everywhereResults = useMemo(() => {
    const scoped = scopeExperiences(placedExperiences, scope);
    const pool = browsing ? scoped : defaultFeed(scoped);
    const narrowed = pool
      .filter((experience) => (kind ? experience.kind === kind : true))
      .filter((experience) => (intent ? intentOf(experience) === intent : true))
      .filter((experience) => !savedIds.has(experience.id));

    // **A picture first**, then the soft answers: a stated welcome for this
    // age, stated hours on the chosen day, shelter on a wet one.
    return byPreference(pictureFirst(narrowed), preferences);
  }, [placedExperiences, savedIds, browsing, kind, intent, scope, preferences]);
  const contextResults = useMemo(
    () => everywhereResults.filter(inContext),
    [everywhereResults, inContext],
  );
  const everywhere = Boolean(session.everywhere);
  const visible = everywhere ? everywhereResults : contextResults;

  /**
   * The pool the composed page and the situational panel both answer from —
   * scoped, feed-filtered, and with saved things removed, exactly as the
   * sections see it. One pool, so the panel cannot suggest something the page
   * below would never show.
   */
  const composedPool = useMemo(
    () =>
      defaultFeed(scopeExperiences(placedExperiences, scope)).filter(
        (experience) => !savedIds.has(experience.id),
      ),
    [placedExperiences, scope, savedIds],
  );

  const elsewhereCount = useMemo(
    () => countElsewhere(composedPool, home),
    [composedPool, home],
  );
  const elsewhereAreas = useMemo(
    () => otherAreas(composedPool, home),
    [composedPool, home],
  );

  /**
   * **The answers above, said in a line**, so search can say what it is
   * searching: "within 30 km of Vernon · on Monday · for a 5-year-old".
   */
  const contextLabel = useMemo(() => {
    const parts: string[] = [];
    if (radiusActive) parts.push(`within ${radius} km of ${originLabel}`);
    else if (!further && home && elsewhereCount > 0) parts.push(`in ${home}`);
    if (on) parts.push(on === todayKey ? "on today" : `on ${chosenDayLine}`);
    if (childAge !== undefined) parts.push(`for a ${childAge}-year-old`);
    return parts.length ? parts.join(" · ") : undefined;
  }, [
    radiusActive,
    radius,
    originLabel,
    further,
    home,
    elsewhereCount,
    on,
    todayKey,
    chosenDayLine,
    childAge,
  ]);

  /** What the five rows leave on the composed page. */
  const answering = useMemo(
    () => composedPool.filter(inContext),
    [composedPool, inContext],
  );

  /**
   * **Beyond the radius: measured, answered, and further than they said.**
   * Shown only when asked for, as its own labelled shelf, nearest first —
   * never mixed into the sections above.
   */
  const beyond = useMemo(
    () =>
      radiusReady
        ? composedPool
            .filter((e) => placedBeyond(e) && answersQuestions(e))
            .sort((a, b) => sortKm(a) - sortKm(b))
        : [],
    [radiusReady, composedPool, answersQuestions],
  );

  /**
   * **A conversation in their own words** — see `src/lib/ai/ask/`.
   *
   * The sentences live in the URL (`?ask=…&ask=…`) and are re-read on every
   * render, so the answer comes back after a refresh exactly as it was. A
   * model's reading of a sentence, where `/api/discovery/ask` had one, is
   * held beside it and used for that sentence only.
   */
  const askToday = todayKey ?? dayOf(new Date());
  /** The hour where the subjects are, from the server's instant — for the starters. */
  const hourNow = useMemo(
    () =>
      now
        ? Number(
            new Intl.DateTimeFormat("en-CA", {
              hour: "numeric",
              hourCycle: "h23",
              timeZone: ZONE,
            }).format(new Date(now)),
          )
        : undefined,
    [now],
  );
  const [modelReadings, setModelReadings] = useState<
    ReadonlyMap<string, DiscoveryAsk>
  >(() => new Map());
  const conversation = useMemo(
    () =>
      session.ask?.length
        ? readConversation(session.ask, { today: askToday }, modelReadings)
        : undefined,
    [session.ask, askToday, modelReadings],
  );
  const asked = useMemo(
    () => (conversation ? withRows(conversation.ask, session) : undefined),
    [conversation, session],
  );

  /**
   * **The rest of the page listens too.** Once somebody has said something,
   * the editorial sections under the answer draw only from what fits it — a
   * stated drive, the sky they asked for, what they said no to (see
   * `fitsConversation`) — and from the kind picked under *Refine*. A section
   * with nothing left that fits is not shown, rather than filled.
   */
  const listening = useMemo(() => {
    const byKind = (e: Experience) => !kind || e.kind === kind;
    if (!asked) return kind ? answering.filter(byKind) : answering;
    const fits = fitsConversation(asked, at ? { origin: at } : {});
    return answering.filter((e) => byKind(e) && fits(e));
  }, [answering, asked, at, kind]);

  /**
   * **A place said by name**, from the latest sentence — over everything
   * Passport holds here, not only the default feed, because naming a place is
   * the most specific thing a person can say. Inside the answers already given
   * (the distance, the day, the age) first, as the old search box did; only
   * when nothing inside them matches does it look further, and each card then
   * says it is outside what they chose. Loose (a weak name, a description
   * that mentions the words) only when the sentence was read as nothing else.
   */
  const named = useMemo(() => {
    const latestSaid = session.ask?.[session.ask.length - 1];
    if (!latestSaid) return [];
    const alone =
      modelReadings.get(latestSaid) ?? readAsk(latestSaid, { today: askToday });
    const options = { loose: readNothing(alone) };
    const all = scopeExperiences(placedExperiences, scope);
    const inside = findByName(all.filter(inContext), latestSaid, options);
    if (inside.length > 0 || !contextLabel) return inside;
    return findByName(all, latestSaid, options).map((n) => ({
      ...n,
      reason: `${n.reason} — outside ${contextLabel}`,
    }));
  }, [
    session.ask,
    modelReadings,
    askToday,
    placedExperiences,
    scope,
    inContext,
    contextLabel,
  ]);

  /**
   * **The activities, drawn from whatever the page is honestly talking about.**
   *
   * Inside the radius when there is one; near them once there is an origin;
   * the whole feed until then.
   */
  const invitePool = useMemo(
    () => (radiusActive ? listening : at ? nearYou(listening, at) : listening),
    [listening, at, radiusActive],
  );
  /** Which places Atlas's words put in each activity, in that pool. */
  const localByKey = useMemo(() => placesByActivity(invitePool), [invitePool]);
  // **Leaning with the situation** — what was said, and the sky. Ordering
  // only: an activity is offered because Atlas holds places for it here.
  const allOffers = useMemo(
    () =>
      activityOffers(
        invitePool,
        {
          day: on ?? todayKey,
          wet,
          ...(asked?.shelter ? { shelter: asked.shelter } : {}),
          child: situation.company === "child",
          pair: Boolean(asked?.pair),
          adventure: asked?.lens === "adventure",
          evening: asked?.partOfDay === "evening",
          gentle: Boolean(asked?.gentle),
          ...(asked?.avoid ? { without: asked.avoid } : {}),
        },
        localByKey,
      ),
    [invitePool, on, todayKey, wet, asked, situation.company, localByKey],
  );
  const chosenActivity = activityForDoing(doing);
  // **A chosen activity stands on its own evidence**, not on making the
  // row's cut: kayaking picked in the explorer, or skiing in October, still
  // leads the page with every place Atlas holds for it here.
  const chosen = useMemo(() => {
    if (!chosenActivity) return undefined;
    const offered = allOffers.find(
      (offer) => offer.activity.key === chosenActivity.key,
    );
    if (offered) return offered;
    const places = localByKey.get(chosenActivity.key) ?? [];
    return places.length > 0 ? { activity: chosenActivity, places } : undefined;
  }, [chosenActivity, allOffers, localByKey]);
  const offers = useMemo(() => {
    const top = allOffers.slice(0, ACTIVITY_CHIPS);
    return chosen && !top.includes(chosen) ? [...top, chosen] : top;
  }, [allOffers, chosen]);

  /**
   * **After an activity is said, its neighbours first** — kayaking leads to
   * canoeing and paddleboarding, birdwatching to wildlife watching — where
   * Atlas holds places for them here; then the row's own offers.
   */
  const alternatives = useMemo(() => {
    const said = asked?.doing;
    const near = said
      ? relatedActivities(said)
          .filter((a) => (localByKey.get(a.key)?.length ?? 0) > 0)
          .map((activity) => ({ activity }))
      : [];
    const seen = new Set<string>(said ? [said] : []);
    return [...near, ...offers]
      .filter(({ activity }) => {
        if (seen.has(activity.key)) return false;
        seen.add(activity.key);
        return true;
      })
      .slice(0, 6)
      .map(({ activity }) => ({ label: activity.label, say: activity.label }));
  }, [asked?.doing, localByKey, offers]);

  /**
   * **Every activity, behind one button** (`ActivityExplorer`). "Here" is the
   * pool the row draws from, plus what Atlas places in this area without a
   * distance — the same allowance the answer makes — so the explorer never
   * says "nothing near" about a ski hill the answer would then show.
   * Counted only while it is open.
   */
  const [exploring, setExploring] = useState(false);
  const explorer = useMemo(() => {
    if (!exploring) return [];
    const unplaced =
      at && home
        ? listening.filter(
            (e) => distanceTo(e, at) === undefined && areaOf(e) === home,
          )
        : [];
    const here =
      unplaced.length > 0 ? [...invitePool, ...unplaced] : invitePool;
    return activityExplorer(here, composedPool, {
      day: on ?? todayKey,
      ...(unplaced.length === 0 ? { hereByKey: localByKey } : {}),
    });
  }, [
    exploring,
    at,
    home,
    listening,
    invitePool,
    composedPool,
    on,
    todayKey,
    localByKey,
  ]);
  const explore = (
    <ActivityExplorerButton compact onOpen={() => setExploring(true)} />
  );
  const explorerWhere = at ? originLabel?.replace(/,\s*BC$/, "") : home;
  const explorerChosen = asked?.doing ?? chosenActivity?.key;

  // Moving between towns changes which activities exist. A selection with no
  // evidence behind it any more is dropped during render — but not while a
  // distance is still being measured, when the pool is empty for a moment
  // rather than for a reason, and not when the conversation named it: then
  // the answer says Atlas lists nowhere for it, which is the honest reply.
  if (
    doing &&
    !chosen &&
    measuring !== "measuring" &&
    conversation?.ask.doing !== chosenActivity?.key
  )
    setDoing(undefined);

  const composed = useMemo(() => {
    if (radiusActive && !radiusReady) return [];
    // The pool arrives in preference order so each section's slice keeps the
    // subjects with evidence for this day, age and sky, then each section is
    // ordered again after nearest-first so a pictured beach in the rain
    // cannot lead.
    const sections = composeDiscovery(byPreference(listening, preferences), {
      now: now ? new Date(now) : new Date(),
      ...(where ? { where } : {}),
      // The page composes around the day somebody picked, so a heading never
      // names a day other than the one the cards under it are about.
      ...(on ? { on } : {}),
    });
    const order = (items: readonly Experience[]) =>
      byPreference(nearestFirst(items, at), preferences);
    const placed = sections.map((section) => ({
      ...section,
      items: order(section.items),
    }));
    // Inside a radius every card is already near; a "Near you" shelf would
    // repeat the page.
    const near = radiusActive ? undefined : nearSection(listening, at);
    const withNear = near ? [near, ...placed] : placed;
    const withBeyond =
      further && radius !== undefined && beyond.length > 0
        ? [
            ...withNear,
            {
              id: "beyond",
              title: `Beyond ${radius} km`,
              note: `Further than ${radius} km from ${originLabel}, measured in a straight line — nearest first. Here because you asked to look further.`,
              items: beyond.slice(0, 24),
              size: 8,
              total: beyond.length,
              shape: "rest" as const,
            },
          ]
        : withNear;
    // What they just asked for leads, because they just asked for it.
    if (!chosen) return withBeyond;
    const lead = invitationSection(
      { doing: chosen.activity.label, places: chosen.places, examples: [] },
      Boolean(at),
    );
    return [{ ...lead, items: order(lead.items) }, ...withBeyond];
  }, [
    listening,
    now,
    where,
    at,
    chosen,
    on,
    preferences,
    radiusActive,
    radiusReady,
    radius,
    further,
    beyond,
    originLabel,
  ]);

  const kinds = useMemo(
    () => availableKinds(scopeExperiences(experiences, scope)),
    [experiences, scope],
  );

  // The latest exploration, for a model reading that resolves after the
  // person has already moved on.
  const latest = useRef(session);
  latest.current = session;

  /**
   * **What has been on screen in this conversation**, so "something
   * completely different" can be. Situational, like the rest: not stored.
   */
  const [shownIds, setShownIds] = useState<readonly string[]>([]);

  /** Apply a reading: a server navigation where Atlas must re-answer. */
  const applyReading = (
    from: DiscoverySession,
    reading: DiscoveryAsk,
    sentences: readonly string[],
  ) => {
    let next = applyAsk(from, reading, {
      hasOrigin: Boolean(shared),
      conversation: sentences,
    });
    // Tired of it, or said no to it: the activity row lets go too.
    const current = activityForDoing(from.doing)?.key;
    if (
      !reading.doing &&
      (reading.different ||
        (current !== undefined && reading.avoid?.includes(current)))
    )
      next = { ...next, doing: undefined };
    if (next.on !== from.on || next.age !== from.age) navigate(next);
    else change(next);
  };

  const handleAsk = (said: string) => {
    const expecting = conversation?.question?.about;
    const reading = readAsk(said, {
      today: askToday,
      ...(expecting ? { expecting } : {}),
    });
    const sentences = reading.reset
      ? [said]
      : [...(session.ask ?? []), said].slice(-8);
    if (answer)
      setShownIds((before) =>
        [
          ...new Set([...before, ...answer.picks.map((p) => p.experience.id)]),
        ].slice(-60),
      );
    // **Start over** clears what the earlier sentences set on the rows; the
    // town stays, because that is where they are, not what they asked.
    const from: DiscoverySession = reading.reset
      ? {
          ...session,
          company: undefined,
          window: undefined,
          age: undefined,
          on: undefined,
          within: undefined,
          doing: undefined,
        }
      : session;
    applyReading(from, reading, sentences);
    // **The words are the floor; a model only fills gaps** (`model.ts`).
    // Without a key the route answers with this same reading, and nothing
    // changes. With one, a gap it fills is applied to whatever the page is
    // by then — and only if this sentence is still the latest one.
    void fetch("/api/discovery/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        said,
        today: askToday,
        previous: sentences.slice(0, -1),
        ...(expecting ? { expecting } : {}),
      }),
    })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((result?: { ask?: DiscoveryAsk; by?: string }) => {
        if (result?.by !== "model" || !result.ask) return;
        const now = latest.current.ask ?? [];
        if (now[now.length - 1] !== said) return;
        setModelReadings((before) => new Map(before).set(said, result.ask!));
        applyReading(latest.current, result.ask, now);
      })
      .catch(() => {});
  };

  // What "the only llama farm in Okanagan" is counted over: the whole area,
  // saved things included, whatever radius is drawn.
  const askReference = useMemo(
    () =>
      defaultFeed(scopeExperiences(placedExperiences, scope)).filter(
        (experience) => !elsewhere(experience, home),
      ),
    [placedExperiences, scope, home],
  );

  const answer = useMemo(() => {
    if (!asked || browsing) return undefined;
    if (radiusActive && !radiusReady) return undefined;
    // "Worth the drive" looks past the circle the page is drawn in; every
    // other question answers from exactly what the rows leave.
    const pool = (
      asked.lens === "drive" ? composedPool.filter(answersQuestions) : answering
    ).filter((e) => !kind || e.kind === kind);
    return answerAsk(pool, asked, {
      named: kind ? named.filter((n) => n.experience.kind === kind) : named,
      today: askToday,
      ...(at ? { origin: at } : {}),
      ...(originLabel ? { originLabel } : {}),
      ...(home ? { home } : {}),
      wet,
      reference: askReference,
      shown: shownIds,
      seed: session.ask?.length ?? 0,
    });
  }, [
    named,
    kind,
    shownIds,
    session.ask,
    asked,
    browsing,
    radiusActive,
    radiusReady,
    composedPool,
    answersQuestions,
    answering,
    askToday,
    at,
    originLabel,
    home,
    wet,
    askReference,
  ]);

  /**
   * **Into *Go have a day*, carrying what is already decided** — the town,
   * the age, the day, and the sentence or the row's length of day. Never the
   * shared position (ADR 002).
   */
  const toDay = (ids: readonly string[]) =>
    dayHref({
      say: asked
        ? daySentence({ ...asked, said: (session.ask ?? []).join(". ") })
        : windowSentence(situation.window),
      with: ids,
      ...(session.at ? { at: session.at } : {}),
      ...(childAge !== undefined ? { age: childAge } : {}),
      ...(on ? { on } : {}),
    });
  const dayHrefFor = (experience: Experience) => toDay([experience.id]);

  // Recently saved, newest first, resolved against the already-loaded
  // catalogue rather than a second fetch — Atlas's board-items response
  // has no experience detail on it, and the full list is already here.
  /**
   * Saved ids the catalogue in memory cannot name.
   *
   * Counted rather than ignored: a sidebar that silently drops a row is the
   * same defect as a board that does, one surface along.
   */
  const unshownSaves = useMemo(() => {
    const known = new Set(experiences.map((e) => e.id));
    return visibleBoardItems.filter((item) => !known.has(item.experienceId))
      .length;
  }, [visibleBoardItems, experiences]);

  const savedItems: SavedListItem[] = useMemo(() => {
    const experienceById = new Map(experiences.map((e) => [e.id, e]));
    return visibleBoardItems
      .slice()
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
      .flatMap((item) => {
        const experience = experienceById.get(item.experienceId);
        return experience ? [{ experience, addedAt: item.addedAt }] : [];
      });
  }, [visibleBoardItems, experiences]);

  // Shared by both create and switch: point `board` at a different board,
  // persist that choice, and replace local board-item state with a fresh
  // fetch for it. Atlas-first: fetching items happens before any local
  // state changes, so a failed switch leaves the previous board's view
  // intact instead of half-updating. Claims the latest request ticket
  // (see boardRequestRef above) so a slower, earlier-started rename can't
  // resolve afterward and overwrite the board the user actually switched to.
  async function switchToBoard(target: Board) {
    const requestId = ++boardRequestRef.current;
    try {
      const items = await listBoardItems(target.id);
      if (boardRequestRef.current !== requestId) return;
      setBoard(target);
      setStoredActiveBoardId(target.id);
      setBoardItems(items);
    } catch (error) {
      console.error(`Failed to switch to board ${target.id}:`, error);
      toast.error("Couldn't switch boards. Please try again.");
    }
  }

  async function handleCreateBoard(name: string) {
    // Same invitation as saving. A board is durable user state too, so it needs
    // somebody to belong to before it can exist.
    if (!signedIn) {
      // No pending act: a board is a container, not a thing they chose.
      signInHere("A board keeps what you find");
      return;
    }

    try {
      const created = await createBoard(name);
      setBoards((prev) => [...prev, created]);
      await switchToBoard(created);
    } catch (error) {
      console.error(`Failed to create board "${name}":`, error);
      toast.error("Couldn't create that board. Please try again.");
    }
  }

  function handleSwitchBoard(boardId: string) {
    const target = boards.find((candidate) => candidate.id === boardId);
    if (!target) {
      console.error(
        `Cannot switch to board ${boardId} — not in the loaded boards list.`,
      );
      return;
    }
    switchToBoard(target);
  }

  // Claims the latest request ticket the same way switchToBoard does: the
  // rename itself (and its effect on `boards`, keyed by id and safe to
  // apply regardless) always goes through, but if the user switches to a
  // different board before this PATCH resolves, `setBoard(renamed)` is
  // skipped rather than clobbering the board they switched to.
  async function handleRenameBoard(name: string) {
    if (!board) return;
    const requestId = ++boardRequestRef.current;
    const renamed = await renameBoard(board.id, name);
    setBoards((prev) =>
      prev.map((candidate) =>
        candidate.id === renamed.id ? renamed : candidate,
      ),
    );
    if (boardRequestRef.current === requestId) {
      setBoard(renamed);
    }
  }

  function handleRequestDeleteBoard() {
    setConfirmingDeleteBoard(true);
  }

  // Atlas-first: the board only disappears from local state once Atlas
  // confirms it's actually gone. Hands off to whichever board naturally
  // comes next — switchToBoard if one remains, or a clean "no boards"
  // reset if that was the last one.
  async function handleConfirmDeleteBoard() {
    if (!board) return;
    const deletedId = board.id;
    setIsDeletingBoard(true);
    try {
      await deleteBoard(deletedId);
      const remaining = boards.filter(
        (candidate) => candidate.id !== deletedId,
      );
      setBoards(remaining);
      setConfirmingDeleteBoard(false);
      if (remaining.length > 0) {
        await switchToBoard(remaining[0]);
      } else {
        boardRequestRef.current += 1;
        setBoard(null);
        setBoardItems([]);
        clearStoredActiveBoardId();
      }
      toast.success("Board deleted.");
    } catch (error) {
      console.error(`Failed to delete board ${deletedId}:`, error);
      toast.error("Couldn't delete this board. Please try again.");
    } finally {
      setIsDeletingBoard(false);
    }
  }

  async function handleRemoveSaved(experienceId: string) {
    if (!board) return;
    try {
      await removeExperienceFromBoard(board.id, experienceId);
      setBoardItems((prev) =>
        prev.filter((item) => item.experienceId !== experienceId),
      );
    } catch (error) {
      console.error(
        `Failed to remove "${experienceId}" from board ${board.id}:`,
        error,
      );
      toast.error("Couldn't remove that experience. Please try again.");
    }
  }

  /**
   * The only thing on this page that asks for anything.
   *
   * Deliberately a toast with an action and not a redirect: the traveller is
   * mid-browse, and throwing them at a sign-in form loses the thing they were
   * looking at. `next` brings them back to it.
   */
  /** The same invitation with nothing to replay afterwards. */
  function signInHere(title: string, description?: string) {
    const back = sessionHref(session);
    toast(title, {
      description,
      action: {
        label: "Sign in",
        onClick: () => {
          window.location.href = `/auth?next=${encodeURIComponent(back)}`;
        },
      },
    });
  }

  function inviteSignIn(
    title: string,
    description: string,
    /** What they were trying to do, so it can happen on the far side. */
    pending: PendingAction,
  ) {
    // **The whole exploration goes with them.** This used to be the literal
    // string "/discovery", so signing in dropped the category, the search, the
    // situation and the thing they had just pressed — they came back to an
    // empty page and nothing had been kept.
    const back = sessionHref(session, { do: pendingParam(pending) });
    toast(title, {
      description,
      action: {
        label: "Sign in",
        onClick: () => {
          window.location.href = `/auth?next=${encodeURIComponent(back)}`;
        },
      },
    });
  }

  /**
   * "Want to do." The Thing moves into this person's October as something
   * Ahead. Idempotent on the server, so a double click is one row. A visitor
   * gets the same invitation saving gives — this is a durable act.
   */
  async function handleWant(experience: Experience) {
    if (!signedIn) {
      inviteSignIn(
        "Sign in to keep this",
        `${experience.title} will be waiting in your October.`,
        { act: "want", id: experience.id },
      );
      return;
    }
    // Still fetching. Creating a board now is how a second one appears.
    if (!boardsReady) {
      toast.error("Your boards haven't loaded yet. Please try again shortly.");
      return;
    }
    if (savingId) return;
    setSavingId(experience.id);
    try {
      // **Collected first, always.** October is a level of intention on a
      // possibility, not somewhere a possibility goes instead of the board.
      await collect(experience);
    } catch (error) {
      console.error(`Failed to collect "${experience.id}":`, error);
      toast.error(
        isSignedOut(error)
          ? "Your session ended. Sign in again to keep this."
          : "Couldn't keep that. Please try again.",
      );
      setSavingId(null);
      return;
    }
    setSavingId(null);

    if (!isOctoberKind(experience.kind)) {
      // On the board, and that is what the person asked for. My October
      // cannot hold this kind — `passport_october_things` constrains
      // `entity_kind` — so the stronger intention is the only part that
      // cannot happen, and it is the only part reported.
      toast.success(
        "Saved to your board. My October can't hold this kind yet.",
      );
      return;
    }
    try {
      await wantToDo({
        entityId: experience.id,
        entityKind: experience.kind,
        name: experience.title,
        startsAt: experience.startTime ?? null,
      });
      setWantedIds((prev) => new Set(prev).add(experience.id));
      // Both halves said, because both happened. The silent version of this
      // is what made a saved thing look like it had gone somewhere else.
      toast.success("Saved to your board, and kept for your October.");
    } catch (error) {
      toast.error(
        isSignedOut(error)
          ? "Your session ended. Sign in again to keep this."
          : "Couldn't keep that. Please try again.",
      );
    }
  }

  // Atlas-first, same pattern as DiscoverySpace's performSave: local
  // "saved" state only flips once Atlas confirms the write.
  /**
   * **Put it in the collection.** The one place anything joins a board.
   *
   * Used by *Save to board* and by *Want to do*, because a stronger intention
   * must not be a quieter one: pressing *Want to do* used to write only to
   * this person's October, so the thing they had just chosen never appeared in
   * the collection Passport had been showing them. Collecting first means a
   * change of intention can never make an item disappear.
   *
   * Already on the board is success, not a second row.
   */
  async function collect(experience: Experience): Promise<Board | null> {
    // Only when they genuinely have none. `board` can be null while the first
    // load is still in flight, and creating one then is how a second "My
    // Places" appears beside the real one.
    let target = board ?? boards[0] ?? null;
    if (!target) {
      // A person who just signed up has no board, and telling them to go and
      // make one before they may keep the thing they are looking at is a dead
      // end dressed as an instruction.
      target = await createBoard("My Places");
      setBoards((prev) => [...prev, target!]);
      setBoard(target);
      setStoredActiveBoardId(target.id);
    }
    if (savedIds.has(experience.id)) return target;
    const item = await saveExperienceToBoard(target.id, experience.id);
    setBoardItems((prev) =>
      prev.some((existing) => existing.experienceId === item.experienceId)
        ? prev
        : [...prev, item],
    );
    return target;
  }

  async function handleSave(experience: Experience) {
    // The one moment Passport asks for anything. Not a wall and not an
    // apology — the traveller found something they liked, and this says what
    // signing in would buy them.
    if (!signedIn) {
      inviteSignIn(
        "Sign in to keep this",
        `${experience.title} will be waiting on your board.`,
        { act: "save", id: experience.id },
      );
      return;
    }

    // Still fetching. The only case where "try again shortly" is true.
    if (!boardsReady) {
      toast.error("Your boards haven't loaded yet. Please try again shortly.");
      return;
    }

    if (savingId) return;
    setSavingId(experience.id);
    try {
      const target = await collect(experience);
      if (target) toast.success(`Saved to ${target.name}.`);
    } catch (error) {
      console.error(`Failed to save "${experience.id}":`, error);
      // A session that expired mid-visit is not a broken save, and telling
      // someone to "try again" when the fix is "sign in" wastes their time.
      toast.error(
        isSignedOut(error)
          ? "Your session ended. Sign in again to keep this."
          : "Couldn't save that experience. Please try again.",
      );
    } finally {
      setSavingId(null);
    }
  }

  return (
    <ThemeProvider>
      {/* **White, and the photographs are the colour.** The cream ground and
          its two radial washes are gone; the accent appears only on what is
          live or chosen. */}
      <main className="min-h-screen bg-white">
        {/* Tighter on a phone. Every pixel here sits between somebody and the
          first thing they could actually do — which was at y=909 at 375px. */}
        {/* **Near full width, not a column.** `max-w-6xl` put a 1,152px
            column in the middle of a 1920px screen with 384px of white either
            side, which is the dimension a photograph most needs and the one
            that was being given away. The cap exists so a line of body text
            never runs the whole width of a 32" display. */}
        <div className="mx-auto max-w-[1760px] px-4 py-5 sm:px-6 sm:py-10 lg:px-10">
          {/* **Five questions, and every one of them does something.**
            The hero and the row of ontology chips are gone: a chip saying
            "Organization 1,584" is Atlas's filing cabinet, not a thing anybody
            feels like doing. These are Atlas's own verbs, a real age, a real
            date, a length of day and a real distance — and where a control
            cannot narrow anything it says so rather than pretending. */}
          <FeelLikeDoing
            collapseOnPhone
            collapsed
            {...((chosenDayLine ?? today)
              ? { today: chosenDayLine ?? today! }
              : {})}
            {...(where ? { where } : {})}
            lead={
              <AskDiscovery
                {...(session.ask ? { said: session.ask } : {})}
                onAsk={handleAsk}
                onClear={() => {
                  setShownIds([]);
                  change({ ...session, ask: undefined });
                }}
                {...(answer ? { answer } : {})}
                {...(conversation?.question
                  ? { question: conversation.question }
                  : {})}
                starters={startersFor({ wet, hour: hourNow })}
                alternatives={alternatives}
                explore={explore}
                understood={
                  asked
                    ? readBack(asked, {
                        today: askToday,
                        ...(town
                          ? { townName: town.name.replace(/,\s*BC$/, "") }
                          : {}),
                      })
                    : []
                }
                {...(answer && answer.picks.length > 0
                  ? {
                      dayHref: toDay(
                        answer.picks.slice(0, 2).map((p) => p.experience.id),
                      ),
                    }
                  : {})}
                dayHrefFor={dayHrefFor}
                {...(cardDay ? { today: cardDay } : {})}
                {...(home ? { home } : {})}
                {...(at ? { origin: at } : {})}
                carry={carry}
                savedIds={savedIds}
                savingId={savingId}
                onSave={handleSave}
                originPicker={
                  <OriginPicker
                    townId={session.at}
                    onTown={setTown}
                    {...(ask && !shared
                      ? {
                          onLocate: ask,
                          locateLabel:
                            place.state === "unavailable"
                              ? "or try my location again"
                              : "or share where you are",
                        }
                      : {})}
                  />
                }
              />
            }
            rows={[
              {
                key: "activity",
                label: "Something to do",
                value: chosenActivity?.key,
                onChange: setDoing,
                // **No counts.** "Hiking 60" was how many records Atlas
                // holds, which tells nobody whether to go hiking.
                choices: offers.map((offer) => ({
                  value: offer.activity.key,
                  label: offer.activity.label,
                })),
                after: (
                  <ActivityExplorerButton onOpen={() => setExploring(true)} />
                ),
                // **A row with nothing in it says why.** Atlas states
                // affordances for 224 subjects out of 2,680, so a narrow
                // enough page genuinely has no verb to offer — and the brief's
                // rule is that a control either works or admits it cannot.
                ...(offers.length === 0
                  ? {
                      note:
                        radiusActive && !radiusReady
                          ? `Measuring from ${originLabel}…`
                          : "Nothing that fits your choices says what you can do there yet. Try another day or a bigger distance.",
                    }
                  : {}),
              },
              {
                key: "company",
                label: "Who's coming?",
                value: situation.company,
                onChange: (next) =>
                  setSituation({
                    ...situation,
                    company: next as typeof situation.company,
                  }),
                choices: [
                  { value: "alone", label: "just me" },
                  { value: "child", label: "a young child" },
                  { value: "group", label: "friends" },
                ],
                ...(situation.company === "child"
                  ? {
                      after: (
                        <>
                          {[2, 4, 5, 6, 8, 10, 13].map((age) => (
                            <button
                              key={age}
                              type="button"
                              data-testid={`child-age-${age}`}
                              aria-pressed={childAge === age}
                              onClick={() =>
                                setChildAge(childAge === age ? undefined : age)
                              }
                              style={
                                childAge === age
                                  ? {
                                      backgroundColor: "var(--ghad-accent)",
                                      color: "var(--ghad-accent-ink)",
                                    }
                                  : undefined
                              }
                              className={
                                "inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-[14px] font-semibold " +
                                (childAge === age
                                  ? ""
                                  : "text-black/55 ring-1 ring-black/15 ring-inset hover:ring-black/45")
                              }
                            >
                              age {age}
                            </button>
                          ))}
                        </>
                      ),
                      note:
                        childAge === undefined
                          ? "Pick an age and places with a stated age rule are checked against it. Without one, nothing is ruled out."
                          : `Places that state they don't admit a ${childAge}-year-old are left out, and places that welcome one come first. Most places say nothing about age — they stay, marked "no age guidance".`,
                    }
                  : {}),
              },
              {
                key: "when",
                label: "When do you want to go?",
                value: on,
                onChange: setOn,
                choices: nextDays(now ? new Date(now) : new Date()),
                note: on
                  ? "Events not on that day, and places whose stated hours or season leave it out, are left out. Places with no stated hours stay — check before you go."
                  : "Pick a day and anything stated as not on that day drops out.",
              },
              {
                key: "time",
                label: "How much time do you have?",
                value: situation.window,
                onChange: (next) =>
                  setSituation({
                    ...situation,
                    window: next as typeof situation.window,
                  }),
                choices: [
                  { value: "an-hour", label: "an hour" },
                  { value: "half-day", label: "half a day" },
                  { value: "all-day", label: "the whole day" },
                ],
                note: "We rarely know how long things take, so this sets how many ideas we suggest below — never how long any of them lasts.",
              },
              {
                key: "distance",
                label: "How far will you go?",
                value: within === undefined ? undefined : String(within),
                onChange: (next) =>
                  setWithin(next === undefined ? undefined : Number(next)),
                // **Kilometres, labelled as kilometres.** These read "15 min",
                // "30 min" and "an hour's drive" while filtering on `km <=
                // within` — so "15 min" meant 15 km, and the minutes were a
                // conversion nobody had made. Passport has no routing service,
                // so it cannot turn a distance into a drive time, and printing
                // one anyway is the fabrication this product keeps finding in
                // itself. The three tiers are unchanged; only the claim is.
                choices: [
                  {
                    value: "15",
                    label: "within 15 km",
                    ...(at ? {} : { blocked: NEEDS_ORIGIN }),
                  },
                  {
                    value: "30",
                    label: "within 30 km",
                    ...(at ? {} : { blocked: NEEDS_ORIGIN }),
                  },
                  {
                    value: "60",
                    label: "within 60 km",
                    ...(at ? {} : { blocked: NEEDS_ORIGIN }),
                  },
                ],
                after: (
                  <>
                    {/* **Always offered, and leading once a browser has said
                        no.** A person planning a Sunday in a town they are not
                        standing in cannot express that through geolocation at
                        all, and somebody who declined the permission had no
                        route to a distance whatsoever. Points come from
                        `OCTOBER_PLACES` — Wikidata-verified town centroids
                        already used for the forecast. */}
                    {/* **`aria-label`, not a visually-hidden `<span>`.** The
                        first version put the words "or measure from" in an
                        `sr-only` span, and `sr-only` is `position: absolute` —
                        which escapes this row's horizontal clipping, so at
                        375px it sat 18px past the right edge and scrolled the
                        **document** sideways. The NFR suite caught it. A
                        positioned element does not belong inside a scroller
                        when an attribute says the same thing.

                        `w-[9.5rem]` for the same family of reason: a native
                        `<select>` sizes itself from its longest option, and
                        "West Kelowna, BC" is wider than the control needs to
                        be on a phone. */}
                    <select
                      data-testid="ghad-town"
                      aria-label="Measure distances from"
                      value={session.at ?? ""}
                      onChange={(event) =>
                        setTown(event.target.value || undefined)
                      }
                      className="min-h-11 w-[9.5rem] min-w-0 rounded-full bg-white px-3 text-[14px] font-semibold text-[#111] ring-1 ring-black/15 ring-inset focus:ring-black/45 sm:w-auto"
                    >
                      {/* Grouped, because the two regions are four hours
                          apart and a flat list of thirty-two reads as one
                          place. See `towns.ts`. */}
                      <option value="">pick a town</option>
                      {TOWN_GROUPS.map((group) => (
                        <optgroup key={group.area} label={group.area}>
                          {group.towns.map((place) => (
                            <option key={place.id} value={place.id}>
                              {place.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {ask && !shared && (
                      <button
                        type="button"
                        data-testid="ghad-locate"
                        onClick={ask}
                        style={{ color: "var(--ghad-accent)" }}
                        className="inline-flex min-h-11 shrink-0 items-center px-3 text-[14px] font-semibold whitespace-nowrap underline underline-offset-4"
                      >
                        {place.state === "unavailable"
                          ? "try my location again"
                          : "share where you are"}
                      </button>
                    )}
                  </>
                ),
                note: at
                  ? radius === undefined
                    ? `Distances from ${originLabel}, in a straight line — not driving time. Pick a distance to keep it close.${drivingNote}`
                    : measuring === "measuring"
                      ? `Measuring from ${originLabel}…`
                      : measuring === "failed"
                        ? "Couldn't measure distances just now, so nothing is being left out by distance. Try again in a moment."
                        : `${answering.length} within ${radius} km of ${originLabel}, in a straight line — not driving time. Places we can't locate aren't shown as nearby.${drivingNote}`
                  : place.state === "unavailable"
                    ? place.lapse === "denied"
                      ? "Your browser would not share your location. Pick a town instead — it works just as well, and the distance is measured the same way."
                      : "Passport could not get a position from your browser. Pick a town instead, or try again."
                    : "A distance needs somewhere to measure from. Share your location, or pick the town you are setting out from.",
              },
              /* **Browse by what Atlas says a thing is** — moved here from
                 the second search box when that box was removed. Over a
                 conversation it narrows the answer; on its own it lists the
                 whole corpus of that kind, past the default feed. */
              ...(kinds.length > 1
                ? [
                    {
                      key: "kind",
                      label: "What kind of thing?",
                      value: kind ?? undefined,
                      onChange: (next: string | undefined) =>
                        setKind((next as ExperienceKind | undefined) ?? null),
                      choices: kinds.map((k) => ({
                        value: k,
                        label: kindLabel(k),
                      })),
                    },
                  ]
                : []),
            ]}
            beside={
              /* **What the answers leave, in a line beside *Refine*.** It
                 used to be its own paragraph with a "See your ideas" link,
                 because the results were a screen and a half below. They
                 now start just under it. */
              <p
                data-testid="answer-summary"
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-black/55"
              >
                {radiusActive && !radiusReady ? (
                  <span>Measuring from {originLabel}…</span>
                ) : (
                  <>
                    <span className="font-semibold text-[#111] tabular-nums">
                      {listening.length}
                      {listening.length === 1 ? " idea" : " ideas"}
                    </span>
                    {contextLabel && <span>{contextLabel}</span>}
                  </>
                )}
                {/* October keeps its door: a link out to an Experience with
                    its own route tree, now on this line rather than a row of
                    its own between the questions and the photographs. */}
                <Link
                  href="/october"
                  data-testid="october-door"
                  className="ghad-accent-text inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline"
                >
                  <Leaf className="h-3.5 w-3.5" aria-hidden />I Am October →
                </Link>
              </p>
            }
          />

          {/* Where a situation enters, rather than a search query. */}
          {/* **One answer to one question.** While a question's answer is on
              screen, the panel's own suggestions would answer the same
              situation a second time twenty pixels lower — the duplication
              `InvitationStrip` was removed for. The forecast still shapes the
              answer (sheltered first when wet). */}
          {today && !answer && (
            <div className="mt-3">
              <TodayPanel
                today={chosenDayLine ?? today}
                forecastApplies={!chosenDayLine}
                dated={false}
                // The five rows above ask who is coming, how old and how long.
                // This panel answers; it no longer asks the same three things
                // again twenty pixels lower. See `TodayPanel`.
                asking={false}
                {...((here ?? weather) ? { weather: here ?? weather } : {})}
                place={place}
                {...(childAge !== undefined ? { childAge } : {})}
                onChildAge={setChildAge}
                {...(at ? { origin: at } : {})}
                {...(intent
                  ? {
                      withinLabel:
                        INTENTS.find((i) => i.key === intent)?.label ?? intent,
                    }
                  : {})}
                {...(ask ? { ask } : {})}
                experiences={answering}
                situation={situation}
                onSituation={setSituation}
                {...(doing ? { doing } : {})}
                onDoing={(next) => {
                  setDoing(next);
                  document
                    .getElementById("discovery-results")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                carry={carry}
              />
            </div>
          )}

          {/* **No rule, no door row, no second search box** between the
              question and the photographs. The October door moved up beside
              *Refine*; the mode switcher and `InvitationStrip` went earlier
              (see git history for why). */}
          <div className="mt-6 grid grid-cols-1 gap-6 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* `min-w-0`: a grid item sizes to its content by default, so the
                shelves' `overflow-x-auto` never engaged and the **document**
                scrolled sideways by 2,440px at 1440 instead. */}
            <div
              id="discovery-results"
              className="flex min-w-0 scroll-mt-4 flex-col gap-6"
            >
              <>
                {/* **The kind they picked, said once, with the one way to
                    widen it.** This was the second search box; what it did
                    that nothing else did — browse by kind, look past the
                    answers above — lives under *Refine* and here. */}
                {browsing && (
                  <p
                    data-testid="result-summary"
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-black/55"
                  >
                    <span className="font-semibold text-[#111]">
                      {visible.length === 0
                        ? "Nothing here"
                        : `${visible.length} ${visible.length === 1 ? "result" : "results"}`}
                      {kind
                        ? ` in ${kindLabel(kind)}`
                        : intent
                          ? ` in ${INTENTS.find((i) => i.key === intent)?.label ?? intent}`
                          : ""}
                    </span>
                    {everywhere ? (
                      <>
                        <span>— everywhere, ignoring your answers above.</span>
                        {contextLabel && (
                          <button
                            type="button"
                            data-testid="search-in-context"
                            onClick={() => setEverywhere(false)}
                            className="ghad-accent-text font-semibold underline underline-offset-4"
                          >
                            Only {contextLabel}
                          </button>
                        )}
                      </>
                    ) : contextLabel ? (
                      <>
                        <span>{contextLabel}</span>
                        {everywhereResults.length > contextResults.length && (
                          <button
                            type="button"
                            data-testid="search-everywhere"
                            onClick={() => setEverywhere(true)}
                            className="ghad-accent-text font-semibold underline underline-offset-4"
                          >
                            Everywhere —{" "}
                            {everywhereResults.length - contextResults.length}{" "}
                            more
                          </button>
                        )}
                      </>
                    ) : null}
                    <button
                      type="button"
                      data-testid="browse-clear"
                      onClick={() =>
                        change({
                          ...session,
                          kind: undefined,
                          intent: undefined,
                          everywhere: undefined,
                        })
                      }
                      className="font-semibold text-black/45 underline underline-offset-4 hover:text-black/80"
                    >
                      Back to everything
                    </button>
                  </p>
                )}

                {/* **Composed when nobody has asked for anything; ranked when
                    they have.** Those are different jobs. The composed page
                    answers "what could I do?"; the flat list answers "where is
                    the thing I already have in mind?", and ranking a magazine
                    or composing a search result would do neither well. */}
                {/* **Intentional destination discovery, kept.** The page
                    leads with where you are; it does not pretend the rest of
                    the province stopped existing. Named, counted, one tap,
                    and never on by default — "I am in Vernon" and "show me
                    Vancouver" are different requests and this is the second
                    one being asked for out loud. */}
                {!browsing &&
                  (radiusActive
                    ? radiusReady && beyond.length > 0
                    : elsewhereCount > 0) && (
                    <button
                      type="button"
                      data-testid="further-afield"
                      aria-pressed={further}
                      onClick={() => setFurther(!further)}
                      style={
                        further ? { color: "var(--ghad-accent)" } : undefined
                      }
                      className="-mt-2 self-start text-[13px] font-semibold text-black/45 underline underline-offset-4 transition-colors hover:text-black/80"
                    >
                      {radiusActive
                        ? further
                          ? `Showing ${beyond.length} beyond ${radius} km, at the bottom — hide them`
                          : `Explore beyond ${radius} km — ${beyond.length} more, marked as further`
                        : further
                          ? `Showing ${elsewhereAreas.join(" and ")} too — back to ${home} only`
                          : `${elsewhereCount} more in ${elsewhereAreas.join(" and ")} — show them too`}
                    </button>
                  )}

                {!browsing && radiusActive && !radiusReady && (
                  <p data-testid="measuring" className="text-sm text-black/50">
                    Measuring from {originLabel}…
                  </p>
                )}

                {!browsing ? (
                  <DiscoverySections
                    sections={composed}
                    {...(cardDay ? { today: cardDay } : {})}
                    {...(home ? { home } : {})}
                    {...(at ? { origin: at } : {})}
                    carry={carry}
                    savedIds={savedIds}
                    savingId={savingId}
                    onSave={handleSave}
                    dayHrefFor={dayHrefFor}
                  />
                ) : visible.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-black/25 bg-white px-4 py-10 text-center text-sm text-black/60">
                    {!everywhere && everywhereResults.length > 0 ? (
                      <>
                        Nothing {contextLabel ?? "that fits your choices"}{" "}
                        matches that.{" "}
                        <button
                          type="button"
                          data-testid="search-everywhere-empty"
                          onClick={() => setEverywhere(true)}
                          className="ghad-accent-text font-semibold underline underline-offset-4"
                        >
                          Look everywhere — {everywhereResults.length} found
                        </button>
                      </>
                    ) : (
                      "Nothing of that kind fits what you have chosen. Try another kind, or loosen an answer under Refine."
                    )}
                  </div>
                ) : (
                  /* **The same cards, whatever you asked.**
                     Choosing *Get outside* used to replace eight picture-led
                     cards with twenty-four dense rows led by "Pine Park — a
                     park located at 1605 A 39A Ave featuring a playground" —
                     the exact database sludge the composed page exists to
                     replace, handed straight back the moment somebody said
                     what they felt like. Search did the same.

                     Expressing an intent should make the page *more* useful,
                     not drop it into a different product.

                     **And it must not make it less honest.** Reported by a
                     real person: choosing *Farms & markets* dropped every
                     distance from every card, because only the composed page
                     was ever handed the reader's position. Same `origin`,
                     same rule — a distance where both ends are stated, and
                     nothing at all otherwise. */
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {withoutRepeatedIllustrations(visible.slice(0, shown)).map(
                      (experience) => (
                        <PossibilityCard
                          key={experience.id}
                          experience={experience}
                          {...(cardDay ? { today: cardDay } : {})}
                          {...(home ? { home } : {})}
                          {...(at ? { origin: at } : {})}
                          carry={carry}
                          saved={savedIds.has(experience.id)}
                          saving={savingId === experience.id}
                          onSave={() => handleSave(experience)}
                          dayHref={dayHrefFor(experience)}
                        />
                      ),
                    )}
                  </ul>
                )}

                {/* **Results are paged too.** A kind chip over the whole corpus
                    is 1,587 Organizations, and rendering all of them is the
                    same 615-screen page wearing a filter. */}
                {browsing && visible.length > shown && (
                  <button
                    type="button"
                    data-testid="show-more-results"
                    onClick={() => setShown((n) => n + RESULT_PAGE)}
                    className="ghad-accent-text self-start rounded-full border border-black/30 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/10"
                  >
                    Show more ({visible.length - shown} more)
                  </button>
                )}
              </>
            </div>

            <DiscoveryListSidebar
              boards={visibleBoards}
              board={visibleBoard}
              boardsLoaded={boardsReady}
              signedIn={signedIn}
              savedItems={savedItems}
              unshownSaves={unshownSaves}
              onSwitchBoard={handleSwitchBoard}
              onCreateBoard={handleCreateBoard}
              onRenameBoard={handleRenameBoard}
              onRequestDeleteBoard={handleRequestDeleteBoard}
              onRemoveSaved={handleRemoveSaved}
              backHref={sessionHref(session)}
            />
          </div>
        </div>

        <DeleteBoardDialog
          boardName={
            confirmingDeleteBoard ? (visibleBoard?.name ?? null) : null
          }
          isDeleting={isDeletingBoard}
          onOpenChange={(open) => !open && setConfirmingDeleteBoard(false)}
          onConfirm={handleConfirmDeleteBoard}
        />

        <ActivityExplorer
          open={exploring}
          onOpenChange={setExploring}
          groups={explorer}
          {...(explorerWhere ? { where: explorerWhere } : {})}
          {...(explorerChosen ? { chosen: explorerChosen } : {})}
          narrowed={Boolean(asked || kind || radiusActive)}
          onPick={(activity: Activity) => {
            setExploring(false);
            handleAsk(activity.label);
          }}
        />
      </main>
    </ThemeProvider>
  );
}

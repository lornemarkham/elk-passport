"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ZONE } from "@/domain/experience/eventTime";
import { Leaf } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { filterExperiences } from "@/domain/discovery/filterExperiences";
import { rankByQuery } from "@/domain/discovery/searchRank";
import {
  scopeExperiences,
  scopeLabel,
  type GeographicScope,
} from "@/domain/discovery/geographicScope";
import {
  createEmptyFilterState,
  type DiscoveryFilterState,
} from "@/domain/discovery/types";
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
import { DiscoveryListFilters } from "./DiscoveryListFilters";
import {
  DiscoveryListSidebar,
  type SavedListItem,
} from "./DiscoveryListSidebar";
import { FeelLikeDoing } from "@/components/ghad/FeelLikeDoing";
import { ThemeProvider } from "@/components/ghad/theme";
import { excludesAge, ageEvidence } from "@/domain/discovery/suitability";
import { ruledOutOn } from "@/domain/discovery/recurrence";
import { TodayPanel } from "./TodayPanel";
import type { DayWeather, Situation } from "@/domain/discovery/situation";
import {
  distanceTo,
  nearSection,
  nearYou,
  nearestFirst,
} from "@/domain/discovery/proximity";
import { invitationSection, invitations } from "@/domain/discovery/directions";
import { useHere } from "@/lib/location/useHere";
import { DiscoverySections } from "./DiscoverySections";
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

/** How many results a page of search or browse shows before offering more. */
const RESULT_PAGE = 24;

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

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
  const { place, weather: here, at, ask } = useHere();

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
  const query = session.query ?? "";
  const kind = session.kind ?? null;
  const doing = session.doing;
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
  const setQuery = (next: string) => change({ ...session, query: next });
  const setKind = (next: ExperienceKind | null) =>
    change({ ...session, ...(next ? { kind: next } : { kind: undefined }) });
  const setSituation = (next: Situation) =>
    change({ ...session, company: next.company, window: next.window });
  const setDoing = (next: string | undefined) =>
    change({ ...session, doing: next });

  /**
   * **The one choice that goes back to the server.**
   *
   * Everything else on this page is mirrored with `history.replaceState`,
   * because a soft navigation per keystroke would re-run an Atlas read. An age
   * is different: Atlas has to be asked `childAge=N` to answer with a verdict,
   * so this is a real navigation and the exploration survives it because the
   * exploration is already in the URL.
   */
  const setOn = (next: string | undefined) => change({ ...session, on: next });
  const setWithin = (next: number | undefined) =>
    change({ ...session, within: next });

  const setChildAge = (next: number | undefined) => {
    const session_ = { ...session, age: next };
    setSession(session_);
    const query = sessionQuery(session_);
    router.replace(query ? `?${query}` : "/discovery", { scroll: false });
  };

  // How many search/browse results are on screen.
  const [shown, setShown] = useState(RESULT_PAGE);
  // Which Things are already in this person's October. Loaded once for a
  // signed-in person; a visitor has none and is never asked.
  const [wantedIds, setWantedIds] = useState<ReadonlySet<string>>(new Set());
  // Which way the same catalogue is being browsed. List is the default because
  // a returning traveller usually arrives with something in mind.
  const [filters, setFilters] = useState<DiscoveryFilterState>(
    createEmptyFilterState(),
  );

  // **Reset during render, not in an effect.** A new question starts at the
  // top of a short page rather than halfway down a long one — and doing that
  // in an effect renders the stale page first and corrects it a frame later,
  // which is the pattern React documents as adjusting state when a prop
  // changes, not as something to put in `useEffect`.
  const question = JSON.stringify([query, kind, intent, filters]);
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

  const availableMoods = useMemo(
    () => uniqueSorted(experiences.flatMap((e) => e.moods)),
    [experiences],
  );
  const availableActivities = useMemo(
    () => uniqueSorted(experiences.flatMap((e) => e.activities)),
    [experiences],
  );
  const availableSeasons = useMemo(
    () => uniqueSorted(experiences.flatMap((e) => e.seasons)),
    [experiences],
  );
  const availableCompanions = useMemo(
    () => uniqueSorted(experiences.flatMap((e) => e.companions)),
    [experiences],
  );

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
  const browsing = query.trim().length > 0 || kind !== null || intent !== null;
  // Where Passport is looking, said once and used by the opening, the composed
  // remainder section and nothing else.
  const where = scopeLabel(scope);
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
  // Which area this page is mostly about, counted from what Atlas states.
  // A card in a different one says so; see `dominantArea`.
  const home = useMemo(() => dominantArea(experiences), [experiences]);
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

  const visible = useMemo(() => {
    // The geographic scope is applied to the whole pool, before the feed policy
    // and before search, so browse and search obey one scope rather than three.
    // An entity Atlas has placed in no region is excluded by a region scope
    // rather than adopted by it — see `geographicScope`.
    const scoped = scopeExperiences(experiences, scope);
    const pool = browsing ? scoped : defaultFeed(scoped);
    // Matching and ordering are one decision (`rankByQuery`, M10): what the
    // query names ranks first, a description mention last, and with no query
    // the pool keeps its order. Scope, feed, filters, kind and saved-item
    // exclusion are unchanged around it.
    const narrowed = filterExperiences(pool, filters)
      .filter((experience) => (kind ? experience.kind === kind : true))
      .filter((experience) => (intent ? intentOf(experience) === intent : true))
      .filter((experience) => !savedIds.has(experience.id));

    // **With a query, relevance decides. Without one, a picture does.**
    //
    // `rankByQuery` keeps the pool's order when there is nothing to rank by,
    // which is Atlas's order — so choosing *Get outside* opened on "Pine Park
    // — a park located at 1605 A 39A Ave featuring a playground", the exact
    // card the composed page exists to stop leading with. An intent is a
    // browse, and a browse should put its best face first, exactly as every
    // composed section does.
    return query.trim().length > 0
      ? rankByQuery(narrowed, query)
      : pictureFirst(narrowed);
  }, [experiences, filters, query, savedIds, browsing, kind, intent, scope]);

  /**
   * **The composed page: what somebody sees before they ask for anything.**
   *
   * The same scoped, feed-filtered pool the list browses — framed rather than
   * poured out. Built here rather than on the server because the pool is
   * already here and composing it is cheap; what is *not* cheap, and is why
   * this exists at all, is rendering 2,248 rows, which is what this replaced.
   */
  /**
   * The pool the composed page and the situational panel both answer from —
   * scoped, feed-filtered, and with saved things removed, exactly as the
   * sections see it. One pool, so the panel cannot suggest something the page
   * below would never show.
   */
  const composedPool = useMemo(
    () =>
      defaultFeed(scopeExperiences(experiences, scope)).filter(
        (experience) => !savedIds.has(experience.id),
      ),
    [experiences, scope, savedIds],
  );

  /**
   * **What the five controls actually do.**
   *
   * Each narrowing is a direct read of something Atlas states, and each one
   * only ever narrows what Atlas has *placed*, *dated* or *spoken about*.
   * Silence never removes anything: 68% of the corpus has no coordinates and
   * 93% has no age evidence, and treating either as a reason to drop a
   * subject is the oldest mistake in this product.
   */
  const answering = useMemo(() => {
    let pool = composedPool;

    // An age Atlas was asked about. Only a stated rule removes anything —
    // `stated-other-ages` does not, which is the bug this release fixes.
    if (childAge !== undefined) {
      pool = pool.filter((experience) => !excludesAge(experience, childAge));
    }

    // A chosen day. A stated recurrence can rule a day out; nothing else can.
    if (on) {
      pool = pool.filter((experience) => !ruledOutOn(experience, on));
    }

    // A distance, against the subjects Atlas has placed.
    if (within !== undefined && at) {
      pool = pool.filter((experience) => {
        const km = distanceTo(experience, at);
        // Unplaced is not far away.
        return km === undefined || km <= within;
      });
    }

    return pool;
  }, [composedPool, childAge, on, within, at]);

  /**
   * **Composed first, then given a local lead — never filtered by location.**
   *
   * `nearSection` prepends one section of what Atlas has actually placed
   * within reach, nearest first. Everything `composeDiscovery` built stays
   * exactly where it was, because two candidates in three carry no coordinates
   * at all and demoting them would be treating "Atlas has not placed this" as
   * "this is far away". It is not evidence of anything.
   */
  /**
   * **The verbs, drawn from whatever the page is honestly talking about.**
   *
   * Near them once they have shared where they are, and the whole feed until
   * then. Built over everything, a person in Vancouver would be invited to go
   * swimming in the Okanagan — the invitation has to inherit the geographic
   * honesty rather than quietly route around it.
   */
  const invitePool = useMemo(
    () => (at ? nearYou(answering, at) : answering),
    [answering, at],
  );
  const offers = useMemo(() => invitations(invitePool), [invitePool]);

  // Moving between towns changes which verbs exist. A selection that no longer
  // has evidence behind it is dropped during render — React's own documented
  // way of adjusting state from props, rather than an effect that would paint
  // the stale answer first.
  const chosen = offers.find((offer) => offer.doing === doing);
  if (doing && !chosen) setDoing(undefined);

  const composed = useMemo(() => {
    // **Saved things leave the feed**, exactly as they do from the flat list.
    // That is this page's established contract — the board is a saved item's
    // only home, which is why the board carries its detail link — and a
    // composed page is a different presentation of the same feed, not a
    // licence to quietly change what saving does.
    const sections = composeDiscovery(answering, {
      now: now ? new Date(now) : new Date(),
      ...(where ? { where } : {}),
      // The page composes around the day somebody picked, so a heading never
      // names a day other than the one the cards under it are about.
      ...(on ? { on } : {}),
    });
    // **Every section answers to where the person is**, once they have said.
    // *Happening today* used to open with a concert in Vancouver beside a
    // park in Vernon, in whatever order the corpus arrived in.
    const placed = at
      ? sections.map((section) => ({
          ...section,
          items: nearestFirst(section.items, at),
        }))
      : sections;
    const near = nearSection(answering, at);
    const withNear = near ? [near, ...placed] : placed;
    // What they just asked for leads, because they just asked for it.
    return chosen
      ? [
          {
            ...invitationSection(chosen, Boolean(at)),
            items: nearestFirst(
              invitationSection(chosen, Boolean(at)).items,
              at,
            ),
          },
          ...withNear,
        ]
      : withNear;
  }, [answering, now, where, at, chosen, on]);

  const kinds = useMemo(
    () => availableKinds(scopeExperiences(experiences, scope)),
    [experiences, scope],
  );

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
            {...((chosenDayLine ?? today)
              ? { today: chosenDayLine ?? today! }
              : {})}
            {...(where ? { where } : {})}
            rows={[
              {
                key: "activity",
                label: "What do you feel like doing?",
                value: doing,
                onChange: setDoing,
                choices: offers.map((offer) => ({
                  value: offer.doing,
                  label: offer.doing,
                  count: offer.places.length,
                })),
                // **A row with nothing in it says why.** Atlas states
                // affordances for 224 subjects out of 2,680, so a narrow
                // enough page genuinely has no verb to offer — and the brief's
                // rule is that a control either works or admits it cannot.
                ...(offers.length === 0
                  ? {
                      note: "Atlas states what you can do at 224 subjects out of 2,680, and none of them are on this page yet. Widen the day or the distance and the verbs come back.",
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
                          ? "Tell Passport how old and it asks Atlas about that age specifically. Without one it has no verdict to repeat — there is no default."
                          : undefined,
                    }
                  : {}),
              },
              {
                key: "when",
                label: "When do you want to go?",
                value: on,
                onChange: setOn,
                choices: nextDays(now ? new Date(now) : new Date()),
                note: "Atlas states start dates, and for a handful of things the weekdays they recur on. Anything it has not dated stays, because silence is not a closure.",
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
                note: "Atlas states a duration for 17 subjects out of 2,680, so this decides how many ideas to offer — never how long any of them takes.",
              },
              {
                key: "distance",
                label: "How far will you go?",
                value: within === undefined ? undefined : String(within),
                onChange: (next) =>
                  setWithin(next === undefined ? undefined : Number(next)),
                choices: [
                  {
                    value: "15",
                    label: "15 min",
                    ...(at ? {} : { blocked: "Share where you are first" }),
                  },
                  {
                    value: "30",
                    label: "30 min",
                    ...(at ? {} : { blocked: "Share where you are first" }),
                  },
                  {
                    value: "60",
                    label: "an hour's drive",
                    ...(at ? {} : { blocked: "Share where you are first" }),
                  },
                ],
                ...(at
                  ? {
                      note: "Measured straight-line from where you are, against the 496 subjects Atlas has placed. Somewhere it has not placed is never ruled out.",
                    }
                  : ask
                    ? {
                        after: (
                          <button
                            type="button"
                            data-testid="ghad-locate"
                            onClick={ask}
                            style={{ color: "var(--ghad-accent)" }}
                            className="inline-flex min-h-11 shrink-0 items-center px-3 text-[14px] font-semibold whitespace-nowrap underline underline-offset-4"
                          >
                            share where you are
                          </button>
                        ),
                      }
                    : {}),
              },
            ]}
          />

          {/* Where a situation enters, rather than a search query. */}
          {today && (
            <div className="mt-6">
              <TodayPanel
                today={chosenDayLine ?? today}
                forecastApplies={!chosenDayLine}
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
              />
            </div>
          )}

          {/* **`InvitationStrip` used to sit here and does not any more.**
            It printed the same verbs, with the same counts, that the first of
            the five rows above now prints — *Hiking 63 · Swimming 33* twice on
            one screen, forty pixels apart, one of them labelled "Things you
            could do" and the other "What do you feel like doing?". Two
            controls for one question is the filter dashboard this brief rules
            out. The component is untouched and still used by the labs. */}

          <div
            aria-hidden
            className="my-5 border-t border-dashed border-black/25 sm:my-8"
          />

          {/* **The mode switcher is gone, and with it a duplicate label.**
            Passport now has a real bar, and its second item says *Discover* —
            so a tab underneath it also saying *Discover* asked somebody to
            work out which of the two identically-named things they were in.

            Its only peer was *Inspiration*, which the doctrine fences off
            from implementation (§13) and the brief fences off from being
            advertised. Offering it as a tab promises a product that does not
            exist yet. The experimental feed and its shelves are untouched in
            the codebase — `InspirationFeed.tsx`, `inspirationShelves.ts` —
            because that is real work worth keeping. It is simply not on the
            nav.

            October keeps its door. It is a link out to an Experience with its
            own route tree, not a way of looking at this page. */}
          <div className="flex items-center justify-end border-b border-black/10 pb-2">
            <Link
              href="/october"
              data-testid="october-door"
              className="ghad-accent-text inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-black/25 px-4 text-sm font-medium transition-colors hover:border-black/55 hover:bg-black/10"
            >
              <Leaf className="h-4 w-4" aria-hidden />I Am October
              <span className="text-black/50">→</span>
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* `min-w-0`: a grid item sizes to its content by default, so the
                shelves' `overflow-x-auto` never engaged and the **document**
                scrolled sideways by 2,440px at 1440 instead. */}
            <div className="flex min-w-0 flex-col gap-6">
              <>
                <DiscoveryListFilters
                  query={query}
                  onQueryChange={setQuery}
                  filters={filters}
                  onFiltersChange={setFilters}
                  availableMoods={availableMoods}
                  availableActivities={availableActivities}
                  availableSeasons={availableSeasons}
                  availableCompanions={availableCompanions}
                  resultCount={visible.length}
                  {...(intent
                    ? {
                        within:
                          INTENTS.find((i) => i.key === intent)?.label ??
                          intent,
                      }
                    : {})}
                  kinds={kinds}
                  selectedKind={kind}
                  onKindChange={setKind}
                  browsing={browsing}
                />

                {/* **Composed when nobody has asked for anything; ranked when
                    they have.** Those are different jobs. The composed page
                    answers "what could I do?"; the flat list answers "where is
                    the thing I already have in mind?", and ranking a magazine
                    or composing a search result would do neither well. */}
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
                  />
                ) : visible.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-black/25 bg-white px-4 py-10 text-center text-sm text-black/60">
                    Nothing here matches that. Try fewer words, or clear what
                    you have chosen.
                  </p>
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
                    {visible.slice(0, shown).map((experience) => (
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
                      />
                    ))}
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
      </main>
    </ThemeProvider>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { DiscoveryOpening } from "./DiscoveryOpening";
import { TodayPanel } from "./TodayPanel";
import {
  EMPTY_SITUATION,
  type DayWeather,
  type Situation,
} from "@/domain/discovery/situation";
import { nearSection } from "@/domain/discovery/proximity";
import { useHere } from "@/lib/location/useHere";
import { DiscoverySections } from "./DiscoverySections";
import { PossibilityCard } from "./PossibilityCard";
import {
  composeDiscovery,
  dayOf,
  dominantArea,
  pictureFirst,
} from "@/domain/discovery/compose";
import {
  INTENTS,
  availableIntents,
  intentOf,
  type IntentKey,
} from "@/domain/discovery/intents";

/** The intents a `?intent=` may name. Anything else is ignored, not guessed. */
const INTENT_KEYS: readonly IntentKey[] = INTENTS.map((i) => i.key);
import { availableKinds, defaultFeed } from "@/domain/discovery/defaultFeed";
import type { ExperienceKind } from "@/domain/experience/types";

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
  const [kind, setKind] = useState<ExperienceKind | null>(null);
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

  const [query, setQuery] = useState("");
  // The day a person actually has. Situational and deliberately not persisted
  // — see `situation.ts`. Nothing here becomes a profile.
  const [situation, setSituation] = useState<Situation>(EMPTY_SITUATION);

  // **Where the reader is, owned here because two things now answer to it:**
  // the forecast the panel states, and which possibilities the page can say
  // are within reach. Held for the visit, written nowhere — see `useHere`.
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
  const search = useSearchParams();
  const asked = search.get("intent");
  const intent = INTENT_KEYS.find((k) => k === asked) ?? null;
  const setIntent = (next: IntentKey | null) => {
    const params = new URLSearchParams(search.toString());
    if (next) params.set("intent", next);
    else params.delete("intent");
    const query = params.toString();
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
        const items = await listBoardItems(resolved.id);
        if (cancelled) return;
        setBoard(resolved);
        setStoredActiveBoardId(resolved.id);
        setBoardItems(items);
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
  // Which area this page is mostly about, counted from what Atlas states.
  // A card in a different one says so; see `dominantArea`.
  const home = useMemo(() => dominantArea(experiences), [experiences]);
  // The calendar day, derived from the server's instant so a card can say
  // "Last day" instead of printing a stated interval nobody reads.
  const todayKey = useMemo(
    () => (now ? dayOf(new Date(now)) : undefined),
    [now],
  );

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
   * **Composed first, then given a local lead — never filtered by location.**
   *
   * `nearSection` prepends one section of what Atlas has actually placed
   * within reach, nearest first. Everything `composeDiscovery` built stays
   * exactly where it was, because two candidates in three carry no coordinates
   * at all and demoting them would be treating "Atlas has not placed this" as
   * "this is far away". It is not evidence of anything.
   */
  const composed = useMemo(() => {
    // **Saved things leave the feed**, exactly as they do from the flat list.
    // That is this page's established contract — the board is a saved item's
    // only home, which is why the board carries its detail link — and a
    // composed page is a different presentation of the same feed, not a
    // licence to quietly change what saving does.
    const sections = composeDiscovery(composedPool, {
      now: now ? new Date(now) : new Date(),
      ...(where ? { where } : {}),
    });
    const near = nearSection(composedPool, at);
    return near ? [near, ...sections] : sections;
  }, [composedPool, now, where, at]);

  /** Which intents this pool can actually fill. A dead chip is worse than none. */
  const intents = useMemo(
    () => availableIntents(defaultFeed(scopeExperiences(experiences, scope))),
    [experiences, scope],
  );

  const kinds = useMemo(
    () => availableKinds(scopeExperiences(experiences, scope)),
    [experiences, scope],
  );

  // Recently saved, newest first, resolved against the already-loaded
  // catalogue rather than a second fetch — Atlas's board-items response
  // has no experience detail on it, and the full list is already here.
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
      inviteSignIn("A board keeps what you find");
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
  function inviteSignIn(title: string, description?: string) {
    toast(title, {
      description,
      action: {
        label: "Sign in",
        onClick: () => {
          window.location.href = `/auth?next=${encodeURIComponent("/discovery")}`;
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
      );
      return;
    }
    if (!isOctoberKind(experience.kind)) {
      // My October cannot store this kind yet — `passport_october_things`
      // constrains `entity_kind`, and Atlas now publishes `Experience`.
      // Saying so beats a control that fails at the database.
      toast.error("That can't be kept in your October yet.");
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
      toast.success("Kept for your October.");
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
  async function handleSave(experience: Experience) {
    // The one moment Passport asks for anything. Not a wall and not an
    // apology — the traveller found something they liked, and this says what
    // signing in would buy them.
    if (!signedIn) {
      inviteSignIn(
        "Sign in to keep this",
        `${experience.title} will be waiting on your board.`,
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
      // A person who just signed up has no board, and telling them to go and
      // make one before they may keep the thing they are looking at is a
      // dead end dressed as an instruction — the previous version said their
      // boards had not loaded, which was both wrong and unfixable by waiting.
      // `SaveButton` on a detail page already creates a first board on first
      // save; this is the same behaviour, not a new one.
      let target = board;
      if (!target) {
        target = await createBoard("My Places");
        setBoards((prev) => [...prev, target!]);
        setBoard(target);
        setStoredActiveBoardId(target.id);
      }

      const item = await saveExperienceToBoard(target.id, experience.id);
      setBoardItems((prev) => [...prev, item]);
      toast.success(`Saved to ${target.name}.`);
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
    <main
      className="min-h-screen bg-[#ecdfc4]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 12% 8%, rgba(181,101,29,0.10), transparent 45%), radial-gradient(circle at 88% 92%, rgba(120,72,26,0.08), transparent 50%)",
      }}
    >
      {/* Tighter on a phone. Every pixel here sits between somebody and the
          first thing they could actually do — which was at y=909 at 375px. */}
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-14">
        <DiscoveryOpening
          today={today ?? ""}
          {...(where ? { where } : {})}
          intents={intents}
          selected={intent}
          onSelect={setIntent}
        />

        {/* Where a situation enters, rather than a search query. */}
        {today && (
          <div className="mt-6">
            <TodayPanel
              today={today}
              {...((here ?? weather) ? { weather: here ?? weather } : {})}
              place={place}
              {...(ask ? { ask } : {})}
              experiences={composedPool}
              situation={situation}
              onSituation={setSituation}
            />
          </div>
        )}

        <div
          aria-hidden
          className="my-5 border-t border-dashed border-[#8a5a24]/25 sm:my-8"
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
        <div className="flex items-center justify-end border-b border-[#2b2015]/10 pb-2">
          <Link
            href="/october"
            data-testid="october-door"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-[#8a5a24]/25 px-4 text-sm font-medium text-[#8a5a24] transition-colors hover:border-[#8a5a24]/55 hover:bg-[#8a5a24]/10"
          >
            <Leaf className="h-4 w-4" aria-hidden />I Am October
            <span className="text-[#8a5a24]/50">→</span>
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 sm:mt-8 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-6">
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
                  {...(todayKey ? { today: todayKey } : {})}
                  {...(home ? { home } : {})}
                  {...(at ? { origin: at } : {})}
                  savedIds={savedIds}
                  savingId={savingId}
                  onSave={handleSave}
                  wantedIds={wantedIds}
                  onWant={handleWant}
                />
              ) : visible.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#8a5a24]/25 bg-[#f7ecd3]/30 px-4 py-10 text-center text-sm text-[#2b2015]/60">
                  Nothing here matches that. Try fewer words, or clear what you
                  have chosen.
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
                     not drop it into a different product. */
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.slice(0, shown).map((experience) => (
                    <PossibilityCard
                      key={experience.id}
                      experience={experience}
                      {...(todayKey ? { today: todayKey } : {})}
                      {...(home ? { home } : {})}
                      saved={savedIds.has(experience.id)}
                      saving={savingId === experience.id}
                      wanted={wantedIds.has(experience.id)}
                      onWant={() => handleWant(experience)}
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
                  className="self-start rounded-full border border-[#8a5a24]/30 px-4 py-2.5 text-sm font-medium text-[#8a5a24] transition-colors hover:bg-[#8a5a24]/10"
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
            onSwitchBoard={handleSwitchBoard}
            onCreateBoard={handleCreateBoard}
            onRenameBoard={handleRenameBoard}
            onRequestDeleteBoard={handleRequestDeleteBoard}
            onRemoveSaved={handleRemoveSaved}
          />
        </div>
      </div>

      <DeleteBoardDialog
        boardName={confirmingDeleteBoard ? (visibleBoard?.name ?? null) : null}
        isDeleting={isDeletingBoard}
        onOpenChange={(open) => !open && setConfirmingDeleteBoard(false)}
        onConfirm={handleConfirmDeleteBoard}
      />
    </main>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { filterExperiences } from "@/domain/discovery/filterExperiences";
import { matchesQuery } from "@/domain/discovery/selectors";
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
import { AccountControl } from "@/components/auth/AccountControl";
import { DeleteBoardDialog } from "./DeleteBoardDialog";
import { DiscoveryListFilters } from "./DiscoveryListFilters";
import {
  DiscoveryListSidebar,
  type SavedListItem,
} from "./DiscoveryListSidebar";
import {
  DiscoveryModeSwitcher,
  type DiscoveryMode,
} from "./DiscoveryModeSwitcher";
import { InspirationFeed } from "./InspirationFeed";
import { ExperienceListRow } from "./ExperienceListRow";
import { availableKinds, defaultFeed } from "@/domain/discovery/defaultFeed";
import type { ExperienceKind } from "@/domain/experience/types";

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
  // Which way the same catalogue is being browsed. List is the default because
  // a returning traveller usually arrives with something in mind.
  const [mode, setMode] = useState<DiscoveryMode>("List");
  const [filters, setFilters] = useState<DiscoveryFilterState>(
    createEmptyFilterState(),
  );

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
        const allBoards = await listBoards();
        if (cancelled) return;
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
  const browsing = query.trim().length > 0 || kind !== null;

  const visible = useMemo(() => {
    // The geographic scope is applied to the whole pool, before the feed policy
    // and before search, so browse and search obey one scope rather than three.
    // An entity Atlas has placed in no region is excluded by a region scope
    // rather than adopted by it — see `geographicScope`.
    const scoped = scopeExperiences(experiences, scope);
    const pool = browsing ? scoped : defaultFeed(scoped);
    return filterExperiences(pool, filters)
      .filter((experience) => (kind ? experience.kind === kind : true))
      .filter((experience) => matchesQuery(experience, query))
      .filter((experience) => !savedIds.has(experience.id));
  }, [experiences, filters, query, savedIds, browsing, kind, scope]);

  /**
   * What the Inspiration feed browses.
   *
   * The same geographic scope the list obeys, and the same feed policy — so a
   * card cannot appear here that the list would have excluded. It deliberately
   * ignores the search box and kind chips: those belong to *finding*, and this
   * mode is *browsing*. Saved items stay visible, because a shelf that
   * rearranged itself as you saved from it would lose your place.
   */
  const inspirationPool = useMemo(
    () => defaultFeed(scopeExperiences(experiences, scope)),
    [experiences, scope],
  );

  const kinds = useMemo(
    () => availableKinds(scopeExperiences(experiences, scope)),
    [experiences, scope],
  );
  const where = scopeLabel(scope);

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

    if (!board) {
      toast.error("Your boards haven't loaded yet. Please try again shortly.");
      return;
    }
    if (savingId) return;
    setSavingId(experience.id);
    try {
      const item = await saveExperienceToBoard(board.id, experience.id);
      setBoardItems((prev) => [...prev, item]);
      toast.success(`Saved to ${board.name}.`);
    } catch (error) {
      console.error(
        `Failed to save "${experience.id}" to board ${board.id}:`,
        error,
      );
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
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-14">
        <header className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1" />
            <AccountControl displayName={displayName} returnTo="/discovery" />
          </div>
          {/* Where these results come from. Not a control yet — there is one
              scope and nothing to switch to — but a traveller should never have
              to guess which area they are looking at, and it is the difference
              between "the whole corpus" and "the Okanagan". */}
          {where && (
            <p
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#8a5a24]"
              data-testid="active-scope"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {where}
            </p>
          )}
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-[#2b2015] sm:text-5xl">
            Discovery
          </h1>
          <p className="max-w-xl text-[#2b2015]/60">
            Search, filter, and save the experiences you want to build your next
            adventure around.
          </p>
        </header>

        <div
          aria-hidden
          className="my-8 border-t border-dashed border-[#8a5a24]/25"
        />

        <DiscoveryModeSwitcher mode={mode} onModeChange={setMode} />

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-6">
            {mode === "Inspiration" ? (
              // The same scoped pool the list browses, framed rather than
              // filtered. `scoped` and not `visible`: the feed is a browse, so
              // the search box and kind chips do not apply to it.
              <InspirationFeed
                experiences={inspirationPool}
                savedIds={savedIds}
                onSave={handleSave}
              />
            ) : (
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

                {visible.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#8a5a24]/25 bg-[#f7ecd3]/30 px-4 py-10 text-center text-sm text-[#2b2015]/60">
                    No experiences match your search.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {visible.map((experience) => (
                      <ExperienceListRow
                        key={experience.id}
                        experience={experience}
                        saved={savedIds.has(experience.id)}
                        saving={savingId === experience.id}
                        onSave={() => handleSave(experience)}
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
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

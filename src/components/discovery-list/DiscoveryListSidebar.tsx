import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Experience } from "@/domain/experience/types";
import { destinationFor } from "@/domain/experience/destination";
import type { Board } from "@/lib/data/boards-repo";
import { BoardSwitcher } from "./BoardSwitcher";
import { BoardTitle } from "./BoardTitle";

export interface SavedListItem {
  experience: Experience;
  addedAt: string;
}

interface DiscoveryListSidebarProps {
  boards: Board[];
  board: Board | null;
  boardsLoaded: boolean;
  /**
   * Whether there is anyone for a board to belong to.
   *
   * A visitor is not "a signed-in person who has not made a board yet", and
   * telling them to "create one above" invites a click that 401s. They get an
   * invitation instead — which is also the only place this page asks for
   * anything.
   */
  signedIn?: boolean;
  savedItems: SavedListItem[];
  onSwitchBoard: (boardId: string) => void;
  onCreateBoard: (name: string) => void;
  onRenameBoard: (name: string) => void | Promise<void>;
  onRequestDeleteBoard: () => void;
  onRemoveSaved: (experienceId: string) => void;
  /**
   * The exploration to come back to.
   *
   * Reviewing a board used to be a one-way trip: the board's *Continue
   * discovering* went to a bare `/discovery`, so the category, the search and
   * the situation somebody had built up were gone by the time they returned.
   */
  backHref?: string;
  /**
   * Saved items this list could not name.
   *
   * Shown as a line rather than dropped. "6 experiences saved" over a list of
   * five is the shape of the bug this whole repair is about.
   */
  unshownSaves?: number;
}

/** The same things the immersive Mood Board sidebar already surfaces —
 * active board, switch/create/rename/delete, saved items, Start
 * Passport — reused as a workflow (activeBoardStorage + boards-repo),
 * not as MoodBoard.tsx's exact JSX: that component is tightly coupled to
 * the immersive field's dark theme, FieldExperience type, and
 * shelved/rejected concepts List mode has no use for, and reusing it
 * verbatim here would fight the Passport visual language this page is
 * built around.
 *
 * Renders every saved item, newest first — no cap. A cap here would
 * make the "N experiences saved" count above disagree with what's
 * actually visible, and since Bug 3's shopping-cart model made this
 * list a saved item's *only* home (it's no longer also shown in the
 * main list), a capped view would make items past the cap functionally
 * invisible, not just deprioritized. */
export function DiscoveryListSidebar({
  boards,
  board,
  boardsLoaded,
  signedIn = true,
  savedItems,
  onSwitchBoard,
  onCreateBoard,
  onRenameBoard,
  onRequestDeleteBoard,
  onRemoveSaved,
  backHref,
  unshownSaves = 0,
}: DiscoveryListSidebarProps) {
  if (!boardsLoaded) {
    return (
      <aside
        aria-label="Board"
        className="rounded-2xl border border-[#8a5a24]/20 bg-[#f7ecd3]/40 p-5"
      >
        <p className="text-sm text-[#2b2015]/50">Loading your board…</p>
      </aside>
    );
  }

  // **An empty board is a line, not a panel.**
  //
  // The sidebar is a 320px column that held a titled card, a switcher, a
  // delete control and a count of zero before anybody had collected anything
  // — a filing cabinet shown to somebody who has not yet picked a single
  // thing up. Until there is something in it, it says what it is for and gets
  // out of the way. Everything below returns the moment one thing is saved.
  const empty = savedItems.length === 0 && unshownSaves === 0;

  if (empty) {
    return (
      <aside
        aria-label="Board"
        data-testid="board-empty"
        className="self-start rounded-2xl border border-dashed border-[#8a5a24]/25 bg-[#f7ecd3]/30 p-4"
      >
        <p className="font-heading text-base text-[#2b2015]/70">
          {signedIn ? "Your board is empty" : "Keep what you find"}
        </p>
        <p className="mt-1 text-sm text-[#2b2015]/55">
          {signedIn
            ? "Save anything above and it collects here — the start of a day worth having."
            : "Sign in and what you save stays here, on any device. Browsing needs no account."}
        </p>
        {signedIn && (
          <div className="mt-3">
            <BoardSwitcher
              boards={boards}
              activeBoardId={board?.id}
              onSwitchBoard={onSwitchBoard}
              onCreateBoard={onCreateBoard}
            />
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside
      aria-label="Board"
      className="flex flex-col gap-4 rounded-2xl border border-[#8a5a24]/20 bg-[#f7ecd3]/40 p-5"
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium tracking-[0.14em] text-[#8a5a24] uppercase">
            Your Board
          </p>
          {/* The full `boards` array, unfiltered — `boards[]` is the one
           * source of truth for what shows here. This used to pass a
           * derived subset with the active board filtered out, so the
           * dropdown never showed the active board under any name, and
           * BoardSwitcher's active-board highlight (board.id ===
           * activeBoardId) was dead code — there was no longer a matching
           * row for it to ever hit. Passing the real array removes that
           * second, derived view entirely instead of trying to keep it in
           * sync with the first. */}
          <BoardSwitcher
            boards={boards}
            activeBoardId={board?.id}
            onSwitchBoard={onSwitchBoard}
            onCreateBoard={onCreateBoard}
          />
        </div>

        {board ? (
          <div className="mt-1 flex items-center justify-between gap-2">
            <BoardTitle name={board.name} onRename={onRenameBoard} />
            <button
              type="button"
              onClick={onRequestDeleteBoard}
              aria-label="Delete board"
              className="shrink-0 rounded-full p-1 text-[#2b2015]/30 transition-colors hover:bg-red-600/10 hover:text-red-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : signedIn ? (
          <p className="font-heading mt-1 text-xl text-[#2b2015]/40">
            No board yet — create one above
          </p>
        ) : (
          <div className="mt-1">
            <p className="font-heading text-xl text-[#2b2015]/60">
              Keep what you find
            </p>
            <p className="mt-1 text-sm text-[#2b2015]/55">
              Sign in and the places you save stay here, on any device. Browsing
              needs no account.
            </p>
          </div>
        )}

        {board && (
          <>
            {/* **The count counts what is listed below it.** It used to count
                only the rows this list could name, over a list of the same
                rows — so it was always self-consistent and sometimes wrong
                about the board. Anything it cannot name now gets its own
                line rather than quietly lowering the number. */}
            <p className="mt-1 text-sm text-[#2b2015]/60">
              {savedItems.length + unshownSaves}{" "}
              {savedItems.length + unshownSaves === 1
                ? "experience"
                : "experiences"}{" "}
              saved
            </p>
            {unshownSaves > 0 && (
              <p
                data-testid="unshown-saves"
                className="mt-0.5 text-xs text-[#2b2015]/45"
              >
                {unshownSaves} of them {unshownSaves === 1 ? "is" : "are"} on
                your board but can&apos;t be shown here right now.
              </p>
            )}
          </>
        )}
      </div>

      {savedItems.length > 0 && (
        <ul className="flex max-h-96 flex-col gap-1.5 overflow-y-auto border-t border-[#8a5a24]/15 pt-3">
          {savedItems.map(({ experience }) => {
            // The same `destinationFor` the cards use — not a second routing
            // rule. Saving an experience removes its card from the list, and
            // the card carried the only link to its detail page, so without
            // this a saved Place was unreachable from Discover while its page
            // worked perfectly. An experience with nowhere truthful to go
            // stays plain text, exactly as its card would.
            const destination = destinationFor(experience);
            const label = (
              <p className="min-w-0 flex-1 truncate text-xs text-[#2b2015]/75">
                {experience.title}
              </p>
            );
            return (
              <li
                key={experience.id}
                className="group flex items-center gap-2 rounded-lg px-1.5 py-1"
              >
                {destination ? (
                  <Link
                    href={destination}
                    // Resting appearance is unchanged — the underline is the
                    // only affordance, and text-decoration reaches the <p>
                    // where a colour utility on the anchor would not.
                    className="flex min-w-0 flex-1 hover:underline"
                  >
                    {label}
                  </Link>
                ) : (
                  label
                )}
                <button
                  type="button"
                  onClick={() => onRemoveSaved(experience.id)}
                  aria-label={`Remove ${experience.title} from board`}
                  className="shrink-0 rounded-full p-0.5 text-[#2b2015]/0 transition-colors group-hover:text-[#2b2015]/35 group-hover:hover:text-red-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* "Start Passport" sent this board's id to `/passport/{id}`, which
       * takes an **entity** id and 404s on anything else — it has never
       * worked, in this or either of the two other places it appeared.
       * `loadBoardWithExperiences` records the original contract ("shared by
       * /boards/:id and /passport/:id"): that route once took a board id and
       * was later repurposed into the single-entity Passport page, leaving
       * the buttons pointing at a contract that no longer exists.
       *
       * There is no board-level Passport in the codebase — `buildPassportPage`
       * takes one entity and the passport layer knows nothing about boards —
       * so the button now says what the destination actually does. Composing a
       * Passport from a whole board is real product work, recorded as debt in
       * docs/product/discover.md rather than invented here. */}
      {board && savedItems.length > 0 && (
        <Button
          nativeButton={false}
          render={
            <Link
              href={
                backHref
                  ? `/saved?back=${encodeURIComponent(backHref)}`
                  : "/saved"
              }
            />
          }
        >
          {/* **"Review board" asked somebody to know what a board was** before
              they could look at four things they had just saved — and the
              route behind it went Discovery → My Places → Back to Boards →
              Your Boards → My Places → Continue discovering. `/saved` is the
              same storage, one screen, and one way back. `/boards/:id` is
              untouched for anybody who deliberately goes there to share. */}
          Review saved
        </Button>
      )}
    </aside>
  );
}

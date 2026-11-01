"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Gift, X } from "lucide-react";
import { useStoredList } from "./stored";
import {
  createBoard,
  isSignedOut,
  listBoardItems,
  listBoards,
  removeExperienceFromBoard,
  saveExperienceToBoard,
} from "@/lib/data/boards-repo";
import {
  getStoredActiveBoardId,
  setStoredActiveBoardId,
} from "@/lib/data/activeBoardStorage";

/**
 * **Two things a Christmas card can do, and they are different.**
 *
 * - **Save** puts it on the person's Saved — the one collection Passport has
 *   (Atlas board, `boards-repo`), resolved exactly as `SaveButton` and
 *   Discovery resolve it. Christmas keeps no list of its own.
 * - **Pick for a plan** is a selection for the next step, like ticking cards
 *   on Saved's _Plan with these_. It lives in this tab only and leaves as
 *   `?with=` on the way into the planner.
 */

interface PicksValue {
  readonly picked: readonly string[];
  readonly togglePick: (id: string) => void;
  readonly clearPicks: () => void;
  readonly saved: ReadonlySet<string>;
  readonly saving: ReadonlySet<string>;
  readonly toggleSave: (id: string) => Promise<void>;
}

const Ctx = createContext<PicksValue | null>(null);
const PICKS_KEY = "passport.christmas.picks";

export function usePicks(): PicksValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("usePicks outside <PicksProvider>");
  return value;
}

export function PicksProvider({
  children,
  planHref,
}: {
  readonly children: React.ReactNode;
  /** The planner, with whatever the page already knows (`at`, dates…). */
  readonly planHref: string;
}) {
  const [picked, setPicked] = useStoredList(PICKS_KEY, "session");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const boards = await listBoards();
        const stored = getStoredActiveBoardId();
        const board =
          (stored && boards.find((b) => b.id === stored)) || boards[0];
        if (!board || cancelled) return;
        const items = await listBoardItems(board.id);
        if (cancelled) return;
        setBoardId(board.id);
        setSaved(new Set(items.map((i) => i.experienceId)));
      } catch (error) {
        if (!isSignedOut(error))
          console.error("Christmas: couldn't read Saved", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePick = useCallback(
    (id: string) =>
      setPicked(
        picked.includes(id)
          ? picked.filter((x) => x !== id)
          : [...picked, id].slice(-12),
      ),
    [picked, setPicked],
  );

  const toggleSave = useCallback(
    async (id: string) => {
      setSaving((s) => new Set(s).add(id));
      try {
        let target = boardId;
        if (!target) {
          const created = await createBoard("My Places");
          target = created.id;
          setBoardId(created.id);
          setStoredActiveBoardId(created.id);
        }
        if (saved.has(id)) {
          await removeExperienceFromBoard(target, id);
          setSaved((s) => {
            const n = new Set(s);
            n.delete(id);
            return n;
          });
        } else {
          await saveExperienceToBoard(target, id);
          setSaved((s) => new Set(s).add(id));
          toast.success("Saved — it's waiting on your Saved page.");
        }
      } catch (error) {
        if (isSignedOut(error)) {
          toast("Sign in to keep this", {
            description: "Your saved places wait for you on any device.",
            action: {
              label: "Sign in",
              onClick: () => {
                window.location.href = `/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
              },
            },
          });
        } else {
          toast.error("Couldn't update Saved. Please try again.");
        }
      } finally {
        setSaving((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      }
    },
    [boardId, saved],
  );

  const value = useMemo(
    () => ({
      picked,
      togglePick,
      clearPicks: () => setPicked([]),
      saved,
      saving,
      toggleSave,
    }),
    [picked, setPicked, togglePick, saved, saving, toggleSave],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <PickTray planHref={planHref} />
    </Ctx.Provider>
  );
}

function PickTray({ planHref }: { readonly planHref: string }) {
  const { picked, clearPicks } = usePicks();
  if (picked.length === 0) return null;
  const href = `${planHref}${planHref.includes("?") ? "&" : "?"}with=${picked.join(",")}`;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      data-testid="pick-tray"
    >
      <div className="mx-auto flex max-w-xl items-center gap-2 rounded-full bg-[#0f3b2b] p-2 pl-5 text-white shadow-2xl">
        <Gift className="h-5 w-5 shrink-0 text-[#ffd98a]" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-base font-semibold">
          {picked.length} picked for a plan
        </p>
        <button
          type="button"
          onClick={clearPicks}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10"
          aria-label="Clear picks"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <Link
          href={href}
          data-testid="plan-picks"
          className="inline-flex min-h-11 items-center rounded-full bg-[#ffd98a] px-5 text-base font-bold text-[#082319] hover:brightness-105"
        >
          Plan these
        </Link>
      </div>
    </div>
  );
}

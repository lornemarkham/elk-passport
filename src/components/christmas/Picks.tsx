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
import { rememberName, type AddedName } from "./names";
import { clearStash, useStash } from "./lights/stash";
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
 * **One Save on a Christmas card, over two stores that already existed.**
 *
 * - The **board** is the person's Saved — the one collection Passport has
 *   (Atlas board, `boards-repo`), resolved exactly as `SaveButton` and
 *   Discovery resolve it. Christmas keeps no list of its own.
 * - The **pick** is a selection for the next step, like ticking cards on
 *   Saved's _Plan with these_. It lives on this device only (never sent
 *   anywhere until it is made into a plan) and leaves as `?with=` on the way
 *   into the planner.
 *
 * Card buttons used to offer them separately (Save, Add to My Christmas
 * List). `toggleKeep` is the one Save: it writes both, a thing counts as
 * saved if _either_ holds it (so nothing saved or added before is lost), and
 * removing takes it out of both. Signed out, it is kept on this device and
 * says so. `toggleSave` and `togglePick` remain for the list page.
 */

interface PicksValue {
  readonly picked: readonly string[];
  readonly togglePick: (id: string, name?: AddedName) => void;
  readonly clearPicks: () => void;
  readonly saved: ReadonlySet<string>;
  readonly saving: ReadonlySet<string>;
  readonly toggleSave: (id: string, onDevice?: boolean) => Promise<void>;
  /** Held by Saved or by this device's list — the one "Saved" a card shows. */
  readonly isKept: (id: string) => boolean;
  /** The one Save: add to both, or remove from both. */
  readonly toggleKeep: (id: string, name?: AddedName) => Promise<void>;
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
  signedIn = true,
  tray = true,
}: {
  readonly children: React.ReactNode;
  /**
   * Whether anyone is signed in. A signed-out visitor has no Saved to read,
   * and asking anyway logs a 401 on every public page view.
   */
  readonly signedIn?: boolean;
  /** The planner, with whatever the page already knows (`at`, dates…). */
  readonly planHref: string;
  /** Show the floating tray (the list page says it itself). */
  readonly tray?: boolean;
}) {
  const [picked, setPicked] = useStoredList(PICKS_KEY, "local");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!signedIn) return;
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
  }, [signedIn]);

  const togglePick = useCallback(
    (id: string, name?: AddedName) => {
      if (name && !picked.includes(id)) rememberName(id, name);
      setPicked(
        picked.includes(id)
          ? picked.filter((x) => x !== id)
          : [...picked, id].slice(-12),
      );
    },
    [picked, setPicked],
  );

  const toggleSave = useCallback(
    async (id: string, onDevice = false) => {
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
          toast.success(
            onDevice
              ? "Saved to My Christmas List."
              : "Saved — it's waiting on your Saved page.",
          );
        }
      } catch (error) {
        if (isSignedOut(error)) {
          toast(onDevice ? "Saved on this phone" : "Sign in to keep this", {
            description: onDevice
              ? "Sign in to keep it on every device."
              : "Your saved places wait for you on any device.",
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

  const isKept = useCallback(
    (id: string) => picked.includes(id) || saved.has(id),
    [picked, saved],
  );

  const toggleKeep = useCallback(
    async (id: string, name?: AddedName) => {
      if (picked.includes(id) || saved.has(id)) {
        if (picked.includes(id)) togglePick(id);
        if (saved.has(id)) await toggleSave(id);
        toast("Removed from My Christmas List.");
        return;
      }
      togglePick(id, name);
      if (signedIn) await toggleSave(id, true);
      else
        toast("Saved on this phone", {
          description: "Sign in to keep it on every device.",
          action: {
            label: "Sign in",
            onClick: () => {
              window.location.href = `/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            },
          },
        });
    },
    [picked, saved, signedIn, togglePick, toggleSave],
  );

  const value = useMemo(
    () => ({
      picked,
      togglePick,
      clearPicks: () => setPicked([]),
      saved,
      saving,
      toggleSave,
      isKept,
      toggleKeep,
    }),
    [
      picked,
      setPicked,
      togglePick,
      saved,
      saving,
      toggleSave,
      isKept,
      toggleKeep,
    ],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {tray && <PickTray planHref={planHref} />}
    </Ctx.Provider>
  );
}

/**
 * **My Christmas List** — what somebody has gathered so far: Atlas finds
 * (picked on a card, this device) and light displays (added on the lights map or
 * a card, this phone). One tray, one button, one adventure.
 */
function PickTray({ planHref }: { readonly planHref: string }) {
  const { picked, clearPicks } = usePicks();
  const lights = useStash();
  const total = picked.length + lights.length;
  if (total === 0) return null;
  const query = [
    picked.length ? `with=${picked.join(",")}` : "",
    lights.length ? `lights=${lights.join(",")}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const href = `${planHref}${planHref.includes("?") ? "&" : "?"}${query}`;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      data-testid="pick-tray"
    >
      <div className="mx-auto flex max-w-xl items-center gap-2 rounded-full bg-[#0f3b2b] p-2 pl-5 text-white shadow-2xl">
        <Gift className="h-5 w-5 shrink-0 text-[#ffd98a]" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-base font-semibold">
          {total} in My Christmas List
        </p>
        <button
          type="button"
          onClick={() => {
            clearPicks();
            clearStash();
          }}
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
          Make it an adventure
        </Link>
      </div>
    </div>
  );
}

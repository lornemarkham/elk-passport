"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  clearStoredActiveBoardId,
  getStoredActiveBoardId,
  setStoredActiveBoardId,
} from "@/lib/data/activeBoardStorage";
import {
  createBoard,
  listBoardItems,
  listBoards,
  removeExperienceFromBoard,
  saveExperienceToBoard,
  type Board,
  type BoardItem,
} from "@/lib/data/boards-repo";
import {
  editable,
  ideasBoardOf,
  ideasFrom,
  inPocketOrder,
  type Idea,
} from "./ideas";

type RoleBoard = Board & { readonly role?: "owner" | "editor" | "viewer" };

/**
 * The name of the board a first save makes. Never asked for, and the same
 * name a place page's and Christmas's first save already use, so whichever
 * surface saves first, it is one board.
 */
export const FIRST_IDEAS_BOARD = "My Places";

const ORDER_KEY = "gh.pocket.order";

const readOrder = (): string[] => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(ORDER_KEY) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
};

/**
 * **A person's ideas, read and changed in one place** — the Adventure Pocket
 * and Discovery's Save buttons share this, so the count on the Pocket, the
 * "Saved" on a card and My Stuff's Ideas are the same boards in Atlas (see
 * `ideas.ts`). Nothing is cached anywhere else; the Pocket's order is the
 * only thing kept on the device, and it is only an order.
 */
export function useIdeas(signedIn: boolean) {
  const [boards, setBoards] = useState<RoleBoard[]>([]);
  const [items, setItems] = useState<Readonly<Record<string, BoardItem[]>>>({});
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  // Their boards could not even be listed. Then a save must not make a new
  // board: they may well have one, and a second "My Places" beside the real
  // one is the duplicate this guards against.
  const [unlisted, setUnlisted] = useState(false);
  const [ideasBoardId, setIdeasBoardId] = useState<string | null>(null);
  const [order, setOrderState] = useState<string[]>([]);

  useEffect(() => {
    if (!signedIn) {
      // The next person on this browser must not inherit the last one's.
      clearStoredActiveBoardId();
      return;
    }
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- read once from this device, after hydration */
    setOrderState(readOrder());
    /* eslint-enable react-hooks/set-state-in-effect */
    void (async () => {
      try {
        const all = (await listBoards()) as RoleBoard[];
        if (cancelled) return;
        const home = ideasBoardOf(all, getStoredActiveBoardId());
        // Only the boards that can hold ideas are read: a board shared with
        // them to look at is listed on My Stuff, not merged into their ideas.
        const own = all.filter((b) => (b.role ?? "owner") === "owner");
        const read = await Promise.all(
          own.map((b) =>
            listBoardItems(b.id)
              .then((list) => [b.id, list] as const)
              .catch(() => [b.id, null] as const),
          ),
        );
        if (cancelled) return;
        if (read.some(([, list]) => list === null))
          // The boards are still theirs; only some contents are missing, and
          // saying so beats a Pocket that looks emptier than it is.
          toast.error(
            "Couldn't load everything you've saved. It's still there.",
          );
        setBoards(all);
        setIdeasBoardId(home?.id ?? null);
        if (home) setStoredActiveBoardId(home.id);
        setFailed(read.some(([, list]) => list === null));
        setItems(
          Object.fromEntries(read.map(([id, list]) => [id, list ?? []])),
        );
      } catch (error) {
        console.error("Failed to load boards from Atlas:", error);
        if (!cancelled) {
          setFailed(true);
          setUnlisted(true);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const ideas: Idea[] = useMemo(
    () =>
      signedIn
        ? ideasFrom(
            boards.map((board) => ({ board, items: items[board.id] ?? [] })),
            ideasBoardId,
          )
        : [],
    [signedIn, boards, items, ideasBoardId],
  );
  const savedIds = useMemo(
    () => new Set(ideas.map((i) => i.experienceId)),
    [ideas],
  );
  const pocket = useMemo(() => inPocketOrder(ideas, order), [ideas, order]);

  const setOrder = useCallback((ids: readonly string[]) => {
    setOrderState([...ids]);
    try {
      window.localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
    } catch {
      // A phone that won't keep it still shows it for the visit.
    }
  }, []);

  /**
   * **Save it, at once.** To the ideas board; a person with no board yet
   * gets one, named for them. Already saved is success, not a second row.
   */
  const save = useCallback(
    async (experienceId: string): Promise<void> => {
      if (savedIds.has(experienceId)) return;
      let target = ideasBoardId;
      if (!target && unlisted)
        throw new Error("Their boards could not be read; not making another.");
      if (!target) {
        const made = await createBoard(FIRST_IDEAS_BOARD);
        target = made.id;
        setBoards((prev) => [...prev, { ...made, role: "owner" }]);
        setIdeasBoardId(made.id);
        setStoredActiveBoardId(made.id);
      }
      const board = target;
      const item = await saveExperienceToBoard(board, experienceId);
      setItems((prev) => ({
        ...prev,
        [board]: [
          ...(prev[board] ?? []).filter(
            (i) => i.experienceId !== item.experienceId,
          ),
          item,
        ],
      }));
    },
    [ideasBoardId, savedIds, unlisted],
  );

  /**
   * **Out of the Pocket**: off every board of theirs that holds it, so it is
   * not still one of their ideas through a collection. Returns where it was,
   * which is exactly what Undo puts back.
   */
  const remove = useCallback(
    async (experienceId: string): Promise<string[]> => {
      const idea = ideas.find((i) => i.experienceId === experienceId);
      if (!idea) return [];
      const from = idea.boardIds.filter((id) => {
        const b = boards.find((x) => x.id === id);
        return b ? editable(b) : false;
      });
      await Promise.all(
        from.map((id) => removeExperienceFromBoard(id, experienceId)),
      );
      setItems((prev) => {
        const next = { ...prev };
        for (const id of from)
          next[id] = (next[id] ?? []).filter(
            (i) => i.experienceId !== experienceId,
          );
        return next;
      });
      return from;
    },
    [ideas, boards],
  );

  /** **Undo**: back onto exactly the boards it came off. */
  const restore = useCallback(
    async (experienceId: string, to: readonly string[]) => {
      const back = await Promise.all(
        to.map((id) => saveExperienceToBoard(id, experienceId)),
      );
      setItems((prev) => {
        const next = { ...prev };
        for (const item of back)
          next[item.boardId] = [
            ...(next[item.boardId] ?? []).filter(
              (i) => i.experienceId !== experienceId,
            ),
            item,
          ];
        return next;
      });
    },
    [],
  );

  return {
    /** Every board they can reach — own and shared — for the board pages. */
    boards: signedIn ? boards : [],
    /** False until their boards have been asked for; a visitor is ready at once. */
    ready: signedIn ? loaded : true,
    /** A board's items could not be read; what was read is still shown. */
    failed,
    ideas,
    pocket,
    savedIds,
    save,
    remove,
    restore,
    setOrder,
  };
}

export type Ideas = ReturnType<typeof useIdeas>;

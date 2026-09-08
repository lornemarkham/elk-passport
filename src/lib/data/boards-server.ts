import "server-only";
import { currentUser } from "@/lib/auth/currentUser";
import type { Board, BoardItem } from "./boards-repo";

/**
 * **The only code that talks to Atlas about boards.**
 *
 * Every function here takes an `ownerId` it was *given*, and every caller gets
 * that id from `currentUser()` — never from a request body, a query string or
 * anything else the browser can write. That is the whole security property:
 * the browser can ask Passport to save something, and it cannot ask Passport
 * whose board to save it to.
 *
 * ## Why the browser stopped calling Atlas directly
 *
 * `boards-repo.ts` used to `fetch("http://localhost:3000/boards")` from inside
 * `"use client"` components. That is not a boundary — it is the absence of one.
 * Anyone with devtools could read and write every board in the database, and in
 * any deployment where Atlas is not on the reader's own laptop the calls simply
 * fail. Now the browser talks to Passport, Passport resolves the person, and
 * Passport talks to Atlas server-to-server. Same shape as the `ADMIN_TOKEN`
 * proxy routes that already exist.
 *
 * Atlas independently refuses to cross owners (`BoardService`), so a bug here
 * produces a 404 rather than somebody else's saved places.
 */
const ATLAS_BASE_URL = process.env.ATLAS_API_URL ?? "http://localhost:3000";

/**
 * Same reasoning as `atlas-repo`: Node's 30-second default header timeout was
 * an unexamined assumption about how fast Atlas is, and a corpus that grew past
 * a thousand entities disproved it. Waiting is honest; failing at 30s is not.
 *
 * `no-store` on every call because board state is somebody's saved places, and
 * a cached answer here is one person seeing another's — or their own, stale,
 * moments after they changed it.
 */
const ATLAS_TIMEOUT_MS = 120_000;

const atlasFetch = (url: string, init?: RequestInit): Promise<Response> =>
  fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(ATLAS_TIMEOUT_MS),
  });

function boardsUrl(path: string, ownerId: string): string {
  const url = new URL(`${ATLAS_BASE_URL}${path}`);
  url.searchParams.set("ownerId", ownerId);
  return url.toString();
}

/** Atlas reports "not yours" and "no such board" identically. So does this. */
export class BoardNotFound extends Error {
  constructor() {
    super("Board not found.");
    this.name = "BoardNotFound";
  }
}

async function expectOk(response: Response, what: string): Promise<void> {
  if (response.status === 404) throw new BoardNotFound();
  if (!response.ok) {
    throw new Error(`Atlas ${what} failed: ${response.status}`);
  }
}

export async function listBoardsFor(ownerId: string): Promise<Board[]> {
  const response = await atlasFetch(boardsUrl("/boards", ownerId));
  await expectOk(response, "list boards");
  return response.json();
}

export async function getBoardFor(
  boardId: string,
  ownerId: string,
): Promise<Board | null> {
  // Atlas has no GET /boards/:id — the same gap `BoardService.renameBoard`
  // works around by listing. Listing is already owner-scoped, so this cannot
  // return a board belonging to anyone else.
  const boards = await listBoardsFor(ownerId);
  return boards.find((board) => board.id === boardId) ?? null;
}

export async function createBoardFor(
  name: string,
  ownerId: string,
): Promise<Board> {
  const response = await atlasFetch(`${ATLAS_BASE_URL}/boards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, ownerId }),
  });
  await expectOk(response, "create board");
  return response.json();
}

export async function renameBoardFor(
  boardId: string,
  name: string,
  ownerId: string,
): Promise<Board> {
  const response = await atlasFetch(
    boardsUrl(`/boards/${encodeURIComponent(boardId)}`, ownerId),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );
  await expectOk(response, "rename board");
  return response.json();
}

export async function deleteBoardFor(
  boardId: string,
  ownerId: string,
): Promise<void> {
  const response = await atlasFetch(
    boardsUrl(`/boards/${encodeURIComponent(boardId)}`, ownerId),
    { method: "DELETE" },
  );
  await expectOk(response, "delete board");
}

export async function listBoardItemsFor(
  boardId: string,
  ownerId: string,
): Promise<BoardItem[]> {
  const response = await atlasFetch(
    boardsUrl(`/boards/${encodeURIComponent(boardId)}/items`, ownerId),
  );
  await expectOk(response, "list board items");
  return response.json();
}

export async function addBoardItemFor(
  boardId: string,
  experienceId: string,
  ownerId: string,
): Promise<BoardItem> {
  const response = await atlasFetch(
    boardsUrl(`/boards/${encodeURIComponent(boardId)}/items`, ownerId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experienceId }),
    },
  );
  await expectOk(response, "add board item");
  return response.json();
}

export async function removeBoardItemFor(
  boardId: string,
  experienceId: string,
  ownerId: string,
): Promise<void> {
  const response = await atlasFetch(
    boardsUrl(
      `/boards/${encodeURIComponent(boardId)}/items/${encodeURIComponent(experienceId)}`,
      ownerId,
    ),
    { method: "DELETE" },
  );
  await expectOk(response, "remove board item");
}

/**
 * The signed-in person's boards, or an empty list for a visitor.
 *
 * For Server Components that want to *show* boards. Anonymous is not an error
 * here — a logged-out traveller has no boards, which is a fact rather than a
 * failure, and the page says so instead of throwing.
 */
export async function myBoards(): Promise<Board[]> {
  const user = await currentUser();
  if (!user) return [];
  return listBoardsFor(user.id);
}

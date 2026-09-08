/**
 * **Boards, as the browser sees them.**
 *
 * Every function here talks to *Passport* — relative `/api/boards/...` URLs —
 * and Passport talks to Atlas. It used to `fetch("http://localhost:3000/...")`
 * straight from `"use client"` components, which meant the browser was reading
 * and writing Atlas with no identity of any kind: every board in the database
 * belonged to the literal string `"demo-user"` and was returned to everybody.
 *
 * The exported surface is unchanged, so no call site moved. What changed is who
 * decides whose boards these are: the server, from a verified session, instead
 * of nobody.
 *
 * ## Anonymous is a normal answer
 *
 * A signed-out visitor gets `401` from all of these, and that is not a bug to
 * paper over — it is the one place Passport asks for anything. Callers use
 * `isSignedOut(error)` to tell "you need an account for this" apart from "the
 * request failed", because those deserve very different words on screen.
 */

export interface Board {
  id: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardItem {
  id: string;
  boardId: string;
  experienceId: string;
  addedAt: string;
}

/** Thrown for 401 so a caller can offer a sign-in rather than an apology. */
export class SignedOutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignedOutError";
  }
}

export function isSignedOut(error: unknown): error is SignedOutError {
  return error instanceof SignedOutError;
}

async function request(
  path: string,
  init: RequestInit | undefined,
  failure: string,
): Promise<Response> {
  const response = await fetch(`/api/boards${path}`, init);

  if (response.status === 401) {
    const body = await response.json().catch(() => null);
    throw new SignedOutError(
      typeof body?.message === "string"
        ? body.message
        : "Sign in to keep this.",
    );
  }

  if (!response.ok) {
    throw new Error(failure);
  }

  return response;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function listBoards(): Promise<Board[]> {
  return (await request("", undefined, "Failed to load boards.")).json();
}

export async function getBoard(boardId: string): Promise<Board | null> {
  const boards = await listBoards();
  return boards.find((board) => board.id === boardId) ?? null;
}

export async function createBoard(name: string): Promise<Board> {
  return (await request("", json({ name }), "Failed to create board.")).json();
}

export async function listBoardItems(boardId: string): Promise<BoardItem[]> {
  return (
    await request(
      `/${encodeURIComponent(boardId)}/items`,
      undefined,
      "Failed to load board items.",
    )
  ).json();
}

export async function saveExperienceToBoard(
  boardId: string,
  experienceId: string,
): Promise<BoardItem> {
  return (
    await request(
      `/${encodeURIComponent(boardId)}/items`,
      json({ experienceId }),
      "Failed to save experience to board.",
    )
  ).json();
}

export async function removeExperienceFromBoard(
  boardId: string,
  experienceId: string,
): Promise<void> {
  await request(
    `/${encodeURIComponent(boardId)}/items/${encodeURIComponent(experienceId)}`,
    { method: "DELETE" },
    "Failed to remove experience from board.",
  );
}

export async function renameBoard(
  boardId: string,
  name: string,
): Promise<Board> {
  return (
    await request(
      `/${encodeURIComponent(boardId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      },
      "Failed to rename board.",
    )
  ).json();
}

export async function deleteBoard(boardId: string): Promise<void> {
  await request(
    `/${encodeURIComponent(boardId)}`,
    { method: "DELETE" },
    "Failed to delete board.",
  );
}

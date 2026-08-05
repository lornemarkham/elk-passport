/**
 * Talks to Atlas's Boards API. Same style as `atlas-repo.ts` — plain
 * `fetch`, hardcoded `http://localhost:3000`, throw on a non-ok response —
 * not a new client pattern.
 */
const ATLAS_BASE_URL = "http://localhost:3000";

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

export async function listBoards(): Promise<Board[]> {
  const response = await fetch(`${ATLAS_BASE_URL}/boards`);
  if (!response.ok) {
    throw new Error("Failed to load boards.");
  }
  return response.json();
}

export async function createBoard(name: string): Promise<Board> {
  const response = await fetch(`${ATLAS_BASE_URL}/boards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error("Failed to create board.");
  }
  return response.json();
}

export async function listBoardItems(boardId: string): Promise<BoardItem[]> {
  const response = await fetch(
    `${ATLAS_BASE_URL}/boards/${encodeURIComponent(boardId)}/items`,
  );
  if (!response.ok) {
    throw new Error("Failed to load board items.");
  }
  return response.json();
}

export async function saveExperienceToBoard(
  boardId: string,
  experienceId: string,
): Promise<BoardItem> {
  const response = await fetch(
    `${ATLAS_BASE_URL}/boards/${encodeURIComponent(boardId)}/items`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experienceId }),
    },
  );
  if (!response.ok) {
    throw new Error("Failed to save experience to board.");
  }
  return response.json();
}

export async function removeExperienceFromBoard(
  boardId: string,
  experienceId: string,
): Promise<void> {
  const response = await fetch(
    `${ATLAS_BASE_URL}/boards/${encodeURIComponent(boardId)}/items/${encodeURIComponent(experienceId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    throw new Error("Failed to remove experience from board.");
  }
}

export async function renameBoard(
  boardId: string,
  name: string,
): Promise<Board> {
  const response = await fetch(
    `${ATLAS_BASE_URL}/boards/${encodeURIComponent(boardId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to rename board.");
  }

  return response.json();
}

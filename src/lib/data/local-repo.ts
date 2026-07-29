/**
 * Local, browser-only data layer. Stands in for Prisma + Supabase
 * (see /docs/architecture.md, "Data layer") until real credentials exist —
 * see /docs/technical.md for what's currently blocked.
 *
 * Every function here is async and shaped like a real API call on purpose:
 * swapping this module for one that calls a server/Prisma is meant to be a
 * localized change, not a rewrite of the components that use it.
 */
import {
  type Adventure,
  type AdventureDna,
  type Moment,
  adventureDnaSchema,
} from "@/lib/schemas";

const DNA_KEY = "elk-passport:adventure-dna";
const ADVENTURES_KEY = "elk-passport:adventures";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export async function getAdventureDna(): Promise<AdventureDna> {
  return read(DNA_KEY, adventureDnaSchema.parse({ traits: [] }));
}

export async function saveAdventureDna(
  dna: AdventureDna,
): Promise<AdventureDna> {
  write(DNA_KEY, dna);
  return dna;
}

export async function listAdventures(): Promise<Adventure[]> {
  return read<Adventure[]>(ADVENTURES_KEY, []).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function getAdventure(id: string): Promise<Adventure | null> {
  const adventures = await listAdventures();
  return adventures.find((a) => a.id === id) ?? null;
}

export async function saveAdventure(adventure: Adventure): Promise<Adventure> {
  const adventures = await listAdventures();
  const next = [adventure, ...adventures.filter((a) => a.id !== adventure.id)];
  write(ADVENTURES_KEY, next);
  return adventure;
}

export async function addMoment(
  adventureId: string,
  moment: Moment,
): Promise<Adventure> {
  const adventure = await getAdventure(adventureId);
  if (!adventure) throw new Error("Adventure not found");
  const next: Adventure = {
    ...adventure,
    moments: [...adventure.moments, moment],
  };
  return saveAdventure(next);
}

export async function advanceAdventure(
  adventureId: string,
  currentBlockIndex: number,
): Promise<Adventure> {
  const adventure = await getAdventure(adventureId);
  if (!adventure) throw new Error("Adventure not found");
  // Reaching the last block's *view* isn't the same as finishing it — status
  // only flips to "completed" via completeAdventure, once the user actually
  // finishes (see /docs/build-contract.md on not guessing product behavior;
  // this was a real bug, not a product decision).
  const next: Adventure = { ...adventure, currentBlockIndex, status: "active" };
  return saveAdventure(next);
}

export async function completeAdventure(
  adventureId: string,
): Promise<Adventure> {
  const adventure = await getAdventure(adventureId);
  if (!adventure) throw new Error("Adventure not found");
  const next: Adventure = { ...adventure, status: "completed" };
  return saveAdventure(next);
}

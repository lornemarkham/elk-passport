import { expect, type Page } from "@playwright/test";

/**
 * Open one of the night's four rooms — Plan, Play, Chat, Group
 * (`src/domain/hockey/tabs.ts`) — and wait until it is the open one.
 */
export async function openTab(
  page: Page,
  name: "Plan" | "Play" | "Chat" | "Group",
): Promise<void> {
  const tab = page.getByRole("tab", { name: new RegExp(`^${name}`) });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

/**
 * Open the part of the night a spec is about, and return it.
 *
 * Since "make the night come alive" (`docs/product/hockey/ALIVE.md`) Plan is
 * one game plan of four stops — Pregame, Meet up, Game time, After — each one
 * line that opens in place. The older decisions live in these stops:
 *
 *   Before the game  → Pregame    (the one dinner vote)
 *   Meeting point    → Meet up    (the meet-spot vote and the host's meetup)
 *   Getting there    → Game time  (directions open with the seats)
 *   Our seats        → Game time
 *   After the game   → After / What's next
 *
 * Opens the stop if it's closed (the stop's own button, the one that
 * controls its detail). Pregame has none: its venue cards are on the page.
 */
export async function openDecision(
  page: Page,
  label:
    | "Before the game"
    | "Getting there"
    | "Meeting point"
    | "Our seats"
    | "After the game"
    | "Pregame"
    | "Meet up"
    | "Game time"
    | "After",
) {
  const stop =
    {
      "Before the game": "Pregame",
      "Meeting point": "Meet up",
      "Getting there": "Game time",
      "Our seats": "Game time",
      "After the game": "After",
    }[label as string] ?? label;
  let region = page.getByRole("region", { name: stop, exact: true });
  if (stop === "After" && (await region.count()) === 0)
    region = page.getByRole("region", { name: "What's next", exact: true });
  await expect(region).toBeVisible();
  const toggle = region.locator("button[aria-controls]").first();
  if ((await toggle.count()) === 0) return region;
  if ((await toggle.getAttribute("aria-expanded")) === "false")
    await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  return region;
}

/**
 * Open the "Find one in Passport" browser — Passport's venue cards for every
 * place near the arena — from the Pregame stop's "Think you know somewhere
 * better?" box, and return the sheet. Every card is an `article`; the places
 * already on the vote are under "On the vote".
 */
export async function openExplore(page: Page) {
  const stop = await openDecision(page, "Pregame");
  await stop.getByRole("button", { name: /^Find one in Passport/ }).click();
  const sheet = page.getByRole("dialog", { name: /^Near / });
  await expect(sheet).toBeVisible();
  return sheet;
}

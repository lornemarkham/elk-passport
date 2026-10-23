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
 * Open one of Plan's five decisions (`DECISIONS` in
 * `src/domain/hockey/plan.ts`) — "Before the game", "Getting there",
 * "Meeting point", "Our seats", "After the game" — and return it. One is open
 * at a time, so opening one closes the last.
 */
export async function openDecision(
  page: Page,
  label:
    | "Before the game"
    | "Getting there"
    | "Meeting point"
    | "Our seats"
    | "After the game",
) {
  const region = page
    .getByRole("region", { name: "The plan" })
    .getByRole("region", { name: label, exact: true });
  const button = region.getByRole("button", { name: new RegExp(`^${label}`) });
  if ((await button.getAttribute("aria-expanded")) !== "true")
    await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  return region;
}

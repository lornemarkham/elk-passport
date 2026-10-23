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
 * Go to one of Plan's five decisions (`DECISIONS` in
 * `src/domain/hockey/plan.ts`) — "Before the game", "Getting there",
 * "Meeting point", "Our seats", "After the game" — and return its part of the
 * page. Since the recovery (`docs/product/hockey/RECOVERY.md`) every part is
 * open, one after another, so this is the plan's line for it, tapped: the page
 * goes there. (Release 1 and 2 opened one row of an accordion at a time.)
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
  const region = page.getByRole("region", { name: label, exact: true });
  await page
    .getByRole("region", { name: "The plan" })
    .getByRole("button", { name: new RegExp(`^${label}`) })
    .click();
  await expect(region).toBeInViewport();
  return region;
}

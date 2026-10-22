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

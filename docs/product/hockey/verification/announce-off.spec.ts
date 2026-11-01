import { expect, test } from "@playwright/test";
import { openTab } from "./night-tabs";
import {
  peopleCalled,
  phone,
  refused,
  setNight,
  signUp,
  snapshot,
} from "./mayhem-helpers";

/**
 * **Deployed before `announce-migration.sql`**: the chat is exactly as it
 * was. No Announce button for the host, the API says 409, a line still
 * posts (with no reply), the ↩ is still offered but a reply is just a
 * line. Run on a stack started with `HOCKEY_ANNOUNCE=0`, with `ANNOUNCE_OFF=1`.
 */
peopleCalled("announce-off");
test.skip(
  !process.env.ANNOUNCE_OFF,
  "needs a stack without announce-migration.sql",
);

test("without the migration the chat works as before", async ({ browser }) => {
  const page = await phone(browser);
  await page.goto("/hockey");
  await signUp(page, "lorne");
  await page.getByLabel("Your name").fill("Lorne");
  await page.getByLabel("Opponent").fill("Wild");
  const in2 = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString(
    "en-CA",
    { timeZone: "America/Vancouver" },
  );
  await page.getByLabel("Game date").fill(in2);
  await page.getByLabel("Puck drop time").fill("19:00");
  await page.getByRole("button", { name: "Start it" }).click();
  await expect(page).toHaveURL(/\/hockey\/[0-9a-f-]{36}$/);
  setNight(page.url().split("/").pop()!);
  await page.getByRole("button", { name: /Skip/ }).click();
  expect((await snapshot(page)).announce).toBe(false);
  await openTab(page, "Chat");
  await expect(
    page.getByRole("button", { name: "Announce a change" }),
  ).toHaveCount(0);
  await refused(page, { type: "announce", tag: "venue", text: "x" }, 409);
  await page.getByLabel("Say something to the group").fill("Still works.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Still works.")).toBeVisible();
  const said = (await snapshot(page)).state.moments?.find(
    (m) => m.text === "Still works.",
  );
  expect(said?.replyTo).toBeUndefined();
});

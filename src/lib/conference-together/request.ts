import "server-only";
import type { ConferenceSummary } from "@/domain/conference/contracts";
import { deps } from "@/lib/conference/request";
import { corpus, lookupFrom } from "@/lib/conference-explore/places";
import type { ChatDeps } from "@/lib/conference-chat/service";
import { chatStore } from "@/lib/conference-chat/store";
import type { MemoriesDeps } from "@/lib/conference-memories/service";
import { memoriesStore } from "@/lib/conference-memories/store";
import type { PeopleDeps } from "@/lib/conference-people/service";
import { peopleStore } from "@/lib/conference-people/store";
import type { PlansDeps } from "@/lib/conference-plans/service";
import { plansStore } from "@/lib/conference-plans/store";
import { togetherEnabled } from "./enabled";

/**
 * Live dependencies for the shared modules' routes and pages. Tests build
 * their own. Plans need places resolved; the Atlas read behind that is
 * bounded (`corpus`), so a slow Atlas costs a photograph, not the page.
 */
export async function plansDeps(
  c: Pick<ConferenceSummary, "place"> | null,
  budgetMs = 2500,
): Promise<PlansDeps> {
  const { candidates } = c ? await corpus(budgetMs) : { candidates: [] };
  return {
    conference: deps(),
    store: plansStore(),
    lookup: c ? lookupFrom(c, candidates) : () => null,
    enabled: togetherEnabled(),
  };
}

export const chatDeps = (): ChatDeps => ({
  conference: deps(),
  store: chatStore(),
  plans: plansStore(),
  enabled: togetherEnabled(),
});

export const peopleDeps = (): PeopleDeps => ({
  conference: deps(),
  store: peopleStore(),
  enabled: togetherEnabled(),
});

export const memoriesDeps = (): MemoriesDeps => ({
  conference: deps(),
  store: memoriesStore(),
  plans: plansStore(),
  enabled: togetherEnabled(),
});

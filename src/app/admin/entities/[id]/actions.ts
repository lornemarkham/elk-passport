"use server";

import { revalidatePath } from "next/cache";
import {
  requestResearchMission,
  reviewResearchMission,
} from "@/lib/knowledge/researchMissions";

/**
 * The Research button's other half.
 *
 * Records that a curator asked, then returns. It does **not** fetch, call a
 * model, or merge — `npm run run-missions` does that. A form action that
 * waited for an LLM round trip would time out, and a timeout would look
 * like a broken button rather than what it is: a mission that was recorded
 * and then failed.
 */
export async function startResearch(formData: FormData): Promise<void> {
  const entityId = String(formData.get("entityId") ?? "");
  const topic = String(formData.get("topic") ?? "");
  if (!entityId || !topic) return;

  await requestResearchMission(entityId, topic);
  revalidatePath(`/admin/entities/${entityId}`);
}

/**
 * A human's decision on findings.
 *
 * Accepting genuinely changes the entity. Atlas recomputes the merge
 * against the entity **as it stands now** rather than replaying the
 * override it calculated when the mission ran — a stale override is exactly
 * the write the never-overwrite rule exists to prevent.
 *
 * `revalidatePath` is what closes the loop the milestone asked for: the
 * workspace re-derives from the store, the merged facts appear in their
 * section, and the gap that prompted the research stops being a gap.
 */
export async function decideResearch(formData: FormData): Promise<void> {
  const missionId = String(formData.get("missionId") ?? "");
  const entityId = String(formData.get("entityId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!missionId || (decision !== "accept" && decision !== "reject")) return;

  await reviewResearchMission(missionId, decision);
  revalidatePath(`/admin/entities/${entityId}`);
}

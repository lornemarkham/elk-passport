import { z } from "zod";
import type { LivePrompt } from "@/experience-lab/core/engine";
import type { Participant, ResponseValue } from "@/experience-lab/core/types";
import { MODULE_IDS, type ModuleId } from "./modules";
import { TEAM_ABBRS } from "./fans";

/**
 * **Everything a member can do to a night, as data.**
 *
 * One door: `POST /hockey/api/occasions/:id/actions`. The shapes mirror the
 * lab hook's callbacks one for one (`useExperienceLab`), so the shared page
 * calls exactly what the prototype called — only now it crosses a network
 * and is checked twice, here and by RLS.
 *
 * Nothing in an action names who is acting. That comes from the session,
 * never from the body, which is the whole of "members cannot impersonate
 * other members" at this layer.
 */

const short = (max: number) => z.string().trim().min(1).max(max);
const promptId = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}(::[A-Za-z0-9_-]{1,64})?$/);
const emoji = z.string().min(1).max(16);

/** Which modules a night has on: known ids only, each at most once. */
export const modulesValue = z
  .array(z.enum(MODULE_IDS as [ModuleId, ...ModuleId[]]))
  .max(MODULE_IDS.length);

const responseValue: z.ZodType<ResponseValue> = z.union([
  z.string().max(280),
  z.array(z.string().max(80)).max(20),
  z.number().finite(),
  z.boolean(),
  z.tuple([z.number().int(), z.number().int()]),
]);

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("respond"), promptId, value: responseValue }),
  z.object({ type: z.literal("say"), text: short(500) }),
  z.object({ type: z.literal("react"), momentId: z.string().uuid(), emoji }),
  z.object({
    type: z.literal("addOption"),
    promptId,
    label: short(80),
    detail: z.string().trim().max(160).optional(),
  }),
  z.object({
    type: z.literal("addToy"),
    family: z.enum([
      "prediction",
      "sealed",
      "mission",
      "dare",
      "sidequest",
      "photo",
      "vault",
      "groupquest",
      "consequence",
      "ask",
    ]),
    input: z.object({
      text: short(280),
      targetId: z.string().uuid().optional(),
      phaseId: z.string().max(40),
      locksAtPhaseId: z.string().max(40).optional(),
      revealAtPhaseId: z.string().max(40).optional(),
      points: z.number().int().min(0).max(20),
      edge: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    }),
  }),
  /**
   * Put a real place on the ballot. Only the Atlas id crosses the wire: the
   * name and the distance are looked up and measured by the server, so a
   * nomination cannot claim to be a 0-minute walk.
   */
  z.object({
    type: z.literal("nominate"),
    promptId,
    atlasId: z.string().min(1).max(200),
  }),
  z.object({ type: z.literal("cue"), promptId }),
  z.object({ type: z.literal("consent"), promptId, agreed: z.boolean() }),
  z.object({
    type: z.literal("setBrief"),
    brief: z.object({
      audience: short(60),
      vibe: short(60),
      edge: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
      appetite: z.enum(["watch", "some", "lots"]),
      note: z.string().trim().max(200).optional(),
    }),
  }),
  z.object({
    type: z.literal("setMyEdge"),
    edge: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.null(),
    ]),
  }),
  z.object({
    type: z.literal("setMe"),
    name: short(40),
    emoji,
    vibe: z.string().trim().max(80).optional(),
  }),
  z.object({
    type: z.literal("callIt"),
    promptId,
    value: responseValue.nullable(),
  }),
  z.object({ type: z.literal("setModules"), modules: modulesValue }),
  /** Who I bleed for (`fans.ts`), or null for nobody. Not tonight's teams. */
  z.object({
    type: z.literal("setTeam"),
    team: z.enum(TEAM_ABBRS).nullable(),
  }),
  /** I opened the chat: Chirp Bot may have a pregame question due. */
  z.object({ type: z.literal("chirpLook") }),
  /** Host: Chirp Bot on or off for this night, and how much it talks. */
  z.object({
    type: z.literal("setChirp"),
    on: z.boolean(),
    level: z.enum(["quiet", "normal", "rowdy"]).optional(),
  }),
  /** At the arena or watching from the couch, on this night (`crowd.ts`). */
  z.object({
    type: z.literal("setWatching"),
    where: z.enum(["arena", "couch"]),
  }),
]);

export type Action = z.infer<typeof ActionSchema>;

/**
 * Is `value` a real answer to this question, from this person, right now?
 *
 * The engine already decided whether the question is open *to me* — locks,
 * consent and audience all fold into `live.open` and into whether the prompt
 * is on my page at all — so this only has to judge the value's shape.
 */
export function answerProblem(
  live: LivePrompt | undefined,
  value: ResponseValue,
  people: readonly Participant[],
): string | null {
  if (!live) return "No such question here.";
  if (!live.open)
    return live.locked
      ? "That's locked. Nobody can save you now."
      : "Opt in first.";
  const { prompt } = live;
  const isInt = (n: unknown, max: number) =>
    typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max;

  switch (prompt.kind) {
    case "choice": {
      const ids = new Set((prompt.options ?? []).map((o) => o.id));
      return typeof value === "string" && ids.has(value)
        ? null
        : "Pick one of the options.";
    }
    case "person":
      return typeof value === "string" &&
        (people.some((p) => p.id === value) ||
          (prompt.options ?? []).some((o) => o.id === value))
        ? null
        : "Pick somebody who is actually here.";
    case "number":
      return isInt(value, 99) ? null : "A whole number, please.";
    case "pair":
      return Array.isArray(value) &&
        value.length === 2 &&
        isInt(value[0], 30) &&
        isInt(value[1], 30)
        ? null
        : "Two scores, please.";
    case "boolean":
      return typeof value === "boolean" ? null : "Yes or no.";
    case "text":
    case "photo":
      return typeof value === "string" &&
        value.trim().length > 0 &&
        value.length <= 280
        ? null
        : "Say something (280 characters at most).";
  }
}

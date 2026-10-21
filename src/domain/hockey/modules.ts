/**
 * **What a night has in it — the host's choice, not a new night.**
 *
 * Every night is the same template; a module is a named handful of its
 * questions the host can leave out (watching from the seats with no dinner
 * plan, say, or a group that wants no picks at all). Who's in, the
 * conversation, the Cup and the recap are the night itself and are always on.
 *
 * Stored as `details.modules` on the occasion: absent means everything, so
 * nights started before modules existed are unchanged. Turning a module off
 * hides its questions and refuses new answers to them (the server composes
 * the night before it accepts anything); nobody's answers are deleted, and
 * turning it back on brings them back.
 */
export const MODULES = [
  {
    id: "dinner",
    label: "Where we eat",
    detail: "Vote on food and drink near the arena",
    promptIds: ["pregame-spot"],
  },
  {
    id: "meet",
    label: "Where we meet",
    detail: "Pick a spot to find each other",
    promptIds: ["meet-spot"],
  },
  {
    id: "leaving",
    label: "When we leave",
    detail: "Straight home, one drink, or until they close",
    promptIds: ["hard-out", "postgame"],
  },
  {
    id: "picks",
    label: "Sealed picks",
    detail: "Score, first goal, the $19 beer — hidden until puck drop",
    promptIds: [
      "final-score",
      "first-team",
      "overtime",
      "total-goals",
      "host-beer",
      "refs",
      "sides",
    ],
  },
  {
    id: "games",
    label: "Stupid questions & dares",
    detail: "Ask the group, intermission games, the vault",
    promptIds: ["group-photo", "vault", "vault-vote"],
  },
] as const;

export type ModuleId = (typeof MODULES)[number]["id"];

export const MODULE_IDS: readonly ModuleId[] = MODULES.map((m) => m.id);

const isModuleId = (v: unknown): v is ModuleId =>
  typeof v === "string" && (MODULE_IDS as readonly string[]).includes(v);

/** The modules a night has on. Absent or unreadable means all of them. */
export function modulesOf(details: {
  readonly modules?: unknown;
}): Set<ModuleId> {
  if (!Array.isArray(details.modules)) return new Set(MODULE_IDS);
  return new Set(details.modules.filter(isModuleId));
}

/** Normalised for storage: known ids only, in the canonical order. */
export function storedModules(on: Iterable<string>): ModuleId[] {
  const wanted = new Set(on);
  return MODULE_IDS.filter((id) => wanted.has(id));
}

const owner = new Map<string, ModuleId>(
  MODULES.flatMap((m) => m.promptIds.map((p) => [p, m.id] as const)),
);

/** Whether a template question belongs on a night with these modules on. */
export function promptIsOn(
  promptId: string,
  on: ReadonlySet<ModuleId>,
): boolean {
  const home = owner.get(promptId);
  return home === undefined || on.has(home);
}

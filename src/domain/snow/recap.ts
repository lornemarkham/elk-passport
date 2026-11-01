import { awards, standings } from "./scoring";
import { challengeById } from "./challenges";
import { chosenFor, type SnowDay } from "./day";

/**
 * **The recap: what the day was, in the order a person would tell it.**
 *
 * Built only from what the crew recorded. If nobody added a photo there is
 * no photo section; if nobody played, there is no table. Never padded with
 * invention — an honest short recap beats a full one with made-up
 * highlights.
 */
export interface Recap {
  readonly title: string;
  readonly when?: string;
  readonly mountain?: string;
  readonly crew: readonly string[];
  readonly challengesDone: readonly { title: string; who: string[] }[];
  readonly standings: ReturnType<typeof standings>;
  readonly awards: ReturnType<typeof awards>;
  readonly photos: SnowDay["photos"];
  readonly moments: readonly { text: string; who: string }[];
  readonly ideas: SnowDay["ideas"];
  readonly empty: boolean;
}

export function buildRecap(day: SnowDay): Recap {
  const byChallenge = new Map<string, string[]>();
  for (const c of day.completions) {
    const who = day.people.find((p) => p.id === c.personId)?.name;
    if (!who) continue;
    byChallenge.set(c.challengeId, [
      ...(byChallenge.get(c.challengeId) ?? []),
      who,
    ]);
  }
  const challengesDone = [...byChallenge.entries()].flatMap(([id, who]) => {
    const ch = challengeById(id, day.customChallenges);
    return ch ? [{ title: ch.title, who }] : [];
  });
  const rows = standings(day);
  const moments = day.moments.flatMap((m) => {
    const who = day.people.find((p) => p.id === m.personId)?.name;
    return who ? [{ text: m.text, who }] : [];
  });
  return {
    title: day.title,
    when: day.date,
    mountain: chosenFor(day, "mountain")?.label,
    crew: day.people.map((p) => p.name),
    challengesDone,
    standings: rows.some((r) => r.points > 0) ? rows : [],
    awards: awards(day),
    photos: day.photos,
    moments,
    ideas: [...day.ideas].sort((a, b) => b.votes.length - a.votes.length),
    empty:
      challengesDone.length === 0 &&
      day.photos.length === 0 &&
      moments.length === 0,
  };
}

/** Plain text that survives iMessage, Slack and a screenshot. No link, no account. */
export function recapText(day: SnowDay): string {
  const r = buildRecap(day);
  const lines: string[] = [`🏔️ ${r.title}`];
  const meta = [r.mountain, r.when].filter(Boolean).join(" · ");
  if (meta) lines.push(meta);
  lines.push(`With ${r.crew.join(", ")}`);
  if (r.standings.length) {
    lines.push("", "Standings");
    r.standings.forEach((s) =>
      lines.push(`${s.rank}. ${s.person.name} — ${s.points}`),
    );
  }
  if (r.awards.length) {
    lines.push("");
    r.awards.forEach((a) =>
      lines.push(
        `${a.emoji} ${a.title}: ${a.winners.map((w) => w.name).join(" & ")}`,
      ),
    );
  }
  if (r.challengesDone.length) {
    lines.push("", `Challenges done: ${r.challengesDone.length}`);
  }
  const best = r.moments[0];
  if (best) lines.push("", `“${best.text}” — ${best.who}`);
  const next = r.ideas[0];
  lines.push("", next ? `Next up: ${next.text}` : "Next up: the same again?");
  return lines.join("\n");
}

// ------------------------------------------------------------- sharing

/**
 * A plan, as a link whose payload lives after the `#` — the part of a URL a
 * browser never sends to a server, so the plan is not in anyone's logs.
 * Photos are left out: they are big and they are personal.
 */
export function shareFragment(day: SnowDay): string {
  const lite = { ...day, photos: [] };
  const json = JSON.stringify(lite);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function readFragment(fragment: string): unknown {
  try {
    const b64 = fragment.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **DTX-05, as a test: Go Offline does not reach for the person.**
 *
 * No notifications, no vibration, no share sheet, no ticking timers, no
 * network writes. A comment may name any of these to say why it is absent;
 * the code may not use them. This is a tripwire for whoever edits these
 * folders next, not a proof — review still has to hold the line.
 */
const ROOTS = ["src/components/detox", "src/lib/detox", "src/app/detox"];

const FORBIDDEN: readonly [RegExp, string][] = [
  [/\bNotification\b/, "notifications"],
  [/\bserviceWorker\b|\bpushManager\b/i, "push"],
  [/navigator\.vibrate/, "vibration"],
  [/navigator\.share|\bnavigator\.clipboard/, "sharing"],
  [/\bsetInterval\s*\(/, "a ticking timer"],
  [/\bfetch\s*\(|sendBeacon|XMLHttpRequest/, "a network write"],
  [/\bstreak|\bleaderboard|\bpoints?\b|\bbadges?\b/i, "gamified screen time"],
];

/** Source with comments removed, so prose can explain what code may not do. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });

describe("Go Offline guardrails", () => {
  const sources = ROOTS.flatMap(files);

  it("finds the code it is guarding", () => {
    expect(sources.length).toBeGreaterThan(8);
  });

  for (const [pattern, what] of FORBIDDEN) {
    it(`uses no ${what}`, () => {
      const offenders = sources.filter((path) =>
        pattern.test(code(readFileSync(path, "utf8"))),
      );
      expect(offenders).toEqual([]);
    });
  }
});

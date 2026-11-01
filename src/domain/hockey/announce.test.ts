import { describe, expect, it } from "vitest";
import type { Moment } from "@/experience-lab/core/types";
import { ActionSchema } from "./actions";
import {
  ACK,
  ackLine,
  announcementsOf,
  hrefSchema,
  pendingFor,
  quoteOf,
  repliedTo,
} from "./announce";

const HOST = "h";
const people = [
  { id: HOST, name: "Lorne" },
  { id: "a", name: "Alex" },
  { id: "b", name: "Sam" },
  { id: "c", name: "Maya" },
];

const moment = (over: Partial<Moment>): Moment => ({
  id: "m1",
  at: "2026-10-26T01:00:00Z",
  kind: "announce",
  by: HOST,
  text: "Shark Club is packed. We're going to Boston Pizza instead.",
  tag: "venue",
  ...over,
});

describe("announcements", () => {
  it("are the host's tagged moments, newest first, with who has seen them", () => {
    const all = announcementsOf(
      [
        moment({ id: "old", at: "2026-10-26T00:00:00Z", tag: "time" }),
        moment({
          id: "new",
          href: "https://www.google.com/maps/search/?api=1&query=Boston+Pizza",
          reactions: { [ACK]: ["a", "zz"], "🔥": ["b"] },
        }),
        moment({ id: "note", kind: "note", tag: undefined }),
        moment({ id: "bad", tag: "nonsense" }),
      ],
      people,
    );
    expect(all.map((a) => a.id)).toEqual(["new", "old"]);
    expect(all[0].headline).toBe("CHANGE OF PLANS!");
    expect(all[1].headline).toBe("TIME CHANGE");
    // A ✅ from somebody no longer on the night does not count.
    expect(all[0].ackedBy).toEqual(["a"]);
    expect(all[0].href).toMatch(/^https:\/\/www\.google\.com\/maps/);
  });

  it("stay in front of a person until they tap Got it! or put it away", () => {
    const all = announcementsOf(
      [moment({ id: "n1", reactions: { [ACK]: ["a"] } }), moment({ id: "n2" })],
      people,
    );
    expect(pendingFor(all, "a", new Set()).map((a) => a.id)).toEqual(["n2"]);
    expect(pendingFor(all, "b", new Set()).map((a) => a.id)).toEqual([
      "n1",
      "n2",
    ]);
    expect(pendingFor(all, "b", new Set(["n1"])).map((a) => a.id)).toEqual([
      "n2",
    ]);
    // The host wrote it; nobody announces at themselves.
    expect(pendingFor(all, HOST, new Set())).toEqual([]);
    expect(pendingFor(all, null, new Set())).toEqual([]);
  });

  it("tell the host who still hasn't seen it", () => {
    const [a] = announcementsOf(
      [moment({ reactions: { [ACK]: ["a"] } })],
      people,
    );
    expect(ackLine(a, people)).toBe("1 of 3 got it · waiting on Sam, Maya");
    const [done] = announcementsOf(
      [moment({ reactions: { [ACK]: ["a", "b", "c"] } })],
      people,
    );
    expect(ackLine(done, people)).toBe("Everyone got it.");
    expect(ackLine(a, [people[0]])).toBe("Nobody else is on the night yet.");
  });

  it("only take a link that is https or Passport's own page", () => {
    expect(hrefSchema.safeParse("https://maps.apple.com/?q=x").success).toBe(
      true,
    );
    expect(hrefSchema.safeParse("/passport/abc").success).toBe(true);
    expect(hrefSchema.safeParse("http://x.test").success).toBe(false);
    expect(hrefSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(hrefSchema.safeParse("//evil.test").success).toBe(false);
  });

  it("are an action only with a known tag and some words", () => {
    expect(
      ActionSchema.safeParse({
        type: "announce",
        tag: "venue",
        text: "Boston Pizza instead.",
      }).success,
    ).toBe(true);
    expect(
      ActionSchema.safeParse({ type: "announce", tag: "panic", text: "x" })
        .success,
    ).toBe(false);
    expect(
      ActionSchema.safeParse({ type: "announce", tag: "venue", text: "  " })
        .success,
    ).toBe(false);
  });
});

describe("replies", () => {
  it("say which line they answer, by its id, when it is on the page", () => {
    const lines = [
      {
        id: "x",
        by: "a",
        text: "Who's bringing the flag?",
        kind: "note" as const,
      },
    ];
    expect(repliedTo(lines, "x")?.by).toBe("a");
    expect(repliedTo(lines, "gone")).toBeUndefined();
    expect(repliedTo(lines, undefined)).toBeUndefined();
  });

  it("quote one tidy line of it", () => {
    expect(quoteOf("  so\n\nmany   lines ")).toBe("so many lines");
    expect(quoteOf("a".repeat(100), 20)).toHaveLength(20);
    expect(quoteOf("a".repeat(100), 20).endsWith("…")).toBe(true);
  });

  it("ride on the say action", () => {
    expect(
      ActionSchema.safeParse({
        type: "say",
        text: "Me.",
        replyTo: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(true);
    expect(
      ActionSchema.safeParse({ type: "say", text: "Me.", replyTo: "nope" })
        .success,
    ).toBe(false);
  });
});

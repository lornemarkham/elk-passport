import { describe, expect, it } from "vitest";
import { memoryNights, NIGHT_TTL_SECONDS, type NightStore } from "./store";
import {
  act,
  createNight,
  hashToken,
  isCode,
  joinNight,
  leaveNight,
  newCode,
  openNight,
} from "./service";
import type { PlayView } from "@/domain/date-night/connect/session";

async function twoPhones(
  store: NightStore,
  mode: "know" | "figure" | "surprise" = "figure",
  questions: string[] = [],
) {
  const made = await createNight(store, {
    mode,
    stage: "first",
    phones: 2,
    name: "Alex",
    questions,
  });
  if (!made.ok) throw new Error(made.error);
  const joined = await joinNight(store, made.code, { name: "Sam" });
  if (!joined.ok) throw new Error(joined.error);
  return { code: made.code, a: made.token, b: joined.token };
}

const view = async (
  s: NightStore,
  code: string,
  token: string | null,
  as?: 1 | 2,
) => (await openNight(s, code, token, as)) as PlayView;

/** Move the night on until a card of this kind is on the table. */
async function until(
  s: NightStore,
  code: string,
  token: string,
  kind: string,
): Promise<PlayView> {
  for (let i = 0; i < 40; i++) {
    const v = await view(s, code, token);
    if (v.card.kind === kind) return v;
    await act(s, code, token, undefined, { type: "next", from: v.index });
  }
  throw new Error(`no ${kind} card in 40`);
}

describe("codes and tokens", () => {
  it("makes unguessable 16-character codes", () => {
    const codes = new Set(Array.from({ length: 500 }, newCode));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(isCode(c)).toBe(true);
  });
  it("rejects anything that is not a code", () => {
    for (const bad of [
      "",
      "abc",
      "A".repeat(16),
      "../../x",
      "0".repeat(17),
      null,
      3,
    ])
      expect(isCode(bad)).toBe(false);
  });
  it("never keeps a token, only its hash", async () => {
    const store = memoryNights();
    const { code, a } = await twoPhones(store);
    const fields = (await store.load(code))!;
    expect(JSON.stringify(fields)).not.toContain(a);
    expect(fields.p1).toContain(hashToken(a));
  });
});

describe("inviting", () => {
  it("opening the link takes no seat; it shows only the mode and the host's name", async () => {
    const store = memoryNights();
    const made = await createNight(store, {
      mode: "know",
      stage: "married",
      phones: 2,
      name: "Alex",
      questions: ["Secret one?"],
    });
    if (!made.ok) throw new Error();
    const first = await openNight(store, made.code, null);
    const again = await openNight(store, made.code, null);
    expect(first).toEqual({
      status: "invite",
      code: made.code,
      mode: "know",
      host: "Alex",
    });
    expect(again).toEqual(first);
    const text = JSON.stringify(first);
    expect(text).not.toContain("married"); // the stage is theirs to share
    expect(text).not.toContain("Secret one");
  });

  it("gives the one open seat to one person only", async () => {
    const store = memoryNights();
    const made = await createNight(store, {
      mode: "know",
      stage: "first",
      phones: 2,
    });
    if (!made.ok) throw new Error();
    const [x, y] = await Promise.all([
      joinNight(store, made.code, { name: "X" }),
      joinNight(store, made.code, { name: "Y" }),
    ]);
    expect([x.ok, y.ok].sort()).toEqual([false, true]);
    expect(await openNight(store, made.code, null)).toEqual({ status: "full" });
  });

  it("answers an unknown code the same way as an expired one", async () => {
    let t = 0;
    const store = memoryNights(() => t);
    const made = await createNight(store, {
      mode: "know",
      stage: "first",
      phones: 2,
    });
    if (!made.ok) throw new Error();
    expect(await openNight(store, newCode(), null)).toEqual({ status: "gone" });
    t += NIGHT_TTL_SECONDS * 1000 + 1;
    expect(await openNight(store, made.code, made.token)).toEqual({
      status: "gone",
    });
  });

  it("refuses a stranger's token and a made-up one", async () => {
    const store = memoryNights();
    const { code } = await twoPhones(store);
    const v = await openNight(store, code, "not-a-token");
    expect(v.status).toBe("full");
  });

  it("rejects bad input at the door", async () => {
    const store = memoryNights();
    expect(
      await createNight(store, { mode: "x", stage: "first", phones: 2 }),
    ).toMatchObject({ ok: false });
    expect(
      await createNight(store, { mode: "know", stage: "x", phones: 2 }),
    ).toMatchObject({ ok: false });
    expect(
      await createNight(store, { mode: "know", stage: "first", phones: 3 }),
    ).toMatchObject({ ok: false });
  });
});

describe("private answers, shared reveals", () => {
  it("a Would You Rather stays private until both have chosen", async () => {
    const s = memoryNights();
    const { code, a, b } = await twoPhones(s);
    const v = await until(s, code, a, "wyr");
    if (v.card.kind !== "wyr") throw new Error();

    await act(s, code, a, undefined, { type: "answer", value: 1 });
    const mineA = await view(s, code, a);
    const mineB = await view(s, code, b);
    if (mineA.card.kind !== "wyr" || mineB.card.kind !== "wyr")
      throw new Error();
    expect(mineA.card.mine).toBe(1);
    expect(mineA.card.revealed).toBe(false);
    expect(mineB.card.mine).toBeNull();
    expect(mineB.card.theirs).toBeNull(); // Alex's pick is not on Sam's phone
    expect(mineB.card.needs).toEqual([2]);

    await act(s, code, b, undefined, { type: "answer", value: 0 });
    const after = (await view(s, code, a)).card;
    if (after.kind !== "wyr") throw new Error();
    expect(after.revealed).toBe(true);
    expect(after.mine).toBe(1);
    expect(after.theirs).toBe(0);
  });

  it("cannot answer twice, out of turn, or with nonsense", async () => {
    const s = memoryNights();
    const { code, a } = await twoPhones(s);
    await until(s, code, a, "wyr");
    expect(
      await act(s, code, a, undefined, { type: "answer", value: 7 }),
    ).toMatchObject({ ok: false });
    expect(
      await act(s, code, a, undefined, { type: "answer", value: 0 }),
    ).toMatchObject({ ok: true });
    expect(
      await act(s, code, a, undefined, { type: "answer", value: 1 }),
    ).toMatchObject({ ok: false, status: 409 });
  });

  it("Two Truths: the lie is not sent to the guesser until they guess", async () => {
    const s = memoryNights();
    const { code, a, b } = await twoPhones(s);
    const v = await until(s, code, a, "truths");
    if (v.card.kind !== "truths") throw new Error();
    const writer = v.card.writer === 1 ? a : b;
    const guesser = v.card.writer === 1 ? b : a;

    // the guesser can't go first
    expect(
      await act(s, code, guesser, undefined, { type: "answer", value: 0 }),
    ).toMatchObject({ ok: false });
    expect(
      await act(s, code, writer, undefined, {
        type: "answer",
        value: {
          s: ["I rode a camel", "I met Dolly Parton", "I can juggle"],
          lie: 1,
        },
      }),
    ).toMatchObject({ ok: true });

    const gSees = await openNight(s, code, guesser);
    const wSees = await openNight(s, code, writer);
    expect(JSON.stringify(gSees)).toContain("Dolly Parton");
    const gc = (gSees as PlayView).card;
    const wc = (wSees as PlayView).card;
    if (gc.kind !== "truths" || wc.kind !== "truths") throw new Error();
    expect(gc.lie).toBeNull();
    expect(wc.lie).toBe(1);

    await act(s, code, guesser, undefined, { type: "answer", value: 2 });
    const done = ((await openNight(s, code, guesser)) as PlayView).card;
    if (done.kind !== "truths") throw new Error();
    expect(done.revealed).toBe(true);
    expect(done.lie).toBe(1);
    expect(done.guess).toBe(2);
  });

  it("Guess My Answer: the asker's pick stays hidden until the guess", async () => {
    const s = memoryNights();
    const { code, a, b } = await twoPhones(s);
    const v = await until(s, code, a, "guess");
    if (v.card.kind !== "guess") throw new Error();
    const asker = v.card.asker === 1 ? a : b;
    const guesser = v.card.asker === 1 ? b : a;
    await act(s, code, asker, undefined, { type: "answer", value: 3 });
    const g = ((await openNight(s, code, guesser)) as PlayView).card;
    if (g.kind !== "guess") throw new Error();
    expect(g.chosen).toBe(true);
    expect(g.answer).toBeNull();
    await act(s, code, guesser, undefined, { type: "answer", value: 0 });
    const r = ((await openNight(s, code, guesser)) as PlayView).card;
    if (r.kind !== "guess") throw new Error();
    expect(r.answer).toBe(3);
  });

  it("answers are deleted when the night moves on", async () => {
    const s = memoryNights();
    const { code, a, b } = await twoPhones(s);
    const v = await until(s, code, a, "wyr");
    await act(s, code, a, undefined, { type: "answer", value: 0 });
    await act(s, code, b, undefined, { type: "answer", value: 0 });
    await act(s, code, a, undefined, { type: "next", from: v.index });
    const fields = (await s.load(code))!;
    expect(Object.keys(fields).filter((k) => k.startsWith("a:"))).toEqual([]);
  });

  it("a double tap on Next moves one card, not two", async () => {
    const s = memoryNights();
    const { code, a, b } = await twoPhones(s, "know");
    const v = await view(s, code, a);
    await Promise.all([
      act(s, code, a, undefined, { type: "next", from: v.index }),
      act(s, code, b, undefined, { type: "next", from: v.index }),
    ]);
    expect((await view(s, code, a)).index).toBe(1);
    expect((await view(s, code, b)).card.id).toBe(
      (await view(s, code, a)).card.id,
    );
  });

  it("both picking the same tagged option becomes a shared interest, and only that", async () => {
    const s = memoryNights();
    const { code, a, b } = await twoPhones(s, "figure");
    for (let i = 0; i < 30; i++) {
      const v = await view(s, code, a);
      if (v.card.kind === "wyr") {
        const pick = 0;
        await act(s, code, a, undefined, { type: "answer", value: pick });
        await act(s, code, b, undefined, { type: "answer", value: pick });
      }
      await act(s, code, a, undefined, { type: "next", from: v.index });
    }
    const v = await view(s, code, a);
    expect(v.shared.length).toBeGreaterThan(0);
    const fields = (await s.load(code))!;
    expect(
      Object.keys(fields).some(
        (k) => k.startsWith("a:") && k !== `a:${v.index}:1`,
      ),
    ).toBe(false);
  });
});

describe("a person's own questions", () => {
  it("are never on the other phone until they are asked", async () => {
    const s = memoryNights();
    const { code, a, b } = await twoPhones(s, "know", [
      "What scares you most?",
      "Zebra-secret?",
      "",
    ]);
    await act(s, code, b, undefined, {
      type: "questions",
      list: ["Would you move abroad?", "", ""],
    });

    for (let i = 0; i < 3; i++) {
      const vb = await view(s, code, b);
      const va = await view(s, code, a);
      const bText = JSON.stringify(vb);
      const aText = JSON.stringify(va);
      // Sam never sees Alex's unasked words; Alex never sees Sam's.
      if (!vb.card.id.startsWith("q:1"))
        expect(bText).not.toContain("Zebra-secret");
      expect(vb.mine.join("|")).toContain("Would you move abroad?");
      expect(va.mine.join("|")).not.toContain("Would you move abroad?");
      if (!va.card.id.startsWith("q:2"))
        expect(aText).not.toContain("Would you move abroad?");
      await act(s, code, a, undefined, { type: "next", from: va.index });
    }
  });

  it("are asked of the other person, and shown to both", async () => {
    const s = memoryNights();
    const { code, a, b } = await twoPhones(s, "know", [
      "What scares you most?",
    ]);
    const v = await until(s, code, b, "custom");
    if (v.card.kind !== "custom") throw new Error();
    expect(v.card.text).toBe("What scares you most?");
    expect(v.card.from).toBe(1);
    expect(((await view(s, code, a)).card as { text: string }).text).toBe(
      "What scares you most?",
    );
  });

  it("can be edited until asked, and then stay as asked", async () => {
    const s = memoryNights();
    const { code, a } = await twoPhones(s, "know", ["First", "", ""]);
    await until(s, code, a, "custom");
    await act(s, code, a, undefined, {
      type: "questions",
      list: ["Changed", "New second", ""],
    });
    const v = await view(s, code, a);
    expect(v.mine[0]).toBe("First");
    expect(v.mine[1]).toBe("New second");
  });

  it("are trimmed, capped at three and at 160 characters", async () => {
    const s = memoryNights();
    const { code, a } = await twoPhones(s);
    await act(s, code, a, undefined, {
      type: "questions",
      list: ["  hi\u0000\n  there ", "x".repeat(400), "c", "fourth"],
    });
    const v = await view(s, code, a);
    expect(v.mine).toHaveLength(3);
    expect(v.mine[0]).toBe("hi there");
    expect(v.mine[1]).toHaveLength(160);
  });
});

describe("changing modes and stage mid-date", () => {
  it("either person can; the next card follows, the asked ones stay", async () => {
    const s = memoryNights();
    const { code, a, b } = await twoPhones(s, "know");
    const before = await view(s, code, a);
    await act(s, code, b, undefined, { type: "mode", mode: "figure" });
    expect((await view(s, code, a)).mode).toBe("figure");
    expect((await view(s, code, a)).card.id).toBe(before.card.id);
    await act(s, code, a, undefined, { type: "next", from: before.index });
    expect(["wyr", "guess", "likely", "truths", "tod"]).toContain(
      (await view(s, code, a)).card.kind,
    );
    expect(
      await act(s, code, a, undefined, { type: "mode", mode: "nope" }),
    ).toMatchObject({ ok: false });
    expect(
      await act(s, code, a, undefined, { type: "stage", stage: "married" }),
    ).toMatchObject({ ok: true });
  });
});

describe("leaving", () => {
  it("takes that person's answers and questions, and ends their access", async () => {
    const s = memoryNights();
    const { code, a, b } = await twoPhones(s, "know", ["Private ask?"]);
    await act(s, code, b, undefined, {
      type: "questions",
      list: ["Sam private?", "", ""],
    });
    expect(await leaveNight(s, code, b)).toBe(true);
    const fields = JSON.stringify(await s.load(code));
    expect(fields).not.toContain("Sam private");
    expect(fields).toContain("Private ask"); // Alex's own stay with Alex
    expect(await openNight(s, code, b)).toEqual({ status: "full" });
    const v = await view(s, code, a);
    expect(v.left).toEqual({ 1: false, 2: true });
    // nothing needing both is dealt any more
    for (let i = 0; i < 12; i++) {
      const cur = await view(s, code, a);
      await act(s, code, a, undefined, { type: "next", from: cur.index });
    }
    expect(["talk", "tod", "custom"]).toContain(
      (await view(s, code, a)).card.kind,
    );
  });

  it("deletes the whole night when the last person goes", async () => {
    const s = memoryNights();
    const { code, a, b } = await twoPhones(s);
    await leaveNight(s, code, a);
    expect(await s.load(code)).not.toBeNull();
    await leaveNight(s, code, b);
    expect(await s.load(code)).toBeNull();
    expect(await openNight(s, code, a)).toEqual({ status: "gone" });
  });

  it("a stranger cannot leave someone else's night", async () => {
    const s = memoryNights();
    const { code } = await twoPhones(s);
    expect(await leaveNight(s, code, "guess")).toBe(false);
    expect(await leaveNight(s, code, null)).toBe(false);
    expect(await s.load(code)).not.toBeNull();
  });
});

describe("one phone, two people", () => {
  it("hands the phone over between answers and keeps each answer private", async () => {
    const s = memoryNights();
    const made = await createNight(s, {
      mode: "figure",
      stage: "newly",
      phones: 1,
      name: "Alex",
      guestName: "Sam",
    });
    if (!made.ok) throw new Error();
    let v = await until(s, made.code, made.token, "wyr");
    expect(v.acting).toBe(1);
    expect(v.names).toEqual({ 1: "Alex", 2: "Sam" });
    await act(s, made.code, made.token, 1, { type: "answer", value: 0 });
    v = await view(s, made.code, made.token);
    expect(v.acting).toBe(2);
    expect(v.me).toBe(2);
    const c = v.card;
    if (c.kind !== "wyr") throw new Error();
    expect(c.theirs).toBeNull(); // the phone is Sam's now; Alex's pick is hidden
    await act(s, made.code, made.token, 2, { type: "answer", value: 1 });
    v = await view(s, made.code, made.token);
    expect(v.acting).toBeNull();
    if (v.card.kind !== "wyr") throw new Error();
    expect(v.card.revealed).toBe(true);
  });

  it("is never open to an invitation", async () => {
    const s = memoryNights();
    const made = await createNight(s, {
      mode: "know",
      stage: "first",
      phones: 1,
    });
    if (!made.ok) throw new Error();
    expect(await openNight(s, made.code, null)).toEqual({ status: "full" });
    expect(await joinNight(s, made.code, {})).toEqual({
      ok: false,
      error: "full",
    });
  });
});

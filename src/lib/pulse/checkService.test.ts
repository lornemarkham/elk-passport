import { beforeEach, describe, expect, it } from "vitest";
import type { CheckSource } from "./check";
import { sealSource } from "./checkSeal";
import {
  CONFIRMATIONS,
  POSTS_PER_PULSE_PER_DAY,
  addPost,
  analyse,
  checkShelves,
  correctCheck,
  createCheck,
  isCheckCreator,
  postToken,
  reportPost,
  type Stores,
} from "./checkService";
import { memoryCheckStore } from "./checkStore";
import {
  ballotToken,
  castVote,
  createPulse,
  forgetCachedVotes,
  newDevice,
  snapshot,
} from "./service";
import { memoryStore } from "./store";

const KEY = "test-key-for-pulse-check-0123456789";
let clock = new Date("2026-11-18T18:00:00Z");
const tick = (ms: number) => (clock = new Date(clock.getTime() + ms));
let stores: Stores;

const KGH = "Kelowna General Hospital is operating at 147% capacity.";
const ALL_CONFIRMED = Object.fromEntries(
  Object.keys(CONFIRMATIONS).map((k) => [k, true]),
);

beforeEach(() => {
  clock = new Date("2026-11-18T18:00:00Z");
  const pulses = memoryStore(() => clock);
  stores = { pulses, checks: memoryCheckStore(pulses, () => clock) };
  forgetCachedVotes();
});

function source(over: Partial<CheckSource> = {}): CheckSource {
  return {
    url: "https://www.interiorhealth.ca/news/occupancy",
    title: "Hospital occupancy update",
    site: "Interior Health",
    published: "2026-11-14",
    readAt: clock.toISOString(),
    excerpts: [
      "On November 14, Kelowna General Hospital was at 147 per cent of its funded capacity.",
    ],
    figureFound: true,
    ...over,
  };
}

const placed = (s: CheckSource, stance: string, note?: string) => ({
  sealed: sealSource(KEY, s),
  stance,
  note,
});

async function publish(
  over: Record<string, unknown> = {},
  who = { device: newDevice(), ip: "ip:10.0.0.1" },
) {
  return createCheck(
    stores,
    KEY,
    {
      claim: {
        text: KGH,
        form: "screenshot",
        seenOn: "facebook",
        url: "https://www.facebook.com/share/p/abc",
      },
      why: "I saw this on Facebook. Is the hospital really operating at 147% capacity?",
      scope: { kind: "city", province: "BC", city: "Kelowna" },
      ask: "fact",
      sources: [placed(source(), "supports")],
      assessment: "supported",
      confirm: ALL_CONFIRMED,
      openedAt: clock.getTime() - 60_000,
      ...over,
    },
    { ...who, now: clock },
  );
}

describe("publishing a Pulse Check", () => {
  it("keeps the claim, the asker's words and the evidence apart, with a poll", async () => {
    const r = await publish();
    if (!r.ok) throw new Error(r.message);
    expect(r.pulse.kind).toBe("check");
    expect(r.pulse.question).toBe(
      "Having read the sources, what do you think they show?",
    );
    expect(r.pulse.options.map((o) => o.label)).toContain("Unsure");
    expect(r.check.claim.text).toBe(KGH);
    expect(r.check.why).toMatch(/^I saw this on Facebook/);
    expect(r.check.sources[0]!.excerpts[0]).toMatch(/147 per cent/);
    expect(r.check.sources[0]!.stance).toBe("supports");
    expect(r.check.assessment).toBe("supported");
    expect(r.check.suggested).toBe("supported");
    expect(r.check.slug).toBe(
      `kelowna-general-hospital-is-operating-at-147-capacity-${r.pulse.id}`,
    );
    const stored = await stores.checks.get(r.pulse.id);
    expect(stored?.version).toBe(1);
  });

  it("defaults to insufficient evidence when nothing was read", async () => {
    const r = await publish({ sources: [], assessment: undefined });
    if (!r.ok) throw new Error(r.message);
    expect(r.check.assessment).toBe("insufficient");
  });

  it("refuses a source the server didn't read", async () => {
    const forged = Buffer.from(
      JSON.stringify(source({ excerpts: ["It is at 300%."] })),
    ).toString("base64url");
    const r = await publish({
      sources: [
        {
          sealed: `${forged}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
          stance: "supports",
        },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("sources");
  });

  it("refuses an assessment the sources don't back", async () => {
    const r = await publish({ assessment: "contradicted" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("assessment");
  });

  it("needs every confirmation before anything is public", async () => {
    const r = await publish({
      confirm: { ...ALL_CONFIRMED, publicSubject: false },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("confirm");
  });

  it("refuses personal details in the claim or the reason", async () => {
    const a = await publish({
      claim: { text: "Call 250-555-0199 — the hospital is full", form: "text" },
    });
    expect(a.ok).toBe(false);
    const b = await publish({
      why: "My neighbour was diagnosed with cancer and waited.",
    });
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.field).toBe("why");
  });

  it("refuses a form filled faster than a person", async () => {
    const r = await publish({ openedAt: clock.getTime() - 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("bot");
  });

  it("keeps a screenshot privately, and only a real picture", async () => {
    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(400),
    ]);
    const ok = await publish({ file: jpeg.toString("base64") });
    if (!ok.ok) throw new Error(ok.message);
    expect(ok.check.hasFile).toBe(true);
    expect((await stores.checks.file(ok.pulse.id))?.mime).toBe("image/jpeg");
    const svg = await publish({
      file: Buffer.from("<svg onload=alert(1)>").toString("base64"),
    });
    expect(svg.ok).toBe(false);
    const big = await publish({
      file: Buffer.alloc(1_600_000, 1).toString("base64"),
    });
    expect(big.ok).toBe(false);
  });

  it("lets an opinion poll ask its own question, and adds Unsure", async () => {
    const r = await publish({
      ask: "opinion",
      question: "Is the hospital over capacity?",
      options: ["Yes", "No"],
    });
    if (!r.ok) throw new Error(r.message);
    expect(r.pulse.question).toBe("Is the hospital over capacity?");
    expect(r.pulse.options.map((o) => o.label)).toEqual([
      "Yes",
      "No",
      "Unsure",
    ]);
  });

  it("can't be made through the plain Pulse form", async () => {
    const r = await createPulse(
      stores.pulses,
      KEY,
      {
        kind: "check",
        question: "Is this true at all?",
        options: ["Yes", "No"],
        openedAt: clock.getTime() - 10_000,
      },
      { device: newDevice(), ip: "ip:1", now: clock },
    );
    expect(r.ok).toBe(false);
  });

  it("is voted on with People's Pulse's own rules, and a vote decides nothing", async () => {
    const r = await publish();
    if (!r.ok) throw new Error(r.message);
    const voter = newDevice();
    const v = await castVote(
      stores.pulses,
      KEY,
      r.pulse.id,
      {
        option: "o3",
        ballot: ballotToken(KEY, r.pulse.id, new Date(clock.getTime() - 5_000)),
      },
      { device: voter, ip: "ip:2", now: clock },
    );
    expect(v.ok).toBe(true);
    const again = await castVote(
      stores.pulses,
      KEY,
      r.pulse.id,
      {
        option: "o1",
        ballot: ballotToken(KEY, r.pulse.id, new Date(clock.getTime() - 5_000)),
      },
      { device: voter, ip: "ip:2", now: clock },
    );
    expect(again.ok && again.outcome).toBe("duplicate");
    const snap = await snapshot(
      stores.pulses,
      KEY,
      r.pulse.id,
      voter,
      clock,
      false,
    );
    expect(snap?.total).toBe(1);
    // The evidence assessment is untouched by any number of votes.
    expect((await stores.checks.get(r.pulse.id))?.check.assessment).toBe(
      "supported",
    );
  });
});

describe("finding the same claim", () => {
  it("names a check already made for the same claim", async () => {
    const r = await publish();
    if (!r.ok) throw new Error(r.message);
    const a = await analyse(stores.checks, {
      claim: "Is Kelowna General Hospital operating at 147% capacity?",
    });
    if ("error" in a) throw new Error(a.error);
    expect(a.duplicates.map((d) => d.slug)).toEqual([r.check.slug]);
    const b = await analyse(stores.checks, {
      claim: "Vernon Jubilee Hospital is at 120% capacity today.",
    });
    if ("error" in b) throw new Error(b.error);
    expect(b.duplicates).toEqual([]);
  });
});

describe("corrections", () => {
  it("only the asker's browser can correct, and every correction is kept", async () => {
    const asker = { device: newDevice(), ip: "ip:10.0.0.1" };
    const r = await publish({}, asker);
    if (!r.ok) throw new Error(r.message);
    expect(
      await isCheckCreator(stores.checks, KEY, r.pulse.id, asker.device),
    ).toBe(true);
    const stranger = await correctCheck(
      stores,
      KEY,
      r.pulse.id,
      { note: "I think it is wrong." },
      { device: newDevice() },
      clock,
    );
    expect(stranger.ok).toBe(false);
    if (!stranger.ok) expect(stranger.error).toBe("forbidden");

    tick(86_400_000);
    const newer = source({
      url: "https://news.gov.bc.ca/releases/occupancy",
      title: "Occupancy back under 100%",
      site: "BC Gov News",
      published: "2026-11-18",
      excerpts: [
        "Kelowna General Hospital's occupancy was 98 per cent on November 18.",
      ],
      figureFound: false,
    });
    const fixed = await correctCheck(
      stores,
      KEY,
      r.pulse.id,
      {
        note: "Interior Health published newer figures.",
        sources: [placed(newer, "contradicts")],
        assessment: "partly",
      },
      { device: asker.device },
      clock,
    );
    if (!fixed.ok) throw new Error(fixed.message);
    expect(fixed.check.assessment).toBe("partly");
    expect(fixed.check.sources).toHaveLength(2);
    expect(fixed.check.corrections).toEqual([
      expect.objectContaining({
        by: "asker",
        from: "supported",
        to: "partly",
        added: ["Occupancy back under 100%"],
        note: "Interior Health published newer figures.",
      }),
    ]);
    expect((await stores.checks.get(r.pulse.id))?.version).toBe(2);

    const mod = await correctCheck(
      stores,
      KEY,
      r.pulse.id,
      { note: "Moderator: wording of the claim checked against the post." },
      "moderator",
      clock,
    );
    expect(mod.ok && mod.check.corrections.at(-1)?.by).toBe("moderator");
  });

  it("can't call something contradicted without a contradicting source", async () => {
    const asker = { device: newDevice(), ip: "ip:10.0.0.1" };
    const r = await publish({}, asker);
    if (!r.ok) throw new Error(r.message);
    const bad = await correctCheck(
      stores,
      KEY,
      r.pulse.id,
      { note: "Changed my mind about it.", assessment: "contradicted" },
      { device: asker.device },
      clock,
    );
    expect(bad.ok).toBe(false);
  });
});

describe("discussion", () => {
  async function check() {
    const r = await publish();
    if (!r.ok) throw new Error(r.message);
    return r.pulse.id;
  }
  const token = (id: string) =>
    postToken(KEY, id, new Date(clock.getTime() - 5_000));

  it("keeps experiences, questions, opinions and suggested sources apart", async () => {
    const id = await check();
    const me = { device: newDevice(), ip: "ip:3", now: clock };
    const exp = await addPost(
      stores,
      KEY,
      id,
      {
        type: "experience",
        body: "I waited nine hours in emergency there last Tuesday.",
        token: token(id),
      },
      me,
    );
    expect(exp.ok).toBe(true);
    const src = await addPost(
      stores,
      KEY,
      id,
      {
        type: "source",
        body: "The health authority posts daily numbers.",
        url: "https://www.interiorhealth.ca/x",
        token: token(id),
      },
      me,
    );
    expect(src.ok && src.post.url).toBe("https://www.interiorhealth.ca/x");
    const nourl = await addPost(
      stores,
      KEY,
      id,
      { type: "source", body: "Look it up", token: token(id) },
      me,
    );
    expect(nourl.ok).toBe(false);
    const list = await stores.checks.posts(id, null);
    expect(list.map((p) => p.type)).toEqual(["experience", "source"]);
    expect(list.every((p) => !("author" in p))).toBe(true);
  });

  it("refuses other people's health details, personal details and bots", async () => {
    const id = await check();
    const me = { device: newDevice(), ip: "ip:3", now: clock };
    const health = await addPost(
      stores,
      KEY,
      id,
      {
        type: "experience",
        body: "The nurse told me my neighbour overdosed last week.",
        token: token(id),
      },
      me,
    );
    expect(health.ok).toBe(false);
    const phone = await addPost(
      stores,
      KEY,
      id,
      { type: "comment", body: "Text me 250-555-0199", token: token(id) },
      me,
    );
    expect(phone.ok).toBe(false);
    const bot = await addPost(
      stores,
      KEY,
      id,
      { type: "comment", body: "Fake news", token: postToken(KEY, id, clock) },
      me,
    );
    expect(bot.ok).toBe(false);
    if (!bot.ok) expect(bot.error).toBe("bot");
  });

  it("limits how much one browser can post", async () => {
    const id = await check();
    const me = { device: newDevice(), ip: "ip:3", now: clock };
    for (let i = 0; i < POSTS_PER_PULSE_PER_DAY; i++)
      expect(
        (
          await addPost(
            stores,
            KEY,
            id,
            { type: "comment", body: `Comment number ${i}`, token: token(id) },
            me,
          )
        ).ok,
      ).toBe(true);
    const over = await addPost(
      stores,
      KEY,
      id,
      { type: "comment", body: "One more", token: token(id) },
      me,
    );
    expect(over.ok).toBe(false);
  });

  it("hides a post three different browsers report", async () => {
    const id = await check();
    const p = await addPost(
      stores,
      KEY,
      id,
      {
        type: "comment",
        body: "Something rude about the claim.",
        token: token(id),
      },
      { device: newDevice(), ip: "ip:3", now: clock },
    );
    if (!p.ok) throw new Error(p.message);
    const one = newDevice();
    expect(
      await reportPost(stores.checks, KEY, p.post.id, "harassment", one),
    ).toBe("ok");
    expect(
      await reportPost(stores.checks, KEY, p.post.id, "harassment", one),
    ).toBe("duplicate");
    await reportPost(stores.checks, KEY, p.post.id, "spam", newDevice());
    expect((await stores.checks.posts(id, null)).length).toBe(1);
    await reportPost(stores.checks, KEY, p.post.id, "other", newDevice());
    expect((await stores.checks.posts(id, null)).length).toBe(0);
    expect((await stores.checks.reportedPosts())[0]).toMatchObject({
      status: "hidden",
      reports: 3,
    });
  });
});

describe("discovery", () => {
  it("shelves recent, trending, local, discussed and updated checks", async () => {
    const asker = { device: newDevice(), ip: "ip:10.0.0.1" };
    const a = await publish({}, asker);
    const b = await publish({
      claim: {
        text: "Calgary transit fares are going up 25% in January.",
        form: "headline",
      },
      scope: { kind: "province", province: "AB" },
      sources: [],
      assessment: "insufficient",
    });
    if (!a.ok || !b.ok) throw new Error("publish");
    const tok = postToken(KEY, a.pulse.id, new Date(clock.getTime() - 5_000));
    await addPost(
      stores,
      KEY,
      a.pulse.id,
      { type: "question", body: "Which day was this measured?", token: tok },
      { device: newDevice(), ip: "ip:4", now: clock },
    );
    await addPost(
      stores,
      KEY,
      a.pulse.id,
      { type: "comment", body: "Hallways were full last week.", token: tok },
      { device: newDevice(), ip: "ip:5", now: clock },
    );
    await correctCheck(
      stores,
      KEY,
      a.pulse.id,
      { note: "Added the date the figure is from." },
      { device: asker.device },
      clock,
    );
    const s = checkShelves(await stores.checks.list(50), "BC");
    expect(s.recent).toHaveLength(2);
    expect(s.local.map((c) => c.pulseId)).toEqual([a.pulse.id]);
    expect(s.discussed.map((c) => c.pulseId)).toEqual([a.pulse.id]);
    expect(s.updated.map((c) => c.pulseId)).toEqual([a.pulse.id]);
    expect(s.trending.map((c) => c.pulseId)).toEqual([a.pulse.id]);
    expect(checkShelves(await stores.checks.list(50), null).local).toEqual([]);
  });
});

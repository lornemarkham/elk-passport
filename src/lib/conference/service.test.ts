import { describe, expect, it } from "vitest";
import { SYCLE_VANCOUVER_2026 } from "@/domain/conference/fixtures";
import type { ConferenceLifecycle } from "@/domain/conference/contracts";
import type { IdentityKey } from "@/domain/conference/types";
import * as svc from "./service";
import { memoryStore } from "./store";

const ORG: IdentityKey = "user:organiser";
const ANA: IdentityKey = "guest:ana";
const BEN: IdentityKey = "guest:ben";
const STRANGER: IdentityKey = "guest:stranger";

function world(now = new Date("2026-10-12T17:00:00Z")) {
  const forgotten: string[] = [];
  const arrivals: ConferenceLifecycle = {
    module: "arrivals",
    forgetMember: async (c, m) => void forgotten.push(`member:${c}:${m}`),
    forgetConference: async (c) => void forgotten.push(`conference:${c}`),
  };
  const deps = { store: memoryStore(), lifecycle: [arrivals], now };
  return {
    deps,
    forgotten,
    at: (t: string) => ({ ...deps, now: new Date(t) }),
  };
}

async function sycle(deps: svc.Deps) {
  const made = await svc.createConference(deps, ORG, SYCLE_VANCOUVER_2026);
  if (!made.ok) throw new Error(made.error);
  return made.conference.id;
}

async function memberIdOf(deps: svc.Deps, id: string, who: IdentityKey) {
  const home = await svc.homeFor(deps, who, id);
  return home!.you.memberId;
}

describe("creating", () => {
  it("makes Sycle from plain configuration, with its creator as organiser", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    const home = await svc.homeFor(deps, ORG, id);
    expect(home?.conference.name).toBe("Sycle Vancouver 2026");
    expect(home?.conference.place.townId).toBe("vancouver");
    expect(home?.you.role).toBe("organiser");
  });

  it("refuses details that don't hold together, and says why", async () => {
    const { deps } = world();
    const r = await svc.createConference(deps, ORG, {
      ...SYCLE_VANCOUVER_2026,
      endsOn: "2026-10-20",
    });
    expect(r).toMatchObject({ ok: false, error: "invalid" });
    expect(!r.ok && r.issues?.[0]?.path).toBe("endsOn");
  });

  it("starts with codes off: nobody gets in until the organiser opens a way", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    const admin = await svc.adminFor(deps, ORG, id);
    expect(admin.ok && admin.view.accessCode).toBeNull();
    expect(admin.ok && admin.view.invites).toEqual([]);
  });
});

describe("privacy", () => {
  it("answers a stranger exactly as if the conference did not exist", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    expect(await svc.homeFor(deps, STRANGER, id)).toBeNull();
    expect(await svc.homeFor(deps, STRANGER, "no-such-id")).toBeNull();
    expect(await svc.adminFor(deps, STRANGER, id)).toEqual(
      await svc.adminFor(deps, STRANGER, "no-such-id"),
    );
    expect(await svc.contextFor(deps, STRANGER, id)).toBeNull();
  });

  it("hides a new member from other members until they choose to be seen", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    const code = await svc.setAccessCode(deps, ORG, id, "new");
    await svc.joinWithCode(deps, ANA, code.ok && code.accessCode);
    await svc.joinWithCode(deps, BEN, code.ok && code.accessCode);

    let ben = await svc.homeFor(deps, BEN, id);
    expect(ben?.you.visibility).toBe("hidden");
    expect(ben?.people).toEqual({ total: 3, visible: [] });

    await svc.updateMe(deps, ANA, id, {
      displayName: "Ana",
      visibility: "members",
    });
    ben = await svc.homeFor(deps, BEN, id);
    expect(ben?.people.visible.map((p) => p.displayName)).toEqual(["Ana"]);
  });

  it("never hands a member the code, the links or anyone's identity", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    const code = await svc.setAccessCode(deps, ORG, id, "new");
    await svc.joinWithCode(deps, ANA, code.ok && code.accessCode);
    const seen = JSON.stringify(await svc.homeFor(deps, ANA, id));
    expect(seen).not.toContain(code.ok ? code.accessCode! : "x");
    expect(seen).not.toContain("guest:");
    expect(seen).not.toContain("user:");
    expect(await svc.adminFor(deps, ANA, id)).toMatchObject({
      error: "forbidden",
    });
  });

  it("won't let somebody be seen without a name to be seen by", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    const r = await svc.updateMe(deps, ORG, id, {
      displayName: " ",
      visibility: "members",
    });
    expect(r).toMatchObject({ ok: false, error: "invalid" });
  });

  it("shows organisers hidden members, marked hidden (decision D4)", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    const code = await svc.setAccessCode(deps, ORG, id, "new");
    await svc.joinWithCode(deps, ANA, code.ok && code.accessCode);
    const admin = await svc.adminFor(deps, ORG, id);
    expect(admin.ok && admin.view.members.map((m) => m.visibility)).toEqual([
      "hidden",
      "hidden",
    ]);
  });
});

describe("codes", () => {
  it("lets people in with a code typed any old way, once", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    const code = await svc.setAccessCode(deps, ORG, id, "new");
    expect(code.ok && code.accessCode).toMatch(
      /^[A-Z2-9]{3}-[A-Z2-9]{3}-[A-Z2-9]{3}$/,
    );
    const sloppy = (code.ok ? code.accessCode! : "")
      .toLowerCase()
      .replace(/-/g, " ");
    expect(await svc.joinWithCode(deps, ANA, sloppy)).toEqual({
      ok: true,
      conferenceId: id,
    });
    await svc.joinWithCode(deps, ANA, sloppy);
    expect((await svc.homeFor(deps, ANA, id))?.people.total).toBe(2);
  });

  it("stops the old code working when a new one is issued, and all codes when turned off", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    const first = await svc.setAccessCode(deps, ORG, id, "new");
    const second = await svc.setAccessCode(deps, ORG, id, "new");
    expect(
      await svc.joinWithCode(deps, ANA, first.ok && first.accessCode),
    ).toMatchObject({ error: "wrong-code" });
    await svc.setAccessCode(deps, ORG, id, "off");
    expect(
      await svc.joinWithCode(deps, BEN, second.ok && second.accessCode),
    ).toMatchObject({ error: "wrong-code" });
    expect(await svc.joinWithCode(deps, BEN, "")).toMatchObject({
      error: "wrong-code",
    });
  });

  it("only organisers set codes", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    expect(await svc.setAccessCode(deps, STRANGER, id, "new")).toMatchObject({
      error: "not-found",
    });
  });
});

describe("links", () => {
  it("says what it's an invitation to, without saying who's in", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    await svc.updateMe(deps, ORG, id, {
      displayName: "Organiser Olu",
      visibility: "members",
    });
    const link = await svc.createInvite(deps, ORG, id);
    const landing = await svc.describeInvite(
      deps,
      link.ok ? link.invite.token : "",
    );
    expect(landing?.state).toBe("valid");
    expect(landing?.conference?.name).toBe("Sycle Vancouver 2026");
    expect(JSON.stringify(landing)).not.toContain("Olu");
  });

  it("dies when revoked, expired or used up — and says nothing more", async () => {
    const { deps, at } = world();
    const id = await sycle(deps);
    const revoked = await svc.createInvite(deps, ORG, id);
    const once = await svc.createInvite(deps, ORG, id, { maxUses: 1 });
    const week = await svc.createInvite(deps, ORG, id, { expiresInDays: 7 });
    if (!revoked.ok || !once.ok || !week.ok) throw new Error();

    await svc.revokeInvite(deps, ORG, id, revoked.invite.token);
    expect(
      await svc.joinWithInvite(deps, ANA, revoked.invite.token),
    ).toMatchObject({ error: "dead-link" });
    expect(await svc.describeInvite(deps, revoked.invite.token)).toEqual({
      state: "revoked",
    });

    expect(
      await svc.joinWithInvite(deps, ANA, once.invite.token),
    ).toMatchObject({ ok: true });
    expect(
      await svc.joinWithInvite(deps, BEN, once.invite.token),
    ).toMatchObject({ error: "dead-link" });

    const later = at("2026-10-20T17:00:00Z");
    expect(
      await svc.joinWithInvite(later, BEN, week.invite.token),
    ).toMatchObject({ error: "dead-link" });
  });

  it("still takes a member home through a link that has since died", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    const link = await svc.createInvite(deps, ORG, id, { maxUses: 1 });
    if (!link.ok) throw new Error();
    await svc.joinWithInvite(deps, ANA, link.invite.token);
    expect(await svc.joinWithInvite(deps, ANA, link.invite.token)).toEqual({
      ok: true,
      conferenceId: id,
    });
  });

  it("keeps people who joined through a link after it is revoked", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    const link = await svc.createInvite(deps, ORG, id);
    if (!link.ok) throw new Error();
    await svc.joinWithInvite(deps, ANA, link.invite.token);
    await svc.revokeInvite(deps, ORG, id, link.invite.token);
    expect(await svc.homeFor(deps, ANA, id)).not.toBeNull();
  });

  it("refuses nonsense limits", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    expect(
      await svc.createInvite(deps, ORG, id, { expiresInDays: 0 }),
    ).toMatchObject({ error: "invalid" });
    expect(
      await svc.createInvite(deps, ORG, id, { maxUses: 1.5 }),
    ).toMatchObject({ error: "invalid" });
  });
});

describe("leaving and forgetting", () => {
  it("forgets a member who leaves, in every module", async () => {
    const { deps, forgotten } = world();
    const id = await sycle(deps);
    const link = await svc.createInvite(deps, ORG, id);
    await svc.joinWithInvite(deps, ANA, link.ok && link.invite.token);
    const ana = await memberIdOf(deps, id, ANA);
    expect(await svc.leave(deps, ANA, id)).toEqual({ ok: true });
    expect(await svc.homeFor(deps, ANA, id)).toBeNull();
    expect(forgotten).toEqual([`member:${id}:${ana}`]);
  });

  it("won't let the last organiser walk away from a conference with people in it", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    expect(await svc.leave(deps, ORG, id)).toMatchObject({
      error: "last-organiser",
    });
  });

  it("lets an organiser remove somebody, but not themselves by that route", async () => {
    const { deps, forgotten } = world();
    const id = await sycle(deps);
    const link = await svc.createInvite(deps, ORG, id);
    await svc.joinWithInvite(deps, ANA, link.ok && link.invite.token);
    const ana = await memberIdOf(deps, id, ANA);
    const org = await memberIdOf(deps, id, ORG);
    expect(await svc.removeMember(deps, ANA, id, org)).toMatchObject({
      error: "forbidden",
    });
    expect(await svc.removeMember(deps, ORG, id, org)).toMatchObject({
      error: "forbidden",
    });
    expect(await svc.removeMember(deps, ORG, id, ana)).toEqual({ ok: true });
    expect(await svc.homeFor(deps, ANA, id)).toBeNull();
    expect(forgotten).toContain(`member:${id}:${ana}`);
  });

  it("deletes a conference and everything every module holds about it", async () => {
    const { deps, forgotten } = world();
    const id = await sycle(deps);
    expect(await svc.deleteConference(deps, ANA, id)).toMatchObject({
      error: "not-found",
    });
    expect(await svc.deleteConference(deps, ORG, id)).toEqual({ ok: true });
    expect(await svc.homeFor(deps, ORG, id)).toBeNull();
    expect(forgotten).toEqual([`conference:${id}`]);
  });

  it("erases itself 30 days after its last day, on the next read", async () => {
    const { deps, forgotten, at } = world();
    const id = await sycle(deps); // one day, Oct 24
    expect(
      await svc.homeFor(at("2026-11-23T12:00:00Z"), ORG, id),
    ).not.toBeNull();
    expect(await svc.homeFor(at("2026-11-25T12:00:00Z"), ORG, id)).toBeNull();
    expect(forgotten).toEqual([`conference:${id}`]);
  });

  it("moves the erasure date when the organiser moves the dates", async () => {
    const { deps, at } = world();
    const id = await sycle(deps);
    await svc.updateConference(deps, ORG, id, {
      ...SYCLE_VANCOUVER_2026,
      endsOn: "2026-10-27",
    });
    expect(
      await svc.homeFor(at("2026-11-25T12:00:00Z"), ORG, id),
    ).not.toBeNull();
  });
});

describe("modules", () => {
  it("hand a module the member's context and nothing that identifies them", async () => {
    const { deps } = world();
    const id = await sycle(deps);
    const ctx = await svc.contextFor(deps, ORG, id);
    expect(ctx?.conference.id).toBe(id);
    expect(ctx?.viewer.role).toBe("organiser");
    expect(JSON.stringify(ctx)).not.toContain("user:");
    expect(JSON.stringify(ctx)).not.toContain("accessCode");
  });

  it("lists your conferences and nobody else's", async () => {
    const { deps } = world();
    await sycle(deps);
    expect((await svc.conferencesOf(deps, ORG)).map((c) => c.role)).toEqual([
      "organiser",
    ]);
    expect(await svc.conferencesOf(deps, STRANGER)).toEqual([]);
  });
});

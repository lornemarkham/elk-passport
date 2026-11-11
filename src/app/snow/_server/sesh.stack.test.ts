// @vitest-environment node
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { challengeState, champion } from "@/domain/snow/sesh/rules";
import {
  CLIP_BUCKET,
  SeshRefused,
  loadWorld,
  perform,
  seshReady,
  signedVideo,
} from "./sesh";

/**
 * **Sesh Wars against a real database**: real GoTrue accounts, real
 * PostgREST and row-level security, the proposed migration applied twice,
 * and the stack's Storage stand-in (see stack.mjs) for the files.
 *
 *   node docs/product/snow/verification/stack.mjs start
 *   SNOW_STACK_ENV=~/passport/scratch/snow-stack/env \
 *     npx vitest run src/app/snow/_server/sesh.stack.test.ts
 */
const ENV_FILE = process.env.SNOW_STACK_ENV?.replace(
  /^~/,
  process.env.HOME ?? "",
);
const env: Record<string, string> = ENV_FILE
  ? Object.fromEntries(
      fs
        .readFileSync(ENV_FILE, "utf8")
        .split("\n")
        .filter((l) => l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    )
  : {};

const client = (): SupabaseClient =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

async function signUp(name: string) {
  const db = client();
  const { data, error } = await db.auth.signUp({
    email: `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`,
    password: "correct horse battery",
  });
  if (error || !data.user) throw error ?? new Error("no user");
  return { id: data.user.id, db };
}

type Person = Awaited<ReturnType<typeof signUp>>;

async function profile(
  p: Person,
  name: string,
  ageGroup: "adult" | "youth" = "adult",
) {
  await perform(p.db, {
    type: "profile",
    name: `${name}${Math.random().toString(36).slice(2, 5)}`,
    homeMountain: "whistler-blackcomb",
    sport: "snowboard",
    division: "intermediate",
    ageGroup,
  });
}

async function upload(p: Person) {
  const path = `${p.id}/${randomUUID()}.mp4`;
  const { error } = await p.db.storage.from(CLIP_BUCKET).upload(
    path,
    new Blob([new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])], {
      type: "video/mp4",
    }),
  );
  if (error) throw error;
  return path;
}

async function post(p: Person, answerTo?: string) {
  const videoPath = await upload(p);
  return perform(
    p.db,
    {
      type: "post",
      featureId: "wb-terrain-park",
      sport: "snowboard",
      division: "intermediate",
      category: "best-style",
      caption: "Smooth one",
      media: { kind: "video", url: "x" },
      rights: true,
      openTerrain: true,
      answerTo,
    },
    { videoPath },
  );
}

const refused = (p: Promise<unknown>) =>
  expect(p).rejects.toBeInstanceOf(SeshRefused);

describe.skipIf(!ENV_FILE)("Sesh Wars (real stack)", () => {
  it("is ready, and seeds only the resorts' own parks", async () => {
    const anon = client();
    expect(await seshReady(anon)).toBe(true);
    const { world } = await loadWorld(anon, null);
    expect(world.features.map((f) => f.id).sort()).toEqual([
      "bw-halfpipe",
      "bw-telus-lxl",
      "bw-telus-sm",
      "wb-choker",
      "wb-ego",
      "wb-highest-level",
      "wb-terrain-park",
    ]);
    expect(
      world.features.every((f) => f.source?.url.startsWith("https://")),
    ).toBe(true);
  });

  it("post → challenge → votes → winner, with every rule held by Postgres", async () => {
    const ava = await signUp("ava");
    const ben = await signUp("ben");
    const cam = await signUp("cam");
    const dee = await signUp("dee");
    for (const [p, n] of [
      [ava, "Ava"],
      [ben, "Ben"],
      [cam, "Cam"],
      [dee, "Dee"],
    ] as const)
      await profile(p, n);

    // Uploading into someone else's folder is refused by the storage rule.
    const stolen = await ava.db.storage
      .from(CLIP_BUCKET)
      .upload(
        `${ben.id}/${randomUUID()}.mp4`,
        new Blob([new Uint8Array([1])], { type: "video/mp4" }),
      );
    expect(stolen.error).toBeTruthy();
    // And posting someone else's file is refused by the function.
    const bensFile = await upload(ben);
    await refused(
      perform(
        ava.db,
        {
          type: "post",
          featureId: "wb-ego",
          sport: "ski",
          division: "beginner",
          category: "best-trick",
          caption: "",
          media: { kind: "video", url: "x" },
          rights: true,
          openTerrain: true,
        },
        { videoPath: bensFile },
      ),
    );
    // Without the confirmations, nothing is posted.
    await refused(
      perform(
        ava.db,
        {
          type: "post",
          featureId: "wb-ego",
          sport: "ski",
          division: "beginner",
          category: "best-trick",
          caption: "",
          media: { kind: "video", url: "x" },
          rights: false,
          openTerrain: true,
        },
        { videoPath: await upload(ava) },
      ),
    );
    // A park the resort hasn't opened yet takes no clips.
    await refused(
      perform(
        ava.db,
        {
          type: "post",
          featureId: "bw-telus-sm",
          sport: "ski",
          division: "beginner",
          category: "best-trick",
          caption: "",
          media: { kind: "video", url: "x" },
          rights: true,
          openTerrain: true,
        },
        { videoPath: await upload(ava) },
      ),
    );

    const first = await post(ava);
    expect(first.clip).toBeTruthy();
    await refused(post(ava, first.clip)); // your own clip
    const answer = await post(ben, first.clip);
    expect(answer.challenge).toBeTruthy();
    await refused(post(ben, first.clip)); // one open challenge per clip per rider

    const ch = answer.challenge!;
    await refused(
      perform(ava.db, { type: "vote", challengeId: ch, side: "defender" }),
    );
    await perform(cam.db, {
      type: "vote",
      challengeId: ch,
      side: "challenger",
    });
    await refused(
      perform(cam.db, { type: "vote", challengeId: ch, side: "defender" }),
    );
    await perform(dee.db, {
      type: "vote",
      challengeId: ch,
      side: "challenger",
    });

    // Direct writes are impossible: no INSERT grant anywhere.
    const direct = await cam.db
      .from("passport_sesh_votes")
      .insert({ challenge_id: ch, voter_id: cam.id, side: "defender" });
    expect(direct.error).toBeTruthy();

    const { world, viewer } = await loadWorld(cam.db, cam.id);
    expect(viewer.riderId).toBe(cam.id);
    const challenge = world.challenges.find((c) => c.id === ch)!;
    expect(challengeState(world, challenge, Date.now()).tally).toEqual({
      defender: 0,
      challenger: 2,
    });
    // When it closes (24 h later), Ben takes it and is champion of the day.
    const later = Date.parse(challenge.closesAt) + 1;
    expect(challengeState(world, challenge, later).winnerRiderId).toBe(ben.id);
    expect(champion(world, later, "wb-terrain-park", "all")?.riderId).toBe(
      ben.id,
    );

    // The file plays for anyone who can see the clip, through a signed link.
    const link = await signedVideo(client(), first.clip!);
    expect(link).toBeTruthy();
    const got = await fetch(link!);
    expect(got.status).toBe(200);

    // Chirps, reactions (toggle), blocks.
    await perform(cam.db, {
      type: "chirp",
      thread: { kind: "challenge", id: ch },
      body: "Clean!",
    });
    await perform(cam.db, {
      type: "react",
      clipId: answer.clip!,
      kind: "sick",
    });
    await perform(dee.db, {
      type: "react",
      clipId: answer.clip!,
      kind: "sick",
    });
    await perform(dee.db, {
      type: "react",
      clipId: answer.clip!,
      kind: "sick",
    }); // off again
    const after = await loadWorld(client(), null);
    expect(
      after.world.reactions.filter((r) => r.clipId === answer.clip),
    ).toHaveLength(1);
    expect(after.world.chirps.some((c) => c.thread.id === ch)).toBe(true);
    await perform(ava.db, { type: "block", riderId: cam.id });
    await refused(
      perform(cam.db, {
        type: "chirp",
        thread: { kind: "clip", id: first.clip! },
        body: "hey",
      }),
    );

    // Three distinct reports hide a clip from everyone but its rider.
    for (const p of [cam, dee, ben])
      await perform(p.db, {
        type: "report",
        target: { kind: "clip", id: first.clip! },
        reason: "Spam or fake",
      });
    const hidden = await loadWorld(client(), null);
    expect(hidden.world.clips.some((c) => c.id === first.clip)).toBe(false);
    const own = await loadWorld(ava.db, ava.id);
    expect(own.world.clips.find((c) => c.id === first.clip)?.status).toBe(
      "hidden",
    );
  });

  it("protects younger riders: no public profile or clip, no adult words, same-age challenges", async () => {
    const kid = await signUp("kid");
    const adult = await signUp("adult");
    await profile(kid, "Grom", "youth");
    await profile(adult, "Big");
    const k = await post(kid);
    const anon = await loadWorld(client(), null);
    expect(anon.world.riders.some((r) => r.id === kid.id)).toBe(false);
    expect(anon.world.clips.some((c) => c.id === k.clip)).toBe(false);
    expect(await signedVideo(client(), k.clip!)).toBeNull();
    const signedIn = await loadWorld(adult.db, adult.id);
    expect(signedIn.world.clips.some((c) => c.id === k.clip)).toBe(true);
    await refused(
      perform(adult.db, {
        type: "chirp",
        thread: { kind: "clip", id: k.clip! },
        body: "nice",
      }),
    );
    await perform(adult.db, {
      type: "react",
      clipId: k.clip!,
      kind: "stomped",
    });
    await refused(post(adult, k.clip));
    // The age group is set once.
    await perform(kid.db, {
      type: "profile",
      name: `Grom${Date.now() % 1000}`,
      homeMountain: "silverstar",
      sport: "ski",
      ageGroup: "adult",
    });
    const again = await loadWorld(kid.db, kid.id);
    expect(again.world.riders.find((r) => r.id === kid.id)?.ageGroup).toBe(
      "youth",
    );
  });
});

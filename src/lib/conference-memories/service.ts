import "server-only";
import { randomBytes } from "node:crypto";
import type { ConferenceLifecycle } from "@/domain/conference/contracts";
import type { IdentityKey } from "@/domain/conference/types";
import type { MemberHome } from "@/domain/conference/views";
import {
  AddPhotoSchema,
  ALBUM_SIZE,
  albumView,
  downloadName,
  PHOTO_REACTIONS,
  type PhotoReaction,
  type PhotoView,
} from "@/domain/conference-memories/memories";
import { canSee, namedMap } from "@/domain/conference-plans/views";
import { homeFor, type Deps } from "@/lib/conference/service";
import type { PlansStore } from "@/lib/conference-plans/store";
import type { MemoriesStore } from "./store";

export interface MemoriesDeps {
  readonly conference: Deps;
  readonly store: MemoriesStore;
  readonly plans: PlansStore;
  readonly enabled: boolean;
}

type Fail = "not-found" | "forbidden" | "invalid" | "full";
export type MemoriesResult<T> =
  | ({ ok: true } & T)
  | {
      ok: false;
      error: Fail;
      issues?: readonly { path: string; message: string }[];
    };

async function member(d: MemoriesDeps, identity: IdentityKey, id: string) {
  if (!d.enabled) return null;
  const home = await homeFor(d.conference, identity, id);
  if (!home) return null;
  if (
    !home.conference.modules.includes("memories") &&
    home.you.role !== "organiser"
  )
    return null;
  return home;
}

/** Plans this member may see, by id → title: what a photo may belong to. */
async function visiblePlans(d: MemoriesDeps, home: MemberHome) {
  const plans = await d.plans.plans(home.conference.id);
  return new Map(
    plans
      .filter((p) => canSee(p, home.you.memberId))
      .map((p) => [p.id, p.title] as const),
  );
}

export interface AlbumView {
  readonly photos: readonly PhotoView[];
  readonly plans: readonly { id: string; title: string }[];
  readonly you: { readonly canAdd: boolean; readonly name: string | null };
  readonly room: number;
  readonly conferenceName: string;
}

export async function readAlbum(
  d: MemoriesDeps,
  identity: IdentityKey,
  conferenceId: string,
): Promise<AlbumView | null> {
  const home = await member(d, identity, conferenceId);
  if (!home) return null;
  const [photos, reactions, plans] = await Promise.all([
    d.store.list(conferenceId),
    d.store.reactions(conferenceId),
    visiblePlans(d, home),
  ]);
  return {
    photos: albumView(
      photos,
      reactions,
      plans,
      { memberId: home.you.memberId, role: home.you.role },
      namedMap(home.people.visible, home.you),
    ),
    plans: [...plans].map(([id, title]) => ({ id, title })),
    you: {
      canAdd: home.you.visibility === "members" && !!home.you.displayName,
      name: home.you.displayName,
    },
    room: Math.max(0, ALBUM_SIZE - photos.length),
    conferenceName: home.conference.name,
  };
}

export async function addPhoto(
  d: MemoriesDeps,
  identity: IdentityKey,
  conferenceId: string,
  input: unknown,
): Promise<MemoriesResult<{ id: string }>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return { ok: false, error: "not-found" };
  if (home.you.visibility !== "members" || !home.you.displayName)
    return {
      ok: false,
      error: "forbidden",
      issues: [
        { path: "you", message: "Choose a name and to be seen to add photos." },
      ],
    };
  const p = AddPhotoSchema.safeParse(input);
  if (!p.success)
    return {
      ok: false,
      error: "invalid",
      issues: p.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    };
  const planId = p.data.planId ?? null;
  if (planId && !(await visiblePlans(d, home)).has(planId))
    return { ok: false, error: "not-found" };
  if ((await d.store.count(conferenceId)) >= ALBUM_SIZE)
    return { ok: false, error: "full" };
  const id = randomBytes(9).toString("base64url");
  await d.store.add(
    {
      id,
      conferenceId,
      memberId: home.you.memberId,
      planId,
      caption: p.data.caption,
      at: d.conference.now.toISOString(),
    },
    p.data.data,
  );
  return { ok: true, id };
}

/** The JPEG, for a member allowed to see this photo; `null` for anyone else. */
export async function photoBytes(
  d: MemoriesDeps,
  identity: IdentityKey,
  conferenceId: string,
  photoId: string,
): Promise<{ bytes: Buffer; name: string } | null> {
  const home = await member(d, identity, conferenceId);
  if (!home) return null;
  const photo = (await d.store.list(conferenceId)).find(
    (p) => p.id === photoId,
  );
  if (!photo) return null;
  if (photo.planId && !(await visiblePlans(d, home)).has(photo.planId))
    return null;
  const data = await d.store.bytes(conferenceId, photoId);
  if (!data) return null;
  return {
    bytes: Buffer.from(data, "base64"),
    name: downloadName(home.conference.name, photo.caption, photo.id),
  };
}

export async function removePhoto(
  d: MemoriesDeps,
  identity: IdentityKey,
  conferenceId: string,
  photoId: string,
): Promise<MemoriesResult<object>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return { ok: false, error: "not-found" };
  const photo = (await d.store.list(conferenceId)).find(
    (p) => p.id === photoId,
  );
  if (!photo) return { ok: false, error: "not-found" };
  // A private plan's photo is invisible to anyone not in it, organisers too.
  if (photo.planId && !(await visiblePlans(d, home)).has(photo.planId))
    return { ok: false, error: "not-found" };
  if (photo.memberId !== home.you.memberId && home.you.role !== "organiser")
    return { ok: false, error: "forbidden" };
  await d.store.remove(conferenceId, photoId);
  return { ok: true };
}

export async function reactToPhoto(
  d: MemoriesDeps,
  identity: IdentityKey,
  conferenceId: string,
  photoId: string,
  emoji: unknown,
): Promise<MemoriesResult<object>> {
  const home = await member(d, identity, conferenceId);
  if (!home) return { ok: false, error: "not-found" };
  if (!PHOTO_REACTIONS.includes(emoji as PhotoReaction))
    return { ok: false, error: "invalid" };
  const photo = (await d.store.list(conferenceId)).find(
    (p) => p.id === photoId,
  );
  if (!photo) return { ok: false, error: "not-found" };
  // A private plan's photo is invisible to anyone not in it, organisers too.
  if (photo.planId && !(await visiblePlans(d, home)).has(photo.planId))
    return { ok: false, error: "not-found" };
  const r = {
    photoId,
    memberId: home.you.memberId,
    emoji: emoji as PhotoReaction,
  };
  const already = (await d.store.reactions(conferenceId)).some(
    (x) =>
      x.photoId === photoId && x.memberId === r.memberId && x.emoji === r.emoji,
  );
  await d.store.react(conferenceId, r, !already);
  return { ok: true };
}

export function memoriesLifecycle(
  store: () => MemoriesStore,
): ConferenceLifecycle {
  return {
    module: "memories",
    forgetMember: (c, m) => store().forgetMember(c, m),
    forgetConference: (c) => store().forgetConference(c),
  };
}

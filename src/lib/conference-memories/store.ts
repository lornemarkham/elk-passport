import type {
  Photo,
  PhotoReactionRow,
} from "@/domain/conference-memories/memories";
import { conferenceSetup } from "@/lib/conference/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseMemories } from "./supabaseStore";

/**
 * **Where the album lives.** Lists carry no pixels: the bytes are read one
 * photo at a time, by the members-only image route.
 */
export interface MemoriesStore {
  list(conferenceId: string): Promise<Photo[]>;
  count(conferenceId: string): Promise<number>;
  add(photo: Photo, data: string): Promise<void>;
  bytes(conferenceId: string, photoId: string): Promise<string | null>;
  remove(conferenceId: string, photoId: string): Promise<void>;
  reactions(conferenceId: string): Promise<PhotoReactionRow[]>;
  react(conferenceId: string, r: PhotoReactionRow, on: boolean): Promise<void>;
  forgetMember(conferenceId: string, memberId: string): Promise<void>;
  forgetConference(conferenceId: string): Promise<void>;
}

export function memoryMemories(): MemoriesStore {
  const photos = new Map<string, Map<string, { photo: Photo; data: string }>>();
  const reacts = new Map<string, PhotoReactionRow[]>();
  const album = (c: string) => {
    let m = photos.get(c);
    if (!m) photos.set(c, (m = new Map()));
    return m;
  };
  return {
    async list(c) {
      return [...album(c).values()].map((x) => x.photo);
    },
    async count(c) {
      return album(c).size;
    },
    async add(photo, data) {
      album(photo.conferenceId).set(photo.id, { photo, data });
    },
    async bytes(c, id) {
      return album(c).get(id)?.data ?? null;
    },
    async remove(c, id) {
      album(c).delete(id);
      reacts.set(
        c,
        (reacts.get(c) ?? []).filter((r) => r.photoId !== id),
      );
    },
    async reactions(c) {
      return reacts.get(c) ?? [];
    },
    async react(c, r, on) {
      const rest = (reacts.get(c) ?? []).filter(
        (x) =>
          !(
            x.photoId === r.photoId &&
            x.memberId === r.memberId &&
            x.emoji === r.emoji
          ),
      );
      reacts.set(c, on ? [...rest, r] : rest);
    },
    async forgetMember(c, memberId) {
      const a = album(c);
      for (const [id, x] of a) if (x.photo.memberId === memberId) a.delete(id);
      reacts.set(
        c,
        (reacts.get(c) ?? []).filter(
          (r) => r.memberId !== memberId && a.has(r.photoId),
        ),
      );
    },
    async forgetConference(c) {
      photos.delete(c);
      reacts.delete(c);
    },
  };
}

const g = globalThis as unknown as { __memoriesStore?: MemoriesStore };

export const memoriesStore = (): MemoriesStore => {
  const setup = conferenceSetup();
  if (setup.open && setup.config.store === "supabase")
    return supabaseMemories(createSupabaseServerClient);
  return (g.__memoriesStore ??= memoryMemories());
};

# ADR 019 — Sesh Wars keeps riders' videos in Supabase Storage

**Status:** PROPOSED (2026-11-10, Snow lane, owner brief "SESH WARS — BRING
THE MOUNTAIN TO LIFE"). Awaits the owner.

## Context

Sesh Wars is built around riders' phone videos. Passport has no media store
for user uploads. Every picture people share today (Snow photos, adventure
moments) is a data URL in a Postgres row, which works for a 300 KB photo and
does not work for video:

- a 15-second phone clip is 10–40 MB. That size in table rows would use up the
  shared Passport/Atlas database fast.
- Vercel caps a function request body at about 4.5 MB, so a clip cannot pass
  through a Passport route on its way to anywhere.

Passport has no service-role key on its server, by design (every read and
write runs as the caller).

## Decision

1. **One private Supabase Storage bucket, `sesh-wars-clips`**, in the same
   Supabase project. It allows only MP4, MOV, WebM and JPEG stills, with a
   50 MB limit per file (the free plan's own cap). It is created by the Sesh Wars
   migration (`docs/product/snow/sesh-wars-migration.sql`), and only where the
   `storage` schema exists.
2. **The phone uploads straight to Storage** with the person's own session
   (`supabase.storage.upload`). Storage policies allow writes only into a
   folder named after the person's own user id, and only once they have a
   rider profile. The clip row is then written by `passport_sesh_post`, which
   refuses any path outside the caller's folder.
3. **Playback is a one-hour signed link**, issued by
   `/snow/sesh-wars/api/video/[id]` as the caller. The read policy on the
   files follows the clips table's own row-level security, so a link exists
   only for someone who can see the clip. A taken-down clip, or a younger
   rider's clip asked for by a visitor, gets a 404.
4. **Nothing autoplays and nothing preloads.** A card shows a JPEG still
   (captured on the phone at upload). The video is fetched only after a tap.

## Consequences

- No new service, dependency or key. It is the same Supabase project, reached
  the same way.
- Storage costs belong to Passport's Supabase plan (1 GB on the free plan,
  then metered). At roughly 20 MB a clip, the free tier holds about 50 clips.
  **The owner should decide on a plan before inviting real riders.**
- No server-side transcoding or thumbnails. Clips are stored as the phone
  recorded them. An iPhone HEVC `.mov` may not play in every browser. A
  transcoding step would need a new service, and that is its own decision.
- Removing a clip row does not delete the file. Rollback leaves the bucket
  in place (see `sesh-wars-rollback.sql`).
- The local verification stack has no storage-api. `stack.mjs` stands in for
  the three calls Passport makes and enforces the same rules. Real Storage
  first runs in a deployed preview.

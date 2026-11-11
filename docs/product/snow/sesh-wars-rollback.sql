-- ROLLBACK for docs/product/snow/sesh-wars-migration.sql (Sesh Wars).
-- Destroys every Sesh Wars rider, clip row, vote and chirp. Video files in
-- the sesh-wars-clips bucket are NOT deleted by SQL: empty the bucket from
-- the Storage dashboard first if they should go too.
-- Run in the SQL editor of the Passport project, only on the owner's say-so.

BEGIN;
DO $storage$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists sesh_clips_upload on storage.objects';
    execute 'drop policy if exists sesh_clips_read_file on storage.objects';
    execute 'drop policy if exists sesh_clips_delete_own on storage.objects';
  end if;
end
$storage$;
DROP FUNCTION IF EXISTS public.passport_sesh_moderate(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.passport_sesh_propose(text, text, text, text, text);
DROP FUNCTION IF EXISTS public.passport_sesh_block(uuid);
DROP FUNCTION IF EXISTS public.passport_sesh_report(text, text, text);
DROP FUNCTION IF EXISTS public.passport_sesh_react(uuid, text);
DROP FUNCTION IF EXISTS public.passport_sesh_chirp(text, text, text);
DROP FUNCTION IF EXISTS public.passport_sesh_vote(uuid, text);
DROP FUNCTION IF EXISTS public.passport_sesh_post(text, text, text, text, text, text, text, boolean, boolean, boolean, uuid);
DROP FUNCTION IF EXISTS public.passport_sesh_profile(text, text, text, text, text);
DROP TABLE IF EXISTS public.passport_sesh_moderators, public.passport_sesh_blocks,
  public.passport_sesh_reports, public.passport_sesh_reactions, public.passport_sesh_chirps,
  public.passport_sesh_votes, public.passport_sesh_challenges, public.passport_sesh_clips,
  public.passport_sesh_features, public.passport_sesh_riders CASCADE;
DROP FUNCTION IF EXISTS public.passport_sesh_blocked(uuid, uuid);
DROP FUNCTION IF EXISTS public.passport_sesh_me();
DROP FUNCTION IF EXISTS public.passport_sesh_age(uuid);
DROP FUNCTION IF EXISTS public.passport_sesh_is_moderator();
COMMIT;
NOTIFY pgrst, 'reload schema';

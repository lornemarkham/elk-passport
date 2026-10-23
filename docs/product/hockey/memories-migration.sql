-- ============================================================================
-- PROPOSED MIGRATION — passport_occasion_photos (Hockey Night: Memories)
--
-- Proposed for: supabase/migrations/<timestamp>_passport_occasion_photos.sql
--
-- Lives in the Hockey lane for the same reason migration.sql does:
-- `supabase/migrations/` is a shared contract this lane proposes to and does
-- not change. REQUIRES migration.sql (the occasions tables and their two
-- policy helpers) first. Applied and attacked only against the local stack
-- (verification/stack.mjs), never against a real Supabase project. On the
-- shared project, paste it into the SQL editor; do not `supabase db push`
-- (supabase/README.md hazard 1).
--
-- ## What it holds
--
-- The night's photographs, one row each. The picture is a small JPEG
-- (the phone shrinks it to 1280px before sending) stored as base64 text, so
-- there is no storage bucket, no public URL and nothing to configure: a photo
-- can only be read through the app, as a member of its night.
--
-- ## Who may do what — enforced here, not in the app
--
--   read     members of the night.
--   add      a member, as themselves (user_id = auth.uid()).
--   remove   the person who added it, or the host.
--   edit     nobody: no UPDATE grant at all.
--   anon     nothing, by grant as well as by policy.
--
-- Removing a member keeps their rows and nobody can read them (the read
-- policy checks the reader's membership; the app shows members only).
--
-- Guarded (IF NOT EXISTS / do-blocks), so applying it twice changes nothing.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passport_occasion_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  caption text CHECK (caption IS NULL OR char_length(caption) <= 140),
  -- base64 of a JPEG; the cap is about 600 KB of picture.
  data text NOT NULL CHECK (char_length(data) BETWEEN 100 AND 800000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS passport_occasion_photos_by_night
  ON public.passport_occasion_photos (occasion_id, created_at DESC);

ALTER TABLE public.passport_occasion_photos ENABLE ROW LEVEL SECURITY;

-- Production applies no default grants to new public tables: say it all.
REVOKE ALL ON public.passport_occasion_photos FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_occasion_photos TO authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_photos_read') then
    create policy passport_occasion_photos_read on public.passport_occasion_photos
      for select to authenticated using (
        passport_is_occasion_member(occasion_id, auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_photos_add') then
    create policy passport_occasion_photos_add on public.passport_occasion_photos
      for insert to authenticated with check (
        user_id = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_photos_remove') then
    create policy passport_occasion_photos_remove on public.passport_occasion_photos
      for delete to authenticated using (
        (user_id = auth.uid()
          and passport_is_occasion_member(occasion_id, auth.uid()))
        or passport_occasion_role(occasion_id, auth.uid()) = 'host');
  end if;
end $$;

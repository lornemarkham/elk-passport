-- ============================================================================
-- PROPOSED MIGRATION — announcements and shared memories on the adventure core
-- Written on lane christmas (feature/christmas), 2026-11-01, for Go Have a
-- Christmas. NOT applied to any real project. NOT in supabase/migrations:
-- migrations are a shared contract, so this lane proposes it and the
-- contracts / integration owner moves it (docs/product/christmas/RELEASE.md).
--
-- WHAT THIS IS
--
-- Two capabilities every group thing needs and the core (ADR 009,
-- 20261021000000_passport_adventures.sql) does not yet have:
--
--   * passport_adventure_notices (+ _acks): an owner's announcement — "CHANGE
--     OF PLANS! Shark Club is packed, we're going to Boston Pizza" — that stays
--     at the top for each member until they say "Got it". Asked for by the
--     real Hockey Night of 2026-10-25 (owner brief M466) and by Christmas and
--     Snow (briefs M470, M471).
--   * passport_adventure_moments: what the group shares — photos, favourite
--     moments, family traditions, finished challenges.
--
-- They are CORE tables keyed by adventure_id, not a Christmas extension:
-- nothing in them knows what Christmas is. `kind` and `challenge` are open,
-- code-declared vocabularies (like passport_adventures.kind), so Hockey or Snow
-- can adopt them without a migration of their own.
--
-- WHAT THIS DECIDES, OUT LOUD
--
-- ADR 012 left "where memories live" open (D-9) and kept Done marks on the
-- device. This proposes, for adventures only, that memories a person CHOOSES
-- TO SHARE with their group live with the adventure, visible to its members
-- and nobody else. Done marks are untouched. If the owner prefers otherwise,
-- do not apply this; Christmas then says sharing is not switched on.
--
-- SECURITY MODEL (the core's, unchanged)
--
--   * RLS on every table; anon holds nothing; the app reads as the person.
--   * Members read. You post in your own name only. The owner announces;
--     everybody else may only acknowledge. You delete what you shared; the
--     owner may delete anything shared in their adventure.
--   * Column grants: nothing is ever re-homed to another adventure or
--     re-attributed to another person. Notices can only be ended, not edited.
--   * Photos are base64 JPEG text capped at 700,000 characters — the same
--     ceiling and shape as Hockey's passport_occasion_photos — shrunk in the
--     browser to 1280px before upload.
--
-- HOW TO APPLY
--
-- After 20261021000000_passport_adventures.sql. Paste into the Supabase SQL
-- editor of the Passport project. Every statement is guarded, so applying it
-- twice changes nothing. Preflight: together-preflight.sql. Undo:
-- together-rollback.sql.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passport_adventure_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9-]{1,39}$'),
  headline text NOT NULL CHECK (char_length(btrim(headline)) BETWEEN 1 AND 120),
  body text CHECK (body IS NULL OR char_length(body) <= 1000),
  atlas_ref text CHECK (atlas_ref IS NULL OR atlas_ref ~ '^[A-Za-z0-9_:.-]{1,128}$'),
  ask_ack boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The owner ends it; it then stops leading the page. Never edited.
  ended_at timestamptz
);
CREATE INDEX IF NOT EXISTS passport_adventure_notices_by_adventure
  ON public.passport_adventure_notices (adventure_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.passport_adventure_notice_acks (
  notice_id uuid NOT NULL REFERENCES public.passport_adventure_notices(id) ON DELETE CASCADE,
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  acked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, user_id)
);
CREATE INDEX IF NOT EXISTS passport_adventure_notice_acks_by_adventure
  ON public.passport_adventure_notice_acks (adventure_id);

CREATE TABLE IF NOT EXISTS public.passport_adventure_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9-]{1,39}$'),
  body text CHECK (body IS NULL OR char_length(body) <= 1000),
  photo text CHECK (photo IS NULL OR char_length(photo) <= 700000),
  -- So a list of moments can say "has a photo" without reading the bytes.
  has_photo boolean GENERATED ALWAYS AS (photo IS NOT NULL) STORED,
  challenge text CHECK (challenge IS NULL OR challenge ~ '^[a-z][a-z0-9-]{1,39}$'),
  atlas_ref text CHECK (atlas_ref IS NULL OR atlas_ref ~ '^[A-Za-z0-9_:.-]{1,128}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (body IS NOT NULL OR photo IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS passport_adventure_moments_by_adventure
  ON public.passport_adventure_moments (adventure_id, created_at);

-- Which adventure a notice belongs to, for the acks policy, without
-- recursing into the notices policy. Answers nothing about anybody.
CREATE OR REPLACE FUNCTION public.passport_adventure_notice_adventure(p_notice uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select adventure_id from passport_adventure_notices where id = p_notice;
$$;

ALTER TABLE public.passport_adventure_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_adventure_notice_acks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_adventure_moments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.passport_adventure_notices, public.passport_adventure_notice_acks,
  public.passport_adventure_moments FROM anon;
REVOKE ALL ON public.passport_adventure_notices, public.passport_adventure_notice_acks,
  public.passport_adventure_moments FROM authenticated;
-- Granted here, never inherited: production has no default grants.
GRANT SELECT, INSERT, DELETE ON public.passport_adventure_notices TO authenticated;
GRANT UPDATE (ended_at) ON public.passport_adventure_notices TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_adventure_notice_acks TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_adventure_moments TO authenticated;

REVOKE ALL ON FUNCTION public.passport_adventure_notice_adventure(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.passport_adventure_notice_adventure(uuid) TO authenticated;

DO $$
BEGIN
  -- notices: members read; the owner announces, in their own name, and may
  -- end or delete an announcement. Nobody edits one after it is sent.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_notices' AND policyname = 'passport_adventure_notices_member_read') THEN
    CREATE POLICY passport_adventure_notices_member_read ON public.passport_adventure_notices
      FOR SELECT TO authenticated USING (passport_is_adventure_member(adventure_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_notices' AND policyname = 'passport_adventure_notices_owner_announce') THEN
    CREATE POLICY passport_adventure_notices_owner_announce ON public.passport_adventure_notices
      FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid() AND passport_is_adventure_owner(adventure_id) AND ended_at IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_notices' AND policyname = 'passport_adventure_notices_owner_end') THEN
    CREATE POLICY passport_adventure_notices_owner_end ON public.passport_adventure_notices
      FOR UPDATE TO authenticated
      USING (passport_is_adventure_owner(adventure_id))
      WITH CHECK (passport_is_adventure_owner(adventure_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_notices' AND policyname = 'passport_adventure_notices_owner_delete') THEN
    CREATE POLICY passport_adventure_notices_owner_delete ON public.passport_adventure_notices
      FOR DELETE TO authenticated USING (passport_is_adventure_owner(adventure_id));
  END IF;

  -- acks: members read (so the owner sees who has it); you acknowledge for
  -- yourself only, a notice of an adventure you are in.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_notice_acks' AND policyname = 'passport_adventure_notice_acks_member_read') THEN
    CREATE POLICY passport_adventure_notice_acks_member_read ON public.passport_adventure_notice_acks
      FOR SELECT TO authenticated USING (passport_is_adventure_member(adventure_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_notice_acks' AND policyname = 'passport_adventure_notice_acks_own_write') THEN
    CREATE POLICY passport_adventure_notice_acks_own_write ON public.passport_adventure_notice_acks
      FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid()
        AND passport_is_adventure_member(adventure_id)
        AND passport_adventure_notice_adventure(notice_id) = adventure_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_notice_acks' AND policyname = 'passport_adventure_notice_acks_own_delete') THEN
    CREATE POLICY passport_adventure_notice_acks_own_delete ON public.passport_adventure_notice_acks
      FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;

  -- moments: members read; you share in your own name; you delete yours, the
  -- owner may delete anything in their adventure. Never edited or re-homed.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_moments' AND policyname = 'passport_adventure_moments_member_read') THEN
    CREATE POLICY passport_adventure_moments_member_read ON public.passport_adventure_moments
      FOR SELECT TO authenticated USING (passport_is_adventure_member(adventure_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_moments' AND policyname = 'passport_adventure_moments_member_share') THEN
    CREATE POLICY passport_adventure_moments_member_share ON public.passport_adventure_moments
      FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid() AND passport_is_adventure_member(adventure_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_moments' AND policyname = 'passport_adventure_moments_delete') THEN
    CREATE POLICY passport_adventure_moments_delete ON public.passport_adventure_moments
      FOR DELETE TO authenticated USING (
        (user_id = auth.uid() AND passport_is_adventure_member(adventure_id))
        OR passport_is_adventure_owner(adventure_id));
  END IF;
END $$;

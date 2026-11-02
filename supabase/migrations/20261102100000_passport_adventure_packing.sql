-- ============================================================================
-- MIGRATION — a shared packing list on the adventure core
-- Written for "The Markham Adventure" (Date Night), 2026-11-01.
--
-- A checklist every member of an adventure can read, add to and tick. It is a
-- CORE table keyed by adventure_id: nothing in it knows what a Date Night is.
--
-- SECURITY MODEL (the core's, unchanged): RLS on; anon holds nothing; members
-- read; you add in your own name; any member may tick or untick (it is a
-- shared list); only the column pair (checked_by, checked_at) can change, so an
-- item is never re-homed or renamed; you remove what you added, the owner may
-- remove anything.
--
-- Apply in the Supabase SQL editor (never `supabase db push`) AFTER
-- 20261021000000_passport_adventures.sql. Guarded: applying twice changes
-- nothing. Rollback: drop table public.passport_adventure_packing;
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passport_adventure_packing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 80),
  position integer NOT NULL DEFAULT 0,
  added_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_adventure_packing_by_adventure
  ON public.passport_adventure_packing (adventure_id, position);

ALTER TABLE public.passport_adventure_packing ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.passport_adventure_packing FROM anon;
REVOKE ALL ON public.passport_adventure_packing FROM authenticated;
-- Granted here, never inherited: production has no default grants.
GRANT SELECT, INSERT, DELETE ON public.passport_adventure_packing TO authenticated;
GRANT UPDATE (checked_by, checked_at) ON public.passport_adventure_packing TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_packing' AND policyname = 'passport_adventure_packing_member_read') THEN
    CREATE POLICY passport_adventure_packing_member_read ON public.passport_adventure_packing
      FOR SELECT TO authenticated USING (passport_is_adventure_member(adventure_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_packing' AND policyname = 'passport_adventure_packing_member_add') THEN
    CREATE POLICY passport_adventure_packing_member_add ON public.passport_adventure_packing
      FOR INSERT TO authenticated WITH CHECK (
        added_by = auth.uid() AND passport_is_adventure_member(adventure_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_packing' AND policyname = 'passport_adventure_packing_member_tick') THEN
    CREATE POLICY passport_adventure_packing_member_tick ON public.passport_adventure_packing
      FOR UPDATE TO authenticated
      USING (passport_is_adventure_member(adventure_id))
      WITH CHECK (passport_is_adventure_member(adventure_id)
        AND (checked_by IS NULL OR checked_by = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_packing' AND policyname = 'passport_adventure_packing_delete') THEN
    CREATE POLICY passport_adventure_packing_delete ON public.passport_adventure_packing
      FOR DELETE TO authenticated USING (
        (added_by = auth.uid() AND passport_is_adventure_member(adventure_id))
        OR passport_is_adventure_owner(adventure_id));
  END IF;
END $$;

-- PostgREST only sees a new table once its schema cache reloads; without
-- this, the API answers PGRST205 ("not in the schema cache") although the
-- table exists (SHARED-ADVENTURE.md §1). Harmless to run again.
NOTIFY pgrst, 'reload schema';

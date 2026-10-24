-- ============================================================================
-- MIGRATION — passport_adventure_items.origin
-- 2026-10-23, Make Adventures Extraordinary (ADR 012). NOT applied to any real
-- project yet; see docs/product/adventures/RELEASE.md.
--
-- WHAT THIS IS
--
-- Who put an item on an adventure: a person (`person`, every row that exists
-- today) or Passport's sketch of a day (`passport`). It decides one thing:
-- when a later version of a day leaves a stop out, a Passport suggestion that
-- nobody kept is deleted, and anything a person chose goes back to the ideas
-- (ADR 010 §3, ADR 012 §2).
--
-- SECURITY
--
--   * Additive; existing rows become `person`, which keeps today's behaviour.
--   * INSERT on items is already granted table-wide, so `origin` can be set
--     when a row is written. UPDATE stays column by column and does NOT
--     include `origin`: nobody can relabel a row afterwards.
--   * A restrictive policy means only the adventure's owner may write a
--     `passport` row. A participant's insert stays `person`.
--   * Nothing is granted to anon.
--
-- IDEMPOTENT: safe to run twice.
--
-- ROLLBACK
--
--   DROP POLICY IF EXISTS passport_adventure_items_origin_owner
--     ON public.passport_adventure_items;
--   ALTER TABLE public.passport_adventure_items DROP COLUMN IF EXISTS origin;
--
-- The app reads and writes `origin` only when it exists (store.ts), so
-- rolling back returns it to ADR 010's behaviour without a deploy.
-- ============================================================================

ALTER TABLE public.passport_adventure_items
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'person';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'passport_adventure_items_origin_check'
  ) THEN
    ALTER TABLE public.passport_adventure_items
      ADD CONSTRAINT passport_adventure_items_origin_check
      CHECK (origin IN ('person', 'passport'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'passport_adventure_items'
      AND policyname = 'passport_adventure_items_origin_owner'
  ) THEN
    CREATE POLICY passport_adventure_items_origin_owner
      ON public.passport_adventure_items
      AS RESTRICTIVE
      FOR INSERT TO authenticated
      WITH CHECK (origin = 'person' OR passport_is_adventure_owner(adventure_id));
  END IF;
END
$$;

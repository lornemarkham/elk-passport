-- ============================================================================
-- MIGRATION — a person's own memories of an adventure, private, on any device
-- Written on lane daybuilder (ship/after-you-choose), 2026-11-10, for the
-- owner brief "GO HAVE A DAY — AFTER YOU CHOOSE" (Lodge mission 694).
--
-- WHAT THIS IS
--
-- ADR 014 / 20261101000000_passport_adventure_together.sql made the memories a
-- person CHOOSES TO SHARE live with the adventure. Everything else a person
-- keeps about a day (a photo, a few words, a favourite) stayed on the phone it
-- was taken on, so it was gone with the phone and absent from every other
-- device. This table is the private counterpart: the same three kinds, kept
-- against the person's account, readable by that person and NOBODY else.
--
-- PRIVATE MEANS PRIVATE
--
--   * Only the author reads a row. There is deliberately no member policy and
--     no owner policy: not the adventure's owner, not a co-member, not an
--     admin client. Sharing stays what it was: pressing "Share with the
--     group" copies one memory into passport_adventure_moments.
--   * You write in your own name, into an adventure you are a member of.
--   * Rows are never edited or re-homed (no UPDATE grant at all). You delete
--     your own. Leaving an adventure does not delete them: they are yours.
--   * ids are chosen by the phone (a uuid) so that a memory kept offline and
--     synced later is one memory, not two (insert is idempotent in the app).
--   * item_id is plain text with no foreign key: a stop may be moved or
--     removed from the plan later and the memory of it must survive that.
--
-- ADDITIVE ONLY. One new table, one index, policies, grants. Nothing existing
-- is altered. Until it is applied the app keeps memories on the device exactly
-- as before and says so.
--
-- HOW TO APPLY
--
-- After 20261021000000_passport_adventures.sql. Paste into the Supabase SQL
-- editor of the Passport project (never `supabase db push`). Every statement
-- is guarded; applying twice changes nothing. Undo: DROP TABLE
-- public.passport_adventure_memories; (it holds only copies of what phones
-- also keep, until a phone is lost).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passport_adventure_memories (
  id uuid PRIMARY KEY,
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('note', 'photo', 'favourite')),
  item_id text CHECK (item_id IS NULL OR item_id ~ '^[A-Za-z0-9_:.-]{1,128}$'),
  body text CHECK (body IS NULL OR char_length(body) <= 1000),
  -- Base64 JPEG, the same shape and ceiling as passport_adventure_moments.
  photo text CHECK (photo IS NULL OR char_length(photo) <= 700000),
  taken_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'photo' OR photo IS NOT NULL),
  CHECK (kind <> 'note' OR (body IS NOT NULL AND char_length(btrim(body)) > 0))
);
CREATE INDEX IF NOT EXISTS passport_adventure_memories_by_person
  ON public.passport_adventure_memories (adventure_id, user_id, taken_at);

ALTER TABLE public.passport_adventure_memories ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.passport_adventure_memories FROM anon;
REVOKE ALL ON public.passport_adventure_memories FROM authenticated;
-- Granted here, never inherited: production has no default grants.
GRANT SELECT, INSERT, DELETE ON public.passport_adventure_memories TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_memories' AND policyname = 'passport_adventure_memories_own_read') THEN
    CREATE POLICY passport_adventure_memories_own_read ON public.passport_adventure_memories
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_memories' AND policyname = 'passport_adventure_memories_own_keep') THEN
    CREATE POLICY passport_adventure_memories_own_keep ON public.passport_adventure_memories
      FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid() AND passport_is_adventure_member(adventure_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_memories' AND policyname = 'passport_adventure_memories_own_delete') THEN
    CREATE POLICY passport_adventure_memories_own_delete ON public.passport_adventure_memories
      FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

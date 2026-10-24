-- ============================================================================
-- PROPOSED MIGRATION — Hockey Night: make the night come alive
--   (the peanut gallery, and two more Chirp Bot moments about a person)
--
-- Proposed for: supabase/migrations/<timestamp>_passport_occasion_watching.sql
--
-- Lives in the Hockey lane because `supabase/migrations/` is a shared
-- contract this lane proposes to and does not change. REQUIRES migration.sql
-- and chirp-migration.sql. Applied and attacked only against the local stack
-- (verification/stack.mjs), never against a real Supabase project. On the
-- shared project, run alive-preflight.sql, then paste this into the SQL
-- editor; do not `supabase db push`.
--
-- ## What it changes — one column, one widened check. No new table.
--
-- 1. passport_occasion_members.watching — 'arena' or 'couch' (or null: not
--    said, which the page treats as going). Per night, written only by the
--    person themself (the existing self-update policy, user_id = auth.uid();
--    a new column-level UPDATE grant), read by members of the same night like
--    their name and team.
-- 2. The rule that a Chirp Bot line about a person must be written by that
--    person's own session (chirp-migration.sql: team:<id>, arrive:<id>) now
--    also covers couch:<id> (they said they're on the couch) and
--    switch:<id>:… (they moved their dinner vote). Without this, a member
--    could post "couch:<somebody else>" first and, through the unique index,
--    stop the real line about that person from ever being posted.
--
-- Additive: no row is changed or deleted. Hockey Night keeps working without
-- it: the page treats the missing column as "the couch isn't switched on
-- yet" and nobody is asked where they're watching.
--
-- Guarded (IF NOT EXISTS / do-blocks), so applying it twice changes nothing.
-- ============================================================================

ALTER TABLE public.passport_occasion_members
  ADD COLUMN IF NOT EXISTS watching text;

do $$ begin
  if not exists (select 1 from pg_constraint
                 where conname = 'passport_occasion_members_watching_check') then
    alter table public.passport_occasion_members
      add constraint passport_occasion_members_watching_check
      check (watching is null or watching in ('arena', 'couch'));
  end if;
end $$;

-- The person says where they're watching; nobody else can (RLS: user_id = auth.uid()).
GRANT UPDATE (watching) ON public.passport_occasion_members TO authenticated;

do $$ begin
  -- Widen the self-keyed rule only if it is still chirp-migration.sql's.
  if not exists (select 1 from pg_constraint
                 where conname = 'passport_occasion_moments_bot_self_check'
                   and pg_get_constraintdef(oid) like '%couch%') then
    alter table public.passport_occasion_moments
      drop constraint if exists passport_occasion_moments_bot_self_check;
    alter table public.passport_occasion_moments
      add constraint passport_occasion_moments_bot_self_check check (
        bot_key is null
        or split_part(bot_key, ':', 1) not in ('team', 'arrive', 'couch', 'switch')
        or split_part(bot_key, ':', 2) = actor_id::text) not valid;
    -- NOT VALID spares only rows written before (there are no couch/switch
    -- rows before this migration); every new row is checked.
  end if;
end $$;

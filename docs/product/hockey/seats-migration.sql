-- ============================================================================
-- PROPOSED MIGRATION — passport_occasion_seats (Hockey Night: Our Seats)
--
-- Proposed for: supabase/migrations/<timestamp>_passport_occasion_seats.sql
--
-- Lives in the Hockey lane for the same reason migration.sql does:
-- `supabase/migrations/` is a shared contract this lane proposes to and does
-- not change. REQUIRES migration.sql (the occasions tables and their two
-- policy helpers) to be applied first. Applied and attacked only against the
-- local stack (verification/stack.mjs, verification/seats-attack.mjs), never
-- against a real Supabase project. On the shared project, paste it into the
-- SQL editor; do not `supabase db push` (supabase/README.md hazard 1).
--
-- ## What it holds
--
-- Who is sitting where on a night: one row per member, and at most one row
-- for the group block (user_id IS NULL) — the seats the host bought for
-- everybody. Section, row, seats, gate, a note. Nothing about a person but
-- the seat they typed.
--
-- ## Who may do what — enforced here, not in the app
--
--   read     members of the night. A row its owner marked not shared is read
--            only by its owner and the host. The group block is read by all
--            members.
--   write    a member writes only their own row; the host writes any
--            member's row and the group block. Every write is stamped with
--            the writer (updated_by = auth.uid()), and a row can only be
--            about somebody who is a member of that same night.
--   re-home  nobody: occasion_id and user_id cannot be updated (column
--            grants), so a row cannot be moved to another night or person.
--   anon     nothing, by grant as well as by policy.
--
-- Removing a member keeps their row (as every other occasion table does)
-- and it stops being readable to anyone: the read policy checks membership
-- of the reader, and the app shows members only.
--
-- The meeting point needs no table: it is a key in passport_occasions.details,
-- which only the host may already update.
--
-- Guarded (IF NOT EXISTS / do-blocks), so applying it twice changes nothing.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passport_occasion_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  -- A member's seat, or NULL for the group block.
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  section text NOT NULL CHECK (char_length(section) BETWEEN 1 AND 12),
  row_label text CHECK (row_label IS NULL OR char_length(row_label) BETWEEN 1 AND 8),
  seats text CHECK (seats IS NULL OR char_length(seats) BETWEEN 1 AND 24),
  -- A gate number from the arena's map, or NULL for "not sure yet".
  gate text CHECK (gate IS NULL OR gate ~ '^[0-9]{1,3}$'),
  note text CHECK (note IS NULL OR char_length(note) <= 140),
  shared boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One row per person per night, and one group block (NULLs are equal here).
  CONSTRAINT passport_occasion_seats_one_each
    UNIQUE NULLS NOT DISTINCT (occasion_id, user_id)
);

ALTER TABLE public.passport_occasion_seats ENABLE ROW LEVEL SECURITY;

-- Production applies no default grants to new public tables: say it all.
GRANT SELECT, INSERT, DELETE ON public.passport_occasion_seats TO authenticated;
REVOKE UPDATE ON public.passport_occasion_seats FROM authenticated;
GRANT UPDATE (section, row_label, seats, gate, note, shared, updated_by, updated_at)
  ON public.passport_occasion_seats TO authenticated;
REVOKE ALL ON public.passport_occasion_seats FROM anon;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_seats_read') then
    create policy passport_occasion_seats_read on public.passport_occasion_seats
      for select to authenticated using (
        passport_is_occasion_member(occasion_id, auth.uid())
        and (
          shared
          or user_id is null
          or user_id = auth.uid()
          or passport_occasion_role(occasion_id, auth.uid()) = 'host'));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_seats_write') then
    create policy passport_occasion_seats_write on public.passport_occasion_seats
      for insert to authenticated with check (
        updated_by = auth.uid()
        and (
          (user_id = auth.uid()
            and passport_is_occasion_member(occasion_id, auth.uid()))
          or (passport_occasion_role(occasion_id, auth.uid()) = 'host'
            and (user_id is null
              or passport_is_occasion_member(occasion_id, user_id)))));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_seats_change') then
    create policy passport_occasion_seats_change on public.passport_occasion_seats
      for update to authenticated
      using (
        (user_id = auth.uid()
          and passport_is_occasion_member(occasion_id, auth.uid()))
        or passport_occasion_role(occasion_id, auth.uid()) = 'host')
      with check (
        updated_by = auth.uid()
        and (
          (user_id = auth.uid()
            and passport_is_occasion_member(occasion_id, auth.uid()))
          or passport_occasion_role(occasion_id, auth.uid()) = 'host'));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_seats_clear') then
    create policy passport_occasion_seats_clear on public.passport_occasion_seats
      for delete to authenticated using (
        (user_id = auth.uid()
          and passport_is_occasion_member(occasion_id, auth.uid()))
        or passport_occasion_role(occasion_id, auth.uid()) = 'host');
  end if;
end $$;

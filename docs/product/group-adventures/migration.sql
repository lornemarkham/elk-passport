-- ============================================================================
-- PROPOSED MIGRATION — passport_adventures (shared group foundation)
-- Proposed for: supabase/migrations/<timestamp>_passport_adventures.sql
-- Lane: boards, 2026-10-12. NOT applied to any real project.
--
-- WHAT THIS IS
--
-- One membership, invitation and shared-planning core for every group thing
-- Passport does: a Hockey Night, a conference, a day out, a birthday, a
-- weekend. An adventure has a `kind`; the core never learns what a kind means.
-- Kind-specific facts go in typed extension tables keyed by `adventure_id`
-- (see `passport_adventure_hockey` at the bottom for the pattern). The core
-- does not know what a flight number or a hockey game is.
--
-- Atlas owns places, events and knowledge. Nothing here copies any of it: an
-- item points at an Atlas entity by id (`atlas_ref`), so two groups can both
-- point at the same arena and stay strangers to each other.
--
-- SECURITY MODEL
--
--   * Postgres decides. Every table has RLS, `anon` holds nothing, and the
--     app talks to PostgREST as the signed-in person (anon key + their JWT).
--     No service-role key is needed by the app.
--   * Adventures and owner memberships are made ONLY by
--     `passport_create_adventure`; non-owner memberships ONLY by
--     `passport_redeem_adventure_invite`. Neither table has an INSERT policy,
--     so nobody can claim a membership by writing a row (the hole in
--     `passport_board_members_self_claim` — see README).
--   * Invite tokens are stored as SHA-256 only. The token is shown to the
--     owner once.
--   * Somebody an owner removed cannot walk back in through a link made
--     before their removal. Somebody who left on their own can.
--   * Column grants pin what each role may change: nobody re-homes an item,
--     changes their own role, or spends an invite's uses by hand.
--
-- HOW TO APPLY
--
-- Paste into the Supabase SQL editor of the Passport project. Do NOT
-- `supabase db push` from the Passport repo: the shared project's migration
-- history belongs to Atlas (supabase/README.md). Every statement is guarded,
-- so applying it twice changes nothing.
-- ============================================================================

-- ------------------------------------------------------------------ tables

CREATE TABLE IF NOT EXISTS public.passport_adventures (
  -- Text, not uuid, so existing Hockey (uuid) and Conference (12-char token)
  -- ids can be carried over unchanged. New ids are 32 random hex chars.
  id text PRIMARY KEY
    DEFAULT replace(gen_random_uuid()::text, '-', '')
    CHECK (id ~ '^[A-Za-z0-9_-]{8,64}$'),
  -- Open vocabulary, declared in code (src/lib/adventures/kinds.ts), so a new
  -- kind of adventure never needs a migration.
  kind text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9-]{1,39}$'),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Optional calendar days. Absent means nobody has said.
  starts_on date,
  ends_on date,
  time_zone text CHECK (time_zone IS NULL OR char_length(time_zone) <= 64),
  -- Optional destination, in the group's own words, plus a DiscoveryTown id
  -- so Discovery and Go Have A Day can start from there.
  destination_label text CHECK (destination_label IS NULL OR char_length(destination_label) <= 120),
  destination_town_id text CHECK (destination_town_id IS NULL OR destination_town_id ~ '^[a-z0-9-]{1,64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR starts_on IS NOT NULL),
  CHECK (ends_on IS NULL OR ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS passport_adventures_by_owner
  ON public.passport_adventures (owner_id);

CREATE TABLE IF NOT EXISTS public.passport_adventure_members (
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The only id a browser ever sees for a person. Random, never the user id.
  member_id text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  role text NOT NULL CHECK (role IN ('owner', 'participant')),
  display_name text CHECK (display_name IS NULL OR char_length(btrim(display_name)) BETWEEN 1 AND 40),
  -- 'members': other members see you on the roster. 'hidden': only you and
  -- the owner do. The kind chooses the default at join time.
  visibility text NOT NULL DEFAULT 'members' CHECK (visibility IN ('members', 'hidden')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (adventure_id, user_id),
  UNIQUE (adventure_id, member_id)
);
CREATE INDEX IF NOT EXISTS passport_adventure_members_by_user
  ON public.passport_adventure_members (user_id);

CREATE TABLE IF NOT EXISTS public.passport_adventure_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  -- hex(sha256(token)). The token itself is never stored.
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  -- A note to the owner ("for Bob"). Not an identity check.
  label text CHECK (label IS NULL OR char_length(label) <= 60),
  -- NULL = an open link, usable until revoked or expired. Otherwise 1..100.
  max_uses integer CHECK (max_uses IS NULL OR max_uses BETWEEN 1 AND 100),
  uses integer NOT NULL DEFAULT 0 CHECK (uses >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_adventure_invites_by_adventure
  ON public.passport_adventure_invites (adventure_id);

-- Who an owner removed, and when. Read only by the redeem function, so that a
-- removal is not undone by a link the removed person still holds.
CREATE TABLE IF NOT EXISTS public.passport_adventure_removals (
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  removed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (adventure_id, user_id)
);

-- The group's shared plan: Atlas things, places Atlas does not know yet,
-- proposed stops, confirmed plans and plain notes. One table, because they
-- are one list people reorder and argue about.
CREATE TABLE IF NOT EXISTS public.passport_adventure_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  -- An Atlas entity id. A pointer, never a copy: Atlas owns what it is.
  atlas_ref text CHECK (atlas_ref IS NULL OR atlas_ref ~ '^[A-Za-z0-9_:.-]{1,128}$'),
  -- The group's own words, for something Atlas does not hold (or a heading
  -- for an Atlas thing). Not knowledge about the world.
  label text CHECK (label IS NULL OR char_length(btrim(label)) BETWEEN 1 AND 120),
  note text CHECK (note IS NULL OR char_length(note) <= 1000),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'confirmed')),
  -- When, if anybody has said. A day, optionally a moment.
  on_day date,
  starts_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (atlas_ref IS NOT NULL OR label IS NOT NULL OR note IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS passport_adventure_items_by_adventure
  ON public.passport_adventure_items (adventure_id, position);
CREATE INDEX IF NOT EXISTS passport_adventure_items_by_atlas_ref
  ON public.passport_adventure_items (atlas_ref) WHERE atlas_ref IS NOT NULL;

-- A participant's answer on an item. The vocabulary is deliberately the
-- group-chat one and is PROVISIONAL: it does not answer the doctrine's open
-- question on WANTED / PLANNED / DID (§15.14).
CREATE TABLE IF NOT EXISTS public.passport_adventure_responses (
  item_id uuid NOT NULL REFERENCES public.passport_adventure_items(id) ON DELETE CASCADE,
  adventure_id text NOT NULL REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response text NOT NULL CHECK (response IN ('in', 'maybe', 'out')),
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, user_id)
);
CREATE INDEX IF NOT EXISTS passport_adventure_responses_by_adventure
  ON public.passport_adventure_responses (adventure_id);

-- ---------------------------------------------------------------- helpers
-- SECURITY DEFINER so policies can ask about membership without recursing
-- into the policies of the table they are asking about. They answer only for
-- the caller (`auth.uid()`), so they cannot be used to probe other people.

CREATE OR REPLACE FUNCTION public.passport_adventure_role(p_adventure text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select role from passport_adventure_members
  where adventure_id = p_adventure and user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.passport_is_adventure_member(p_adventure text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select passport_adventure_role(p_adventure) is not null;
$$;

CREATE OR REPLACE FUNCTION public.passport_is_adventure_owner(p_adventure text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce(passport_adventure_role(p_adventure) = 'owner', false);
$$;

CREATE OR REPLACE FUNCTION public.passport_adventure_item_adventure(p_item uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select adventure_id from passport_adventure_items where id = p_item;
$$;

CREATE OR REPLACE FUNCTION public.passport_adventure_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ------------------------------------------------------------- functions

/** Start an adventure. Anyone signed in may; they become its owner. */
CREATE OR REPLACE FUNCTION public.passport_create_adventure(
  p_kind text,
  p_title text,
  p_display_name text DEFAULT NULL,
  p_starts_on date DEFAULT NULL,
  p_ends_on date DEFAULT NULL,
  p_time_zone text DEFAULT NULL,
  p_destination_label text DEFAULT NULL,
  p_destination_town_id text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_id text;
begin
  if auth.uid() is null then
    raise exception 'sign-in required' using errcode = '28000';
  end if;

  insert into passport_adventures
    (kind, title, owner_id, starts_on, ends_on, time_zone,
     destination_label, destination_town_id)
  values
    (p_kind, btrim(p_title), auth.uid(), p_starts_on, p_ends_on, p_time_zone,
     nullif(btrim(p_destination_label), ''), p_destination_town_id)
  returning id into v_id;

  insert into passport_adventure_members (adventure_id, user_id, role, display_name)
  values (v_id, auth.uid(), 'owner', nullif(btrim(p_display_name), ''));

  return v_id;
end $$;

/**
 * What a link says to whoever holds it, signed in or not: whether it still
 * works, and what kind of thing it is for. Not the title, not the owner, not
 * who else is in — a forwarded link must not leak the group.
 */
CREATE OR REPLACE FUNCTION public.passport_describe_adventure_invite(p_token text)
RETURNS TABLE (state text, kind text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select
    case
      when i.revoked_at is not null then 'revoked'
      when i.expires_at is not null and i.expires_at <= now() then 'expired'
      when i.max_uses is not null and i.uses >= i.max_uses then 'used-up'
      else 'valid'
    end,
    a.kind
  from passport_adventure_invites i
  join passport_adventures a on a.id = i.adventure_id
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

/**
 * Join from a link. The link alone is never enough: a signed-in caller is
 * required. Following a link you are already in through changes nothing and
 * spends nothing. Returns the adventure id, or NULL for a dead link.
 */
CREATE OR REPLACE FUNCTION public.passport_redeem_adventure_invite(
  p_token text,
  p_display_name text DEFAULT NULL,
  p_visibility text DEFAULT 'members'
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_invite passport_adventure_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'sign-in required' using errcode = '28000';
  end if;

  select * into v_invite from passport_adventure_invites
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;
  if not found then return null; end if;

  if passport_is_adventure_member(v_invite.adventure_id) then
    return v_invite.adventure_id;
  end if;

  if v_invite.revoked_at is not null
     or (v_invite.expires_at is not null and v_invite.expires_at <= now())
     or (v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses) then
    return null;
  end if;

  -- Removed by the owner after this link was made: the link does not undo it.
  if exists (select 1 from passport_adventure_removals r
             where r.adventure_id = v_invite.adventure_id
               and r.user_id = auth.uid()
               and r.removed_at >= v_invite.created_at) then
    return null;
  end if;

  insert into passport_adventure_members (adventure_id, user_id, role, display_name, visibility)
  values (v_invite.adventure_id, auth.uid(), 'participant',
          nullif(btrim(p_display_name), ''),
          case when p_visibility = 'hidden' then 'hidden' else 'members' end);

  update passport_adventure_invites set uses = uses + 1 where id = v_invite.id;

  return v_invite.adventure_id;
end $$;

/**
 * When a membership goes: remember an owner's removal (not a voluntary
 * leave), and take the person's answers with them. Inside the database,
 * where deleting other people's rows is legitimate.
 */
CREATE OR REPLACE FUNCTION public.passport_adventure_member_gone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  -- Not when the whole adventure is going: there is nothing left to return to.
  if auth.uid() is not null and auth.uid() <> old.user_id
     and exists (select 1 from passport_adventures where id = old.adventure_id) then
    insert into passport_adventure_removals (adventure_id, user_id)
    values (old.adventure_id, old.user_id)
    on conflict (adventure_id, user_id) do update set removed_at = now();
  end if;
  delete from passport_adventure_responses
    where adventure_id = old.adventure_id and user_id = old.user_id;
  return old;
end $$;

-- --------------------------------------------------------------- triggers

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_adventures_touch') THEN
    CREATE TRIGGER passport_adventures_touch BEFORE UPDATE ON public.passport_adventures
      FOR EACH ROW EXECUTE FUNCTION public.passport_adventure_touch();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_adventure_items_touch') THEN
    CREATE TRIGGER passport_adventure_items_touch BEFORE UPDATE ON public.passport_adventure_items
      FOR EACH ROW EXECUTE FUNCTION public.passport_adventure_touch();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_adventure_members_gone') THEN
    CREATE TRIGGER passport_adventure_members_gone AFTER DELETE ON public.passport_adventure_members
      FOR EACH ROW EXECUTE FUNCTION public.passport_adventure_member_gone();
  END IF;
END $$;

-- ---------------------------------------------------- row level security

ALTER TABLE public.passport_adventures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_adventure_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_adventure_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_adventure_removals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_adventure_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_adventure_responses ENABLE ROW LEVEL SECURITY;

-- Signed-out visitors get nothing, by grant as well as by policy.
REVOKE ALL ON public.passport_adventures, public.passport_adventure_members,
  public.passport_adventure_invites, public.passport_adventure_removals,
  public.passport_adventure_items, public.passport_adventure_responses
  FROM anon;
-- Signed-in people get exactly what the policies below can allow, granted
-- here rather than inherited: a project's default privileges are not this
-- file's to assume (without them every call fails; with Supabase's they
-- include TRUNCATE, which RLS does not govern). Removals are the redeem
-- function's alone. INSERT on adventures and members is withheld entirely:
-- those rows come only from the functions. UPDATE is column by column.
REVOKE ALL ON public.passport_adventures, public.passport_adventure_members,
  public.passport_adventure_invites, public.passport_adventure_removals,
  public.passport_adventure_items, public.passport_adventure_responses
  FROM authenticated;
GRANT SELECT, DELETE ON public.passport_adventures TO authenticated;
GRANT UPDATE (title, starts_on, ends_on, time_zone, destination_label, destination_town_id)
  ON public.passport_adventures TO authenticated;
GRANT SELECT, DELETE ON public.passport_adventure_members TO authenticated;
GRANT UPDATE (display_name, visibility) ON public.passport_adventure_members TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_adventure_invites TO authenticated;
GRANT UPDATE (label, revoked_at, expires_at) ON public.passport_adventure_invites TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_adventure_items TO authenticated;
GRANT UPDATE (atlas_ref, label, note, status, on_day, starts_at, position)
  ON public.passport_adventure_items TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_adventure_responses TO authenticated;
GRANT UPDATE (response, answered_at) ON public.passport_adventure_responses TO authenticated;

REVOKE ALL ON FUNCTION public.passport_create_adventure(text, text, text, date, date, text, text, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_redeem_adventure_invite(text, text, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_adventure_role(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_is_adventure_member(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_is_adventure_owner(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_adventure_item_adventure(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_adventure_member_gone() FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_create_adventure(text, text, text, date, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_redeem_adventure_invite(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_describe_adventure_invite(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_adventure_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_is_adventure_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_is_adventure_owner(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_adventure_item_adventure(uuid) TO authenticated;

DO $$ BEGIN
  -- adventures: members read; the owner edits and deletes.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventures' AND policyname = 'passport_adventures_member_read') THEN
    CREATE POLICY passport_adventures_member_read ON public.passport_adventures
      FOR SELECT TO authenticated USING (passport_is_adventure_member(id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventures' AND policyname = 'passport_adventures_owner_update') THEN
    CREATE POLICY passport_adventures_owner_update ON public.passport_adventures
      FOR UPDATE TO authenticated
      USING (passport_is_adventure_owner(id)) WITH CHECK (passport_is_adventure_owner(id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventures' AND policyname = 'passport_adventures_owner_delete') THEN
    CREATE POLICY passport_adventures_owner_delete ON public.passport_adventures
      FOR DELETE TO authenticated USING (owner_id = auth.uid());
  END IF;

  -- members: you always see yourself; the owner sees everyone; members see
  -- the members who chose to be seen.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_members' AND policyname = 'passport_adventure_members_read') THEN
    CREATE POLICY passport_adventure_members_read ON public.passport_adventure_members
      FOR SELECT TO authenticated USING (
        user_id = auth.uid()
        OR passport_is_adventure_owner(adventure_id)
        OR (visibility = 'members' AND passport_is_adventure_member(adventure_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_members' AND policyname = 'passport_adventure_members_self_update') THEN
    CREATE POLICY passport_adventure_members_self_update ON public.passport_adventure_members
      FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  -- Anyone but the owner may leave; the owner removes participants. Nobody
  -- removes the owner (delete the adventure instead).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_members' AND policyname = 'passport_adventure_members_remove') THEN
    CREATE POLICY passport_adventure_members_remove ON public.passport_adventure_members
      FOR DELETE TO authenticated USING (
        role = 'participant'
        AND (user_id = auth.uid() OR passport_is_adventure_owner(adventure_id)));
  END IF;

  -- invites: the owner's business only (hashes, never tokens).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_invites' AND policyname = 'passport_adventure_invites_owner_all') THEN
    CREATE POLICY passport_adventure_invites_owner_all ON public.passport_adventure_invites
      FOR ALL TO authenticated
      USING (passport_is_adventure_owner(adventure_id))
      WITH CHECK (passport_is_adventure_owner(adventure_id) AND created_by = auth.uid() AND uses = 0);
  END IF;

  -- items: every member reads and proposes, in their own name. Only the owner
  -- confirms. The person who proposed something may change or withdraw it
  -- while it is still a proposal; the owner may change or remove anything.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_items' AND policyname = 'passport_adventure_items_member_read') THEN
    CREATE POLICY passport_adventure_items_member_read ON public.passport_adventure_items
      FOR SELECT TO authenticated USING (passport_is_adventure_member(adventure_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_items' AND policyname = 'passport_adventure_items_member_propose') THEN
    CREATE POLICY passport_adventure_items_member_propose ON public.passport_adventure_items
      FOR INSERT TO authenticated WITH CHECK (
        passport_is_adventure_member(adventure_id)
        AND added_by = auth.uid()
        AND (status = 'proposed' OR passport_is_adventure_owner(adventure_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_items' AND policyname = 'passport_adventure_items_change') THEN
    CREATE POLICY passport_adventure_items_change ON public.passport_adventure_items
      FOR UPDATE TO authenticated
      USING (passport_is_adventure_owner(adventure_id)
             OR (added_by = auth.uid() AND status = 'proposed' AND passport_is_adventure_member(adventure_id)))
      WITH CHECK (passport_is_adventure_owner(adventure_id)
             OR (added_by = auth.uid() AND status = 'proposed' AND passport_is_adventure_member(adventure_id)));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_items' AND policyname = 'passport_adventure_items_withdraw') THEN
    CREATE POLICY passport_adventure_items_withdraw ON public.passport_adventure_items
      FOR DELETE TO authenticated USING (
        passport_is_adventure_owner(adventure_id)
        OR (added_by = auth.uid() AND status = 'proposed' AND passport_is_adventure_member(adventure_id)));
  END IF;

  -- responses: members read; you answer for yourself only, on an item of an
  -- adventure you are in.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_responses' AND policyname = 'passport_adventure_responses_member_read') THEN
    CREATE POLICY passport_adventure_responses_member_read ON public.passport_adventure_responses
      FOR SELECT TO authenticated USING (passport_is_adventure_member(adventure_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_responses' AND policyname = 'passport_adventure_responses_own_write') THEN
    CREATE POLICY passport_adventure_responses_own_write ON public.passport_adventure_responses
      FOR INSERT TO authenticated WITH CHECK (
        user_id = auth.uid()
        AND passport_is_adventure_member(adventure_id)
        AND passport_adventure_item_adventure(item_id) = adventure_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_responses' AND policyname = 'passport_adventure_responses_own_change') THEN
    CREATE POLICY passport_adventure_responses_own_change ON public.passport_adventure_responses
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid() AND passport_is_adventure_member(adventure_id))
      WITH CHECK (user_id = auth.uid() AND passport_is_adventure_member(adventure_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_responses' AND policyname = 'passport_adventure_responses_own_delete') THEN
    CREATE POLICY passport_adventure_responses_own_delete ON public.passport_adventure_responses
      FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- ===================================================== typed extension: hockey
--
-- THE PATTERN every kind follows. One row per adventure, keyed by its id,
-- cascading with it; members read, the owner writes. The core tables above
-- never change for it. A kind that needs per-person facts (a conference's
-- flights) adds a table keyed (adventure_id, user_id) with "your own row"
-- policies instead — see README "Conference".

CREATE TABLE IF NOT EXISTS public.passport_adventure_hockey (
  adventure_id text PRIMARY KEY REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  -- Puck drop, once somebody knows it.
  puck_drop timestamptz,
  home_team text CHECK (home_team IS NULL OR char_length(home_team) <= 60),
  away_team text CHECK (away_team IS NULL OR char_length(away_team) <= 60),
  -- The arena: an Atlas entity when Atlas holds it, the group's words when
  -- it does not (Rogers Arena is not an Atlas entity today).
  arena_atlas_ref text CHECK (arena_atlas_ref IS NULL OR arena_atlas_ref ~ '^[A-Za-z0-9_:.-]{1,128}$'),
  arena_label text CHECK (arena_label IS NULL OR char_length(arena_label) <= 120),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.passport_adventure_hockey ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.passport_adventure_hockey FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passport_adventure_hockey TO authenticated;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'passport_adventure_hockey_touch') THEN
    CREATE TRIGGER passport_adventure_hockey_touch BEFORE UPDATE ON public.passport_adventure_hockey
      FOR EACH ROW EXECUTE FUNCTION public.passport_adventure_touch();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_hockey' AND policyname = 'passport_adventure_hockey_member_read') THEN
    CREATE POLICY passport_adventure_hockey_member_read ON public.passport_adventure_hockey
      FOR SELECT TO authenticated USING (passport_is_adventure_member(adventure_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'passport_adventure_hockey' AND policyname = 'passport_adventure_hockey_owner_write') THEN
    CREATE POLICY passport_adventure_hockey_owner_write ON public.passport_adventure_hockey
      FOR ALL TO authenticated
      USING (passport_is_adventure_owner(adventure_id))
      WITH CHECK (passport_is_adventure_owner(adventure_id)
        AND EXISTS (SELECT 1 FROM public.passport_adventures a
                    WHERE a.id = adventure_id AND a.kind = 'hockey-night'));
  END IF;
END $$;

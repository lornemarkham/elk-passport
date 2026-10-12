-- ============================================================================
-- passport_conferences (Go Have A Conference, real people)
--
-- STATUS: written and attacked locally only. NOT applied to any real project.
-- Owner steps: docs/products/go-have-a-conference/LABS-RELEASE.md.
--
-- Apply by pasting into the Supabase SQL editor. Do NOT `supabase db push`:
-- this project's migration history belongs to Atlas (supabase/README.md,
-- hazard 1). Verified against local PostgreSQL + GoTrue + PostgREST
-- (scripts/conference-stack/): 68 attacks at PostgREST as real signed-in users.
--
-- ## Security model (same as Hockey Night's occasions, different tables)
--
-- The server talks to PostgREST as the signed-in person: anon key + their own
-- session, never the service role. So RLS is not a backstop behind the app, it
-- is what the app sees. Under Supabase's default grants (anon and
-- authenticated hold ALL on new public tables) a member who calls PostgREST
-- directly with their own JWT has exactly the authority the app gives them.
--
--  * Not a member  -> every table reads as empty. Existence never leaks.
--  * Hidden member -> their row is readable by themselves and organisers only.
--                     Other members get a headcount, not a name.
--  * Organiser     -> sees everyone, edits details, makes codes and links.
--  * Way in        -> only SECURITY DEFINER functions that need a signed-in
--                     caller. A code or link alone never admits anybody.
--  * Guests        -> there are none here. Every identity is an auth.users row.
--
-- Why not Hockey's passport_occasion_* tables: one host, single-use links, no
-- codes, no visibility choice, no retention. Conference needs all four. The
-- two should converge on one membership model later (ROADMAP), but not by
-- stretching either to fit the other on the way to a deadline.
--
-- Guarded like the baseline: applying it twice changes nothing.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passport_conferences (
  id           text PRIMARY KEY CHECK (char_length(id) BETWEEN 8 AND 64),
  details      jsonb NOT NULL CHECK (pg_column_size(details) < 16384),
  created_by   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  retain_until timestamptz NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Its own table so an ordinary member can never read it, even directly.
CREATE TABLE IF NOT EXISTS public.passport_conference_codes (
  conference_id text PRIMARY KEY REFERENCES public.passport_conferences(id) ON DELETE CASCADE,
  code          text NOT NULL CHECK (code ~ '^[A-Z0-9-]{6,20}$'),
  code_key      text NOT NULL UNIQUE      -- case, spaces and dashes removed
);

CREATE TABLE IF NOT EXISTS public.passport_conference_members (
  conference_id text NOT NULL REFERENCES public.passport_conferences(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The only id browsers and modules ever see. Random, never the user id.
  member_id     text NOT NULL CHECK (char_length(member_id) BETWEEN 8 AND 64),
  role          text NOT NULL CHECK (role IN ('organiser', 'member')),
  display_name  text CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 40),
  visibility    text NOT NULL DEFAULT 'hidden' CHECK (visibility IN ('hidden', 'members')),
  joined_at     timestamptz NOT NULL DEFAULT now(),
  via           text NOT NULL CHECK (via IN ('created', 'code', 'link')),
  PRIMARY KEY (conference_id, user_id),
  UNIQUE (conference_id, member_id),
  CHECK (visibility <> 'members' OR display_name IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS passport_conference_members_user
  ON public.passport_conference_members (user_id);

CREATE TABLE IF NOT EXISTS public.passport_conference_invites (
  token         text PRIMARY KEY CHECK (char_length(token) >= 32),
  conference_id text NOT NULL REFERENCES public.passport_conferences(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  revoked_at    timestamptz,
  max_uses      integer CHECK (max_uses IS NULL OR max_uses >= 1),
  uses          integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS passport_conference_invites_conference
  ON public.passport_conference_invites (conference_id);

-- --------------------------------------------------------------- helpers
--
-- SECURITY DEFINER so policies can ask about membership without recursing into
-- the policies of the table they are asking about.

CREATE OR REPLACE FUNCTION public.passport_conference_role(p_conference text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select role from passport_conference_members
  where conference_id = p_conference and user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.passport_conference_is_member(p_conference text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select passport_conference_role(p_conference) is not null;
$$;

CREATE OR REPLACE FUNCTION public.passport_conference_is_organiser(p_conference text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select passport_conference_role(p_conference) = 'organiser';
$$;

CREATE OR REPLACE FUNCTION public.passport_conference_has_members(p_conference text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (select 1 from passport_conference_members where conference_id = p_conference);
$$;

-- ------------------------------------------------------------- functions

/** Everyone in it, hidden people included, named by nobody. Members only. */
CREATE OR REPLACE FUNCTION public.passport_conference_headcount(p_conference text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select case when passport_conference_is_member(p_conference)
    then (select count(*)::integer from passport_conference_members where conference_id = p_conference)
    else null end;
$$;

/**
 * What a link says to somebody holding it (signed in or not): whether it
 * works, and what it is an invitation to. The link is a credential the
 * organiser handed out. Never who else is in.
 */
CREATE OR REPLACE FUNCTION public.passport_conference_describe_invite(p_token text)
RETURNS TABLE (state text, details jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select
    case
      when i.revoked_at is not null then 'revoked'
      when i.expires_at is not null and i.expires_at <= now() then 'expired'
      when i.max_uses is not null and i.uses >= i.max_uses then 'used-up'
      else 'valid'
    end,
    case
      when i.revoked_at is null
       and (i.expires_at is null or i.expires_at > now())
       and (i.max_uses is null or i.uses < i.max_uses)
       and c.retain_until > now()
      then c.details else null end
  from passport_conference_invites i
  join passport_conferences c on c.id = i.conference_id
  where i.token = p_token and c.retain_until > now();
$$;

/**
 * Join from a link. Needs a signed-in caller. Idempotent: somebody already in
 * is let through even on a dead link and spends no use. Returns the
 * conference id, or null when the link does not work.
 */
CREATE OR REPLACE FUNCTION public.passport_conference_redeem_invite(p_token text, p_member_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_invite passport_conference_invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'sign-in required' using errcode = '28000';
  end if;

  select i.* into v_invite from passport_conference_invites i
  join passport_conferences c on c.id = i.conference_id
  where i.token = p_token and c.retain_until > now()
  for update of i;
  if not found then return null; end if;

  if passport_conference_is_member(v_invite.conference_id) then
    return v_invite.conference_id;
  end if;

  if v_invite.revoked_at is not null
     or (v_invite.expires_at is not null and v_invite.expires_at <= now())
     or (v_invite.max_uses is not null and v_invite.uses >= v_invite.max_uses) then
    return null;
  end if;

  insert into passport_conference_members (conference_id, user_id, member_id, role, via)
  values (v_invite.conference_id, auth.uid(), p_member_id, 'member', 'link');
  update passport_conference_invites set uses = uses + 1 where token = p_token;
  return v_invite.conference_id;
end;
$$;

/** Join with a typed code. Idempotent. Null when no conference has that code. */
CREATE OR REPLACE FUNCTION public.passport_conference_redeem_code(p_code text, p_member_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_id text;
begin
  if auth.uid() is null then
    raise exception 'sign-in required' using errcode = '28000';
  end if;

  select k.conference_id into v_id from passport_conference_codes k
  join passport_conferences c on c.id = k.conference_id
  where k.code_key = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
    and c.retain_until > now();
  if v_id is null then return null; end if;

  if not passport_conference_is_member(v_id) then
    insert into passport_conference_members (conference_id, user_id, member_id, role, via)
    values (v_id, auth.uid(), p_member_id, 'member', 'code');
  end if;
  return v_id;
end;
$$;

/** Is this code taken? Organisers ask before issuing one; reveals nothing else. */
CREATE OR REPLACE FUNCTION public.passport_conference_code_taken(p_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select auth.uid() is not null and exists (
    select 1 from passport_conference_codes
    where code_key = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')));
$$;

/**
 * Delete a conference and everything about it (cascade). An organiser may at
 * any time; anybody signed in may once it is past its retention date, which is
 * how "expired means gone" works without a privileged key.
 */
CREATE OR REPLACE FUNCTION public.passport_conference_remove(p_conference text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if auth.uid() is null then
    raise exception 'sign-in required' using errcode = '28000';
  end if;
  if passport_conference_is_organiser(p_conference)
     or exists (select 1 from passport_conferences where id = p_conference and retain_until <= now()) then
    delete from passport_conferences where id = p_conference;
    return true;
  end if;
  return false;
end;
$$;

/** Expired conferences the caller is in (so purge-on-read can find them). */
CREATE OR REPLACE FUNCTION public.passport_conference_expired()
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select c.id from passport_conferences c
  where c.retain_until <= now() and passport_conference_is_member(c.id);
$$;

-- ----------------------------------------------------- row level security

ALTER TABLE public.passport_conferences        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_codes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_invites ENABLE ROW LEVEL SECURITY;

-- Signed-out visitors get nothing, by grant as well as by policy.
REVOKE ALL ON public.passport_conferences, public.passport_conference_codes,
  public.passport_conference_members, public.passport_conference_invites
  FROM anon;

-- What may change, by whom. Nobody re-homes a row, escalates a role, or
-- spends an invite by hand.
REVOKE UPDATE ON public.passport_conferences FROM authenticated;
GRANT UPDATE (details, retain_until, updated_at) ON public.passport_conferences TO authenticated;
REVOKE UPDATE ON public.passport_conference_members FROM authenticated;
GRANT UPDATE (display_name, visibility) ON public.passport_conference_members TO authenticated;
REVOKE UPDATE ON public.passport_conference_invites FROM authenticated;
GRANT UPDATE (revoked_at) ON public.passport_conference_invites TO authenticated;
REVOKE UPDATE ON public.passport_conference_codes FROM authenticated;
-- Conferences are removed only through passport_conference_remove.
REVOKE DELETE ON public.passport_conferences FROM authenticated;

REVOKE ALL ON FUNCTION public.passport_conference_role(text),
  public.passport_conference_is_member(text),
  public.passport_conference_is_organiser(text),
  public.passport_conference_has_members(text),
  public.passport_conference_headcount(text),
  public.passport_conference_redeem_invite(text, text),
  public.passport_conference_redeem_code(text, text),
  public.passport_conference_code_taken(text),
  public.passport_conference_remove(text),
  public.passport_conference_expired(),
  public.passport_conference_describe_invite(text)
  FROM anon, public;
GRANT EXECUTE ON FUNCTION public.passport_conference_role(text),
  public.passport_conference_is_member(text),
  public.passport_conference_is_organiser(text),
  public.passport_conference_has_members(text),
  public.passport_conference_headcount(text),
  public.passport_conference_redeem_invite(text, text),
  public.passport_conference_redeem_code(text, text),
  public.passport_conference_code_taken(text),
  public.passport_conference_remove(text),
  public.passport_conference_expired()
  TO authenticated;
-- A link works as a credential for somebody not signed in yet. Purge-on-read
-- also runs for them; with no session it is a member of nothing and finds none.
GRANT EXECUTE ON FUNCTION public.passport_conference_describe_invite(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_conference_expired() TO anon;

do $$ begin
  -- conferences
  if not exists (select 1 from pg_policies where policyname = 'passport_conferences_read') then
    create policy passport_conferences_read on public.passport_conferences
      for select to authenticated
      using (passport_conference_is_member(id) or created_by = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conferences_create') then
    create policy passport_conferences_create on public.passport_conferences
      for insert to authenticated with check (created_by = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conferences_organiser_update') then
    create policy passport_conferences_organiser_update on public.passport_conferences
      for update to authenticated
      using (passport_conference_is_organiser(id))
      with check (passport_conference_is_organiser(id));
  end if;

  -- codes: organisers only, every way
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_codes_organiser') then
    create policy passport_conference_codes_organiser on public.passport_conference_codes
      for all to authenticated
      using (passport_conference_is_organiser(conference_id))
      with check (passport_conference_is_organiser(conference_id));
  end if;

  -- members: you, organisers (everyone), and anyone who chose to be seen
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_members_read') then
    create policy passport_conference_members_read on public.passport_conference_members
      for select to authenticated
      using (
        user_id = auth.uid()
        or passport_conference_is_organiser(conference_id)
        or (visibility = 'members' and passport_conference_is_member(conference_id))
      );
  end if;
  -- The creator becomes the first organiser, once. Everyone else enters
  -- through the redeem functions.
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_members_found') then
    create policy passport_conference_members_found on public.passport_conference_members
      for insert to authenticated
      with check (
        user_id = auth.uid() and role = 'organiser' and via = 'created'
        and exists (select 1 from passport_conferences c
                    where c.id = conference_id and c.created_by = auth.uid())
        and not passport_conference_has_members(conference_id)
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_members_self_update') then
    create policy passport_conference_members_self_update on public.passport_conference_members
      for update to authenticated
      using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  -- Leave, or (organiser) remove somebody else.
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_members_leave') then
    create policy passport_conference_members_leave on public.passport_conference_members
      for delete to authenticated
      using (user_id = auth.uid() or passport_conference_is_organiser(conference_id));
  end if;

  -- invites: organisers only
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_invites_organiser') then
    create policy passport_conference_invites_organiser on public.passport_conference_invites
      for all to authenticated
      using (passport_conference_is_organiser(conference_id))
      with check (passport_conference_is_organiser(conference_id));
  end if;
end $$;

-- Retention, belt for the app's braces (purge-on-read). With pg_cron:
--   SELECT cron.schedule('conference-expiry', '0 * * * *',
--     $$DELETE FROM public.passport_conferences WHERE now() >= retain_until$$);
-- Module tables must cascade from passport_conferences or register a
-- ConferenceLifecycle; preferably both.

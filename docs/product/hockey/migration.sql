-- ============================================================================
-- PROPOSED MIGRATION — passport_occasions (Hockey Night, M216)
--
-- Proposed for: supabase/migrations/<timestamp>_passport_occasions.sql
--
-- This file lives in the Hockey lane (docs/product/hockey/) because
-- `supabase/migrations/` is a shared contract this lane may propose to but not
-- change. It has been applied and attacked against a real local PostgreSQL +
-- GoTrue + PostgREST (docs/product/hockey/verification/), never against a real
-- Supabase project. See supabase/README.md hazard 1 before applying it: on the
-- shared project, paste it into the SQL editor; do not `supabase db push`.
--
-- ## What an occasion is
--
-- A private, shared, invite-only thing a group does together: Sycle Hockey
-- Night first, and by construction any later group outing, concert or
-- birthday. "Occasion" rather than "experience" because the doctrine already
-- uses Experience for October/Christmas/Skiing/Hockey as *products*, and
-- Atlas already has an Experience entity kind. The name is provisional.
--
-- ## The security model, in one paragraph
--
-- Every row belongs to one occasion, and nobody who is not a member of that
-- occasion can read or write anything about it — enforced here, by RLS, under
-- explicit grants (below: production does NOT apply Supabase's default grants
-- to new public tables — see 20261016000000_passport_conference_grants.sql),
-- so a member talking to PostgREST directly with their own JWT has exactly the
-- authority the app gives them and no more. Members write only rows that carry
-- their own `auth.uid()`. Sealed answers are sealed in the database: whether
-- one member may read another's answer is decided by the prompt's rules row,
-- which only the host (template prompts) or the asker (their own question)
-- writes. Invitation tokens are stored only as SHA-256 hashes, are redeemed
-- only through a SECURITY DEFINER function that requires a signed-in caller,
-- and are never readable by anyone but the host.
--
-- Guarded like the baseline (IF NOT EXISTS / CREATE OR REPLACE / do-blocks),
-- so applying it twice changes nothing.
-- ============================================================================

-- ------------------------------------------------------------------ tables

CREATE TABLE IF NOT EXISTS public.passport_occasions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Which code-side template supplies the content (phases, prompts, blocks,
  -- wording). e.g. 'sycle-hockey-night'.
  template text NOT NULL CHECK (char_length(template) BETWEEN 1 AND 80),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  starts_at timestamptz NOT NULL,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Template parameters: opponent, venue line, etc. Never people.
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(details) < 8192),
  -- The curator's four taps (lab `Brief`). Null until the host says.
  brief jsonb CHECK (brief IS NULL OR pg_column_size(brief) < 4096),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.passport_occasion_members (
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('host', 'guest')),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  emoji text NOT NULL DEFAULT '🙂' CHECK (char_length(emoji) BETWEEN 1 AND 16),
  hue smallint NOT NULL DEFAULT 200 CHECK (hue BETWEEN 0 AND 360),
  vibe text CHECK (vibe IS NULL OR char_length(vibe) <= 80),
  -- My own ceiling (lab `myEdge`). Never shown to anybody else.
  edge smallint CHECK (edge IS NULL OR edge BETWEEN 0 AND 3),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (occasion_id, user_id)
);
CREATE INDEX IF NOT EXISTS passport_occasion_members_by_user
  ON public.passport_occasion_members (user_id);

CREATE TABLE IF NOT EXISTS public.passport_occasion_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  -- hex(sha256(token)). The token itself is shown to the host once and never stored.
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  -- Who the host meant it for. A note to the host, not an identity check.
  label text CHECK (label IS NULL OR char_length(label) <= 60),
  max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses BETWEEN 1 AND 50),
  uses integer NOT NULL DEFAULT 0 CHECK (uses >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_occasion_invites_by_occasion
  ON public.passport_occasion_invites (occasion_id);

-- Every question the occasion can ask, and the rules that decide who may see
-- whose answer. Template prompts carry `content IS NULL` (their wording lives
-- in code); prompts people asked carry their content here.
CREATE TABLE IF NOT EXISTS public.passport_occasion_prompts (
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  prompt_id text NOT NULL CHECK (prompt_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  reveal text NOT NULL CHECK (reveal IN ('immediate', 'onLock', 'onCue', 'never')),
  -- Minutes after starts_at at which answers stop being accepted. Null = never locks.
  lock_offset_minutes integer,
  audience_only uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  open_to_suggestions boolean NOT NULL DEFAULT false,
  asked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content jsonb CHECK (content IS NULL OR pg_column_size(content) < 8192),
  -- The truth, once somebody with the standing to say it has said it.
  resolution jsonb CHECK (resolution IS NULL OR pg_column_size(resolution) < 1024),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (occasion_id, prompt_id)
);

CREATE TABLE IF NOT EXISTS public.passport_occasion_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id uuid NOT NULL,
  prompt_id text NOT NULL,
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  detail text CHECK (detail IS NULL OR char_length(detail) <= 160),
  -- An Atlas place, when the option is a real place: id, name, coordinates,
  -- and how far it is with its basis ('straight-line' or 'routed').
  place jsonb CHECK (place IS NULL OR pg_column_size(place) < 4096),
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (occasion_id, prompt_id)
    REFERENCES public.passport_occasion_prompts(occasion_id, prompt_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.passport_occasion_responses (
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  -- Either a prompt id, or `<prompt id>::<suffix>` for a question derived
  -- from other people's answers; the rules are the base prompt's.
  prompt_id text NOT NULL CHECK (prompt_id ~ '^[A-Za-z0-9_-]{1,64}(::[A-Za-z0-9_-]{1,64})?$'),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value jsonb NOT NULL CHECK (pg_column_size(value) < 2048),
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (occasion_id, prompt_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.passport_occasion_consents (
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  prompt_id text NOT NULL CHECK (char_length(prompt_id) <= 140),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreed boolean NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (occasion_id, prompt_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.passport_occasion_cues (
  occasion_id uuid NOT NULL,
  prompt_id text NOT NULL,
  cued_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cued_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (occasion_id, prompt_id),
  FOREIGN KEY (occasion_id, prompt_id)
    REFERENCES public.passport_occasion_prompts(occasion_id, prompt_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.passport_occasion_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('note', 'join', 'photo')),
  text text CHECK (text IS NULL OR char_length(text) <= 500),
  emoji text CHECK (emoji IS NULL OR char_length(emoji) <= 16),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_occasion_moments_by_occasion
  ON public.passport_occasion_moments (occasion_id, at DESC);

CREATE TABLE IF NOT EXISTS public.passport_occasion_reactions (
  occasion_id uuid NOT NULL REFERENCES public.passport_occasions(id) ON DELETE CASCADE,
  moment_id uuid NOT NULL REFERENCES public.passport_occasion_moments(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (moment_id, emoji, user_id)
);

-- --------------------------------------------------------------- helpers
--
-- SECURITY DEFINER so policies can ask about membership without recursing
-- into the policies of the table they are asking about.

CREATE OR REPLACE FUNCTION public.passport_occasion_role(p_occasion uuid, p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select role from passport_occasion_members
  where occasion_id = p_occasion and user_id = p_user;
$$;

CREATE OR REPLACE FUNCTION public.passport_is_occasion_member(p_occasion uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1 from passport_occasion_members
    where occasion_id = p_occasion and user_id = p_user
  );
$$;

-- Has the prompt this (possibly derived) prompt id belongs to locked yet?
CREATE OR REPLACE FUNCTION public.passport_occasion_prompt_locked(p_occasion uuid, p_prompt text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce((
    select p.lock_offset_minutes is not null
       and now() >= o.starts_at + make_interval(mins => p.lock_offset_minutes)
    from passport_occasion_prompts p
    join passport_occasions o on o.id = p.occasion_id
    where p.occasion_id = p_occasion
      and p.prompt_id = split_part(p_prompt, '::', 1)
  ), false);
$$;

/**
 * May `p_viewer` read an answer `p_author` gave to `p_prompt`?
 *
 * The database copy of the lab engine's reveal rules (core/engine.ts,
 * `buildLivePrompt`), so a sealed pick is sealed from PostgREST too:
 *
 *   immediate — every member, as it happens
 *   onLock    — once it locks, or once you have committed your own pick
 *   onCue     — once somebody opens it, or once it locks
 *   never     — nobody but the author, ever
 *
 * and an answer to a question aimed at one person is that person's business
 * until it locks. Your own answer is always yours.
 */
CREATE OR REPLACE FUNCTION public.passport_occasion_answer_visible(
  p_occasion uuid, p_prompt text, p_author uuid, p_viewer uuid
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
declare
  v_rule passport_occasion_prompts%rowtype;
  v_locked boolean;
begin
  if p_viewer is null then return false; end if;
  if p_author = p_viewer then
    return passport_is_occasion_member(p_occasion, p_viewer);
  end if;
  if not passport_is_occasion_member(p_occasion, p_viewer) then return false; end if;

  select * into v_rule from passport_occasion_prompts
  where occasion_id = p_occasion and prompt_id = split_part(p_prompt, '::', 1);
  if not found then return false; end if;

  v_locked := passport_occasion_prompt_locked(p_occasion, p_prompt);

  if v_rule.audience_only is not null
     and v_rule.audience_only <> p_viewer
     and not v_locked then
    return false;
  end if;

  return case v_rule.reveal
    when 'immediate' then true
    when 'onLock' then v_locked or exists (
      select 1 from passport_occasion_responses r
      where r.occasion_id = p_occasion and r.prompt_id = p_prompt and r.user_id = p_viewer)
    when 'onCue' then v_locked or exists (
      select 1 from passport_occasion_cues c
      where c.occasion_id = p_occasion and c.prompt_id = split_part(p_prompt, '::', 1))
    else false
  end;
end;
$$;

/** May `p_viewer` see this prompt at all? Secret missions are for their target and their author. */
CREATE OR REPLACE FUNCTION public.passport_occasion_prompt_visible(
  p_occasion uuid, p_audience uuid, p_asked_by uuid, p_viewer uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select passport_is_occasion_member(p_occasion, p_viewer)
     and (p_audience is null or p_audience = p_viewer or p_asked_by = p_viewer);
$$;

-- ------------------------------------------------------------ functions
--
-- The three things that must be atomic or must work for a non-member.

/**
 * Make an occasion, its host membership, and its prompt rules in one step.
 * Anyone signed in may start one; they become its host.
 */
CREATE OR REPLACE FUNCTION public.passport_create_occasion(
  p_template text, p_title text, p_starts_at timestamptz, p_details jsonb,
  p_display_name text, p_emoji text, p_hue smallint, p_prompts jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_id uuid;
  v_prompt jsonb;
begin
  if auth.uid() is null then
    raise exception 'sign-in required' using errcode = '28000';
  end if;

  insert into passport_occasions (template, title, starts_at, host_id, details)
  values (p_template, p_title, p_starts_at, auth.uid(), coalesce(p_details, '{}'::jsonb))
  returning id into v_id;

  insert into passport_occasion_members (occasion_id, user_id, role, display_name, emoji, hue)
  values (v_id, auth.uid(), 'host', p_display_name, p_emoji, p_hue);

  for v_prompt in select * from jsonb_array_elements(coalesce(p_prompts, '[]'::jsonb)) loop
    insert into passport_occasion_prompts
      (occasion_id, prompt_id, reveal, lock_offset_minutes, open_to_suggestions)
    values (
      v_id,
      v_prompt->>'id',
      v_prompt->>'reveal',
      (v_prompt->>'lockOffsetMinutes')::integer,
      coalesce((v_prompt->>'openToSuggestions')::boolean, false)
    );
  end loop;

  return v_id;
end;
$$;

/**
 * What a signed-out person may learn from a link: whether it is any good.
 * Not the title, not the host, not who else is in.
 */
CREATE OR REPLACE FUNCTION public.passport_describe_occasion_invite(p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce((
    select i.revoked_at is null
       and (i.expires_at is null or i.expires_at >= now())
       and i.uses < i.max_uses
    from passport_occasion_invites i
    where i.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  ), false);
$$;

/**
 * Join from a link. Requires a signed-in caller — the link alone is never
 * enough. Idempotent for somebody already in, and following a link you are
 * already a member through does not spend one of its uses.
 */
CREATE OR REPLACE FUNCTION public.passport_redeem_occasion_invite(
  p_token text, p_display_name text, p_emoji text, p_hue smallint
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  v_invite passport_occasion_invites%rowtype;
  v_emoji text;
begin
  if auth.uid() is null then
    raise exception 'sign-in required' using errcode = '28000';
  end if;

  select * into v_invite from passport_occasion_invites
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  for update;

  if not found then return null; end if;

  if passport_is_occasion_member(v_invite.occasion_id, auth.uid()) then
    return v_invite.occasion_id;
  end if;

  if v_invite.revoked_at is not null
     or (v_invite.expires_at is not null and v_invite.expires_at < now())
     or v_invite.uses >= v_invite.max_uses then
    return null;
  end if;

  -- The emoji is how a person is told apart at a glance, so two people on one
  -- night never share one while there is a free one. The caller's is a
  -- preference; the first unclaimed one after it in this ring wins.
  select e into v_emoji from (
    select e, ord from unnest(array[p_emoji,
      '🧭','🥅','🎤','🚕','📸','🥂','🌭','🧤','🍻','🦆',
      '🐐','🎺','🌮','🧊','🛼','🦫','🍕','🎯','🪩','🧃']) with ordinality as t(e, ord)
  ) ring
  where not exists (select 1 from passport_occasion_members m
                    where m.occasion_id = v_invite.occasion_id and m.emoji = ring.e)
  order by ord limit 1;

  insert into passport_occasion_members (occasion_id, user_id, role, display_name, emoji, hue)
  values (v_invite.occasion_id, auth.uid(), 'guest', p_display_name,
          coalesce(v_emoji, p_emoji), p_hue);

  update passport_occasion_invites set uses = uses + 1 where id = v_invite.id;

  insert into passport_occasion_moments (occasion_id, actor_id, kind)
  values (v_invite.occasion_id, auth.uid(), 'join');

  return v_invite.occasion_id;
end;
$$;

-- ----------------------------------------------------- row level security

ALTER TABLE public.passport_occasions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_cues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_occasion_reactions ENABLE ROW LEVEL SECURITY;

-- Signed-in people: the table privileges RLS needs to run at all.
--
-- This used to rely on Supabase's default privileges (anon and authenticated
-- holding ALL on new public tables). The shared production project does not
-- apply them: on 2026-10-16 Conference, written the same way, crashed for
-- every signed-in visitor with `42501 permission denied`. So the posture the
-- attack suite tested is now stated outright — the same DML the defaults
-- gave, without TRUNCATE/REFERENCES/TRIGGER — and the column-level UPDATE
-- grants below still narrow the four tables that have them. RLS decides rows.
GRANT SELECT, INSERT, DELETE ON public.passport_occasions,
  public.passport_occasion_members, public.passport_occasion_invites,
  public.passport_occasion_prompts
  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passport_occasion_options,
  public.passport_occasion_responses, public.passport_occasion_consents,
  public.passport_occasion_cues, public.passport_occasion_moments,
  public.passport_occasion_reactions
  TO authenticated;

-- Signed-out visitors get nothing from any of these, by grant as well as by policy.
REVOKE ALL ON public.passport_occasions, public.passport_occasion_members,
  public.passport_occasion_invites, public.passport_occasion_prompts,
  public.passport_occasion_options, public.passport_occasion_responses,
  public.passport_occasion_consents, public.passport_occasion_cues,
  public.passport_occasion_moments, public.passport_occasion_reactions
  FROM anon;
REVOKE ALL ON FUNCTION public.passport_create_occasion(text, text, timestamptz, jsonb, text, text, smallint, jsonb) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_redeem_occasion_invite(text, text, text, smallint) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.passport_create_occasion(text, text, timestamptz, jsonb, text, text, smallint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_redeem_occasion_invite(text, text, text, smallint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_describe_occasion_invite(text) TO anon, authenticated;
-- Policy helpers run as the caller, so `authenticated` needs them; `anon` does not.
REVOKE ALL ON FUNCTION public.passport_occasion_role(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_is_occasion_member(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_occasion_prompt_locked(uuid, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_occasion_answer_visible(uuid, text, uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.passport_occasion_prompt_visible(uuid, uuid, uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.passport_occasion_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_is_occasion_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_occasion_prompt_locked(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_occasion_answer_visible(uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.passport_occasion_prompt_visible(uuid, uuid, uuid, uuid) TO authenticated;

-- A member may change how they appear and their own ceiling — not their role,
-- not which occasion they are in, not who they are.
REVOKE UPDATE ON public.passport_occasion_members FROM authenticated;
GRANT UPDATE (display_name, emoji, hue, vibe, edge) ON public.passport_occasion_members TO authenticated;
-- The host may move the night and set the brief; nobody may re-home it.
REVOKE UPDATE ON public.passport_occasions FROM authenticated;
GRANT UPDATE (title, starts_at, details, brief) ON public.passport_occasions TO authenticated;
-- Uses are spent only by the redeem function; the host may revoke or relabel.
REVOKE UPDATE ON public.passport_occasion_invites FROM authenticated;
GRANT UPDATE (label, revoked_at, expires_at) ON public.passport_occasion_invites TO authenticated;
-- A rule, once written, changes only in its outcome.
REVOKE UPDATE ON public.passport_occasion_prompts FROM authenticated;
GRANT UPDATE (resolution) ON public.passport_occasion_prompts TO authenticated;

do $$ begin
  -- occasions
  if not exists (select 1 from pg_policies where policyname = 'passport_occasions_member_read') then
    create policy passport_occasions_member_read on public.passport_occasions
      for select to authenticated using (passport_is_occasion_member(id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasions_host_update') then
    create policy passport_occasions_host_update on public.passport_occasions
      for update to authenticated
      using (passport_occasion_role(id, auth.uid()) = 'host')
      with check (passport_occasion_role(id, auth.uid()) = 'host');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasions_host_delete') then
    create policy passport_occasions_host_delete on public.passport_occasions
      for delete to authenticated using (host_id = auth.uid());
  end if;
  -- (No INSERT policy: occasions are made only by passport_create_occasion.)

  -- members
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_members_read') then
    create policy passport_occasion_members_read on public.passport_occasion_members
      for select to authenticated using (passport_is_occasion_member(occasion_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_members_self_update') then
    create policy passport_occasion_members_self_update on public.passport_occasion_members
      for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
  -- The host removes guests; anyone may leave. Nobody removes the host.
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_members_remove') then
    create policy passport_occasion_members_remove on public.passport_occasion_members
      for delete to authenticated using (
        role = 'guest' and (
          user_id = auth.uid()
          or passport_occasion_role(occasion_id, auth.uid()) = 'host'));
  end if;
  -- (No INSERT policy: membership comes only from create or redeem.)

  -- invites: the host's business only, tokens included (as hashes).
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_invites_host_all') then
    create policy passport_occasion_invites_host_all on public.passport_occasion_invites
      for all to authenticated
      using (passport_occasion_role(occasion_id, auth.uid()) = 'host')
      with check (
        passport_occasion_role(occasion_id, auth.uid()) = 'host'
        and created_by = auth.uid() and uses = 0);
  end if;

  -- prompts
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_prompts_read') then
    create policy passport_occasion_prompts_read on public.passport_occasion_prompts
      for select to authenticated
      using (passport_occasion_prompt_visible(occasion_id, audience_only, asked_by, auth.uid()));
  end if;
  -- A member asks the group something: their own question, in their own name.
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_prompts_ask') then
    create policy passport_occasion_prompts_ask on public.passport_occasion_prompts
      for insert to authenticated with check (
        passport_is_occasion_member(occasion_id, auth.uid())
        and asked_by = auth.uid() and content is not null and resolution is null
        and (audience_only is null or passport_is_occasion_member(occasion_id, audience_only)));
  end if;
  -- The host calls results on anything; an asker calls their own question.
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_prompts_resolve') then
    create policy passport_occasion_prompts_resolve on public.passport_occasion_prompts
      for update to authenticated
      using (passport_occasion_role(occasion_id, auth.uid()) = 'host' or asked_by = auth.uid())
      with check (passport_occasion_role(occasion_id, auth.uid()) = 'host' or asked_by = auth.uid());
  end if;

  -- options: suggested by a member, on a question open to suggestions, before it locks.
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_options_read') then
    create policy passport_occasion_options_read on public.passport_occasion_options
      for select to authenticated using (passport_is_occasion_member(occasion_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_options_suggest') then
    create policy passport_occasion_options_suggest on public.passport_occasion_options
      for insert to authenticated with check (
        added_by = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and not passport_occasion_prompt_locked(occasion_id, prompt_id)
        and exists (select 1 from passport_occasion_prompts p
                    where p.occasion_id = passport_occasion_options.occasion_id
                      and p.prompt_id = passport_occasion_options.prompt_id
                      and p.open_to_suggestions));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_options_withdraw') then
    create policy passport_occasion_options_withdraw on public.passport_occasion_options
      for delete to authenticated using (
        added_by = auth.uid() or passport_occasion_role(occasion_id, auth.uid()) = 'host');
  end if;

  -- responses: your own answer, to a real question, before it locks.
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_responses_read') then
    create policy passport_occasion_responses_read on public.passport_occasion_responses
      for select to authenticated
      using (passport_occasion_answer_visible(occasion_id, prompt_id, user_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_responses_answer') then
    create policy passport_occasion_responses_answer on public.passport_occasion_responses
      for insert to authenticated with check (
        user_id = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and not passport_occasion_prompt_locked(occasion_id, prompt_id)
        and exists (select 1 from passport_occasion_prompts p
                    where p.occasion_id = passport_occasion_responses.occasion_id
                      and p.prompt_id = split_part(passport_occasion_responses.prompt_id, '::', 1)
                      and passport_occasion_prompt_visible(p.occasion_id, p.audience_only, p.asked_by, auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_responses_change') then
    create policy passport_occasion_responses_change on public.passport_occasion_responses
      for update to authenticated
      using (user_id = auth.uid() and not passport_occasion_prompt_locked(occasion_id, prompt_id))
      with check (user_id = auth.uid() and not passport_occasion_prompt_locked(occasion_id, prompt_id));
  end if;

  -- consents: yours, and nobody is told what anybody set.
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_consents_own') then
    create policy passport_occasion_consents_own on public.passport_occasion_consents
      for all to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid() and passport_is_occasion_member(occasion_id, auth.uid()));
  end if;

  -- cues: any member may open something sealed.
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_cues_read') then
    create policy passport_occasion_cues_read on public.passport_occasion_cues
      for select to authenticated using (passport_is_occasion_member(occasion_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_cues_open') then
    create policy passport_occasion_cues_open on public.passport_occasion_cues
      for insert to authenticated with check (
        cued_by = auth.uid() and passport_is_occasion_member(occasion_id, auth.uid()));
  end if;

  -- moments: the feed. Said in your own name only.
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_moments_read') then
    create policy passport_occasion_moments_read on public.passport_occasion_moments
      for select to authenticated using (passport_is_occasion_member(occasion_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_moments_say') then
    create policy passport_occasion_moments_say on public.passport_occasion_moments
      for insert to authenticated with check (
        actor_id = auth.uid() and kind in ('note', 'photo')
        and passport_is_occasion_member(occasion_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_moments_unsay') then
    create policy passport_occasion_moments_unsay on public.passport_occasion_moments
      for delete to authenticated using (
        actor_id = auth.uid() or passport_occasion_role(occasion_id, auth.uid()) = 'host');
  end if;

  -- reactions
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_reactions_read') then
    create policy passport_occasion_reactions_read on public.passport_occasion_reactions
      for select to authenticated using (passport_is_occasion_member(occasion_id, auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_reactions_own') then
    create policy passport_occasion_reactions_own on public.passport_occasion_reactions
      for insert to authenticated with check (
        user_id = auth.uid()
        and passport_is_occasion_member(occasion_id, auth.uid())
        and exists (select 1 from passport_occasion_moments m
                    where m.id = moment_id and m.occasion_id = passport_occasion_reactions.occasion_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_occasion_reactions_unreact') then
    create policy passport_occasion_reactions_unreact on public.passport_occasion_reactions
      for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;

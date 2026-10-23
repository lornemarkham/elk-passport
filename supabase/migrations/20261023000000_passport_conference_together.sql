-- ============================================================================
-- Conference, together: plans and RSVPs, venue votes, group chat, find my
-- people (time-limited location), and the shared photo album.
--
-- Depends on 20261012000000_passport_conferences.sql (and the 20261016 grants).
-- Apply it after them, in the SQL editor (supabase/README.md hazard 1).
-- Guarded: applying it twice changes nothing.
--
-- Everything here hangs off the conference's own membership
-- (passport_conference_members), by composite foreign keys, so:
--
--   * leaving, being removed, and the conference being deleted or expiring
--     (30 days after its last day) erase every row a person wrote, with no
--     module code having to remember;
--   * there is one membership for the group. Hockey Night's patterns are
--     reused (one row per person per answer, membership checks in SECURITY
--     DEFINER helpers, reads as the signed-in person, explicit grants), its
--     passport_occasion_* tables are not: a conference is not an occasion,
--     and mirroring members into a second system is what ADR 009 forbids.
--
-- Who may do what (the service repeats every rule; this is the enforcement):
--
--   plans        members see `everyone` plans; a `selected` plan only its
--                organiser and invitees see. Any member creates (as
--                themselves); the plan's organiser or a conference organiser
--                edits or cancels.
--   rsvps        your own answer, per occurrence, on plans you can see.
--   options/votes  anyone who can see a plan suggests places and votes once.
--   messages     members read the conference room, and a plan's thread if
--                they can see the plan. Only people who chose to be seen
--                post. Authors delete their own; organisers moderate.
--   locations    opt-in, at most 4 hours ahead, readable by members only
--                while unexpired and only for people who chose to be seen.
--                Stopping deletes the row. Expired rows are purged.
--   photos       members see the album (a photo of a `selected` plan only
--                those who can see it). Seen members upload. The uploader
--                deletes; an organiser can take one down.
-- ============================================================================

-- --------------------------------------------------------------- helpers

CREATE OR REPLACE FUNCTION public.passport_conference_member_id(p_conference text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  select member_id from passport_conference_members
  where conference_id = p_conference and user_id = auth.uid();
$$;

-- The caller chose to be seen in this conference.
CREATE OR REPLACE FUNCTION public.passport_conference_is_seen(p_conference text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  select exists (select 1 from passport_conference_members
                 where conference_id = p_conference and user_id = auth.uid()
                   and visibility = 'members');
$$;

-- Somebody else in the conference chose to be seen (answers yes/no only).
CREATE OR REPLACE FUNCTION public.passport_conference_user_seen(p_conference text, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  select exists (select 1 from passport_conference_members
                 where conference_id = p_conference and user_id = p_user
                   and visibility = 'members');
$$;

-- --------------------------------------------------------------- plans

CREATE TABLE IF NOT EXISTS public.passport_conference_plans (
  id             text PRIMARY KEY CHECK (char_length(id) BETWEEN 8 AND 64),
  conference_id  text NOT NULL,
  organiser_user uuid NOT NULL DEFAULT auth.uid(),
  organiser_id   text NOT NULL,
  kind           text NOT NULL CHECK (kind IN ('morning-walk','coffee','lunch','dinner','drinks','sightseeing','explore','custom')),
  title          text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  description    text NOT NULL DEFAULT '' CHECK (char_length(description) <= 600),
  meeting        jsonb CHECK (meeting IS NULL OR (jsonb_typeof(meeting) = 'object' AND octet_length(meeting::text) < 1024)),
  venue_id       text CHECK (venue_id IS NULL OR char_length(venue_id) <= 200),
  audience       text NOT NULL CHECK (audience IN ('everyone', 'selected')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conference_id, organiser_user)
    REFERENCES public.passport_conference_members (conference_id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS passport_conference_plans_conference
  ON public.passport_conference_plans (conference_id);

CREATE TABLE IF NOT EXISTS public.passport_conference_plan_invites (
  plan_id       text NOT NULL REFERENCES public.passport_conference_plans(id) ON DELETE CASCADE,
  conference_id text NOT NULL,
  member_id     text NOT NULL,
  PRIMARY KEY (plan_id, member_id),
  FOREIGN KEY (conference_id, member_id)
    REFERENCES public.passport_conference_members (conference_id, member_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.passport_conference_plan_occurrences (
  id            text PRIMARY KEY CHECK (char_length(id) BETWEEN 8 AND 64),
  plan_id       text NOT NULL REFERENCES public.passport_conference_plans(id) ON DELETE CASCADE,
  conference_id text NOT NULL REFERENCES public.passport_conferences(id) ON DELETE CASCADE,
  starts_at     timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS passport_conference_plan_occurrences_plan
  ON public.passport_conference_plan_occurrences (plan_id);

CREATE TABLE IF NOT EXISTS public.passport_conference_rsvps (
  occurrence_id text NOT NULL REFERENCES public.passport_conference_plan_occurrences(id) ON DELETE CASCADE,
  plan_id       text NOT NULL REFERENCES public.passport_conference_plans(id) ON DELETE CASCADE,
  conference_id text NOT NULL,
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  member_id     text NOT NULL,
  answer        text NOT NULL CHECK (answer IN ('in', 'maybe', 'out')),
  at            timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (occurrence_id, user_id),
  FOREIGN KEY (conference_id, user_id)
    REFERENCES public.passport_conference_members (conference_id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS passport_conference_rsvps_conference
  ON public.passport_conference_rsvps (conference_id);

CREATE TABLE IF NOT EXISTS public.passport_conference_plan_options (
  id            text PRIMARY KEY CHECK (char_length(id) BETWEEN 8 AND 64),
  plan_id       text NOT NULL REFERENCES public.passport_conference_plans(id) ON DELETE CASCADE,
  conference_id text NOT NULL,
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  member_id     text NOT NULL,
  place_id      text NOT NULL CHECK (char_length(place_id) BETWEEN 1 AND 200),
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, place_id),
  FOREIGN KEY (conference_id, user_id)
    REFERENCES public.passport_conference_members (conference_id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.passport_conference_plan_votes (
  plan_id       text NOT NULL REFERENCES public.passport_conference_plans(id) ON DELETE CASCADE,
  option_id     text NOT NULL REFERENCES public.passport_conference_plan_options(id) ON DELETE CASCADE,
  conference_id text NOT NULL,
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  member_id     text NOT NULL,
  PRIMARY KEY (plan_id, user_id),
  FOREIGN KEY (conference_id, user_id)
    REFERENCES public.passport_conference_members (conference_id, user_id) ON DELETE CASCADE
);

-- Which conference a plan is in (definer: past the plans policy).
CREATE OR REPLACE FUNCTION public.passport_conference_plan_conference(p_plan text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  select conference_id from passport_conference_plans where id = p_plan;
$$;

CREATE OR REPLACE FUNCTION public.passport_conference_can_see_plan(p_plan text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  select exists (
    select 1 from passport_conference_plans p
    where p.id = p_plan
      and passport_conference_is_member(p.conference_id)
      and (p.audience = 'everyone'
           or p.organiser_user = auth.uid()
           or exists (select 1 from passport_conference_plan_invites i
                      where i.plan_id = p.id
                        and i.member_id = passport_conference_member_id(p.conference_id))));
$$;

-- Is the caller invited to this plan? (Definer: past the invites policy.)
CREATE OR REPLACE FUNCTION public.passport_conference_is_invited(p_plan text, p_conference text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  select exists (select 1 from passport_conference_plan_invites
                 where plan_id = p_plan
                   and member_id = passport_conference_member_id(p_conference));
$$;

CREATE OR REPLACE FUNCTION public.passport_conference_manages_plan(p_plan text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  select exists (
    select 1 from passport_conference_plans p
    where p.id = p_plan
      and (p.organiser_user = auth.uid() or passport_conference_is_organiser(p.conference_id)));
$$;

CREATE OR REPLACE FUNCTION public.passport_conference_occurrence_in(p_occurrence text, p_plan text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  select exists (select 1 from passport_conference_plan_occurrences
                 where id = p_occurrence and plan_id = p_plan);
$$;

CREATE OR REPLACE FUNCTION public.passport_conference_option_in(p_option text, p_plan text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  select exists (select 1 from passport_conference_plan_options
                 where id = p_option and plan_id = p_plan);
$$;

-- --------------------------------------------------------------- chat

CREATE TABLE IF NOT EXISTS public.passport_conference_messages (
  id            text PRIMARY KEY CHECK (char_length(id) BETWEEN 8 AND 64),
  conference_id text NOT NULL,
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  member_id     text NOT NULL,
  plan_id       text REFERENCES public.passport_conference_plans(id) ON DELETE CASCADE,
  body          text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  at            timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conference_id, user_id)
    REFERENCES public.passport_conference_members (conference_id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS passport_conference_messages_room
  ON public.passport_conference_messages (conference_id, at DESC);

CREATE TABLE IF NOT EXISTS public.passport_conference_message_reactions (
  message_id    text NOT NULL REFERENCES public.passport_conference_messages(id) ON DELETE CASCADE,
  conference_id text NOT NULL,
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  member_id     text NOT NULL,
  emoji         text NOT NULL CHECK (emoji IN ('👍','😂','❤️','🔥','🙌','😮')),
  PRIMARY KEY (message_id, user_id, emoji),
  FOREIGN KEY (conference_id, user_id)
    REFERENCES public.passport_conference_members (conference_id, user_id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION public.passport_conference_can_see_message(p_message text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  select exists (select 1 from passport_conference_messages m
                 where m.id = p_message
                   and passport_conference_is_member(m.conference_id)
                   and (m.plan_id is null or passport_conference_can_see_plan(m.plan_id)));
$$;

-- --------------------------------------------------------------- find my people

CREATE TABLE IF NOT EXISTS public.passport_conference_locations (
  conference_id text NOT NULL,
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  member_id     text NOT NULL,
  lat           double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon           double precision NOT NULL CHECK (lon BETWEEN -180 AND 180),
  accuracy_m    real CHECK (accuracy_m IS NULL OR accuracy_m BETWEEN 0 AND 5000),
  note          text NOT NULL DEFAULT '' CHECK (char_length(note) <= 60),
  started_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  PRIMARY KEY (conference_id, user_id),
  UNIQUE (conference_id, member_id),
  FOREIGN KEY (conference_id, user_id)
    REFERENCES public.passport_conference_members (conference_id, user_id) ON DELETE CASCADE
);

-- Anyone signed in may sweep away expired positions; it reveals nothing.
CREATE OR REPLACE FUNCTION public.passport_conference_locations_purge()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
declare n integer;
begin
  delete from passport_conference_locations where expires_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;

-- --------------------------------------------------------------- memories

CREATE TABLE IF NOT EXISTS public.passport_conference_photos (
  id            text PRIMARY KEY CHECK (char_length(id) BETWEEN 8 AND 64),
  conference_id text NOT NULL,
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  member_id     text NOT NULL,
  plan_id       text REFERENCES public.passport_conference_plans(id) ON DELETE SET NULL,
  caption       text NOT NULL DEFAULT '' CHECK (char_length(caption) <= 140),
  -- base64 of a JPEG the phone already shrank (Hockey's Memories rule).
  data          text NOT NULL CHECK (char_length(data) BETWEEN 100 AND 800000),
  at            timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (conference_id, user_id)
    REFERENCES public.passport_conference_members (conference_id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS passport_conference_photos_album
  ON public.passport_conference_photos (conference_id, at DESC);

CREATE TABLE IF NOT EXISTS public.passport_conference_photo_reactions (
  photo_id      text NOT NULL REFERENCES public.passport_conference_photos(id) ON DELETE CASCADE,
  conference_id text NOT NULL,
  user_id       uuid NOT NULL DEFAULT auth.uid(),
  member_id     text NOT NULL,
  emoji         text NOT NULL CHECK (emoji IN ('❤️','😂','🔥','🙌','😮')),
  PRIMARY KEY (photo_id, user_id, emoji),
  FOREIGN KEY (conference_id, user_id)
    REFERENCES public.passport_conference_members (conference_id, user_id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION public.passport_conference_can_see_photo(p_photo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  select exists (select 1 from passport_conference_photos p
                 where p.id = p_photo
                   and passport_conference_is_member(p.conference_id)
                   and (p.plan_id is null or passport_conference_can_see_plan(p.plan_id)));
$$;

-- --------------------------------------------------------------- RLS

ALTER TABLE public.passport_conference_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_plan_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_plan_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_plan_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_plan_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_conference_photo_reactions ENABLE ROW LEVEL SECURITY;

do $$ begin
  -- plans
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plans_read') then
    -- Judged on the row's own columns, not by re-reading the plan: a definer
    -- lookup can't see a row its own INSERT is still returning, so
    -- `insert … returning` (PostgREST's return=representation) was refused.
    create policy passport_conference_plans_read on public.passport_conference_plans
      for select to authenticated
      using (passport_conference_is_member(conference_id)
             and (audience = 'everyone'
                  or organiser_user = auth.uid()
                  or passport_conference_is_invited(id, conference_id)));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plans_create') then
    create policy passport_conference_plans_create on public.passport_conference_plans
      for insert to authenticated
      with check (organiser_user = auth.uid()
                  and organiser_id = passport_conference_member_id(conference_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plans_manage') then
    create policy passport_conference_plans_manage on public.passport_conference_plans
      for update to authenticated
      using (passport_conference_manages_plan(id))
      with check (passport_conference_manages_plan(id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plans_cancel') then
    create policy passport_conference_plans_cancel on public.passport_conference_plans
      for delete to authenticated using (passport_conference_manages_plan(id));
  end if;

  -- invites
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plan_invites_read') then
    create policy passport_conference_plan_invites_read on public.passport_conference_plan_invites
      for select to authenticated using (passport_conference_can_see_plan(plan_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plan_invites_manage') then
    create policy passport_conference_plan_invites_manage on public.passport_conference_plan_invites
      for insert to authenticated
      with check (passport_conference_manages_plan(plan_id)
                  and conference_id = passport_conference_plan_conference(plan_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plan_invites_uninvite') then
    create policy passport_conference_plan_invites_uninvite on public.passport_conference_plan_invites
      for delete to authenticated using (passport_conference_manages_plan(plan_id));
  end if;

  -- occurrences
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plan_occurrences_read') then
    create policy passport_conference_plan_occurrences_read on public.passport_conference_plan_occurrences
      for select to authenticated using (passport_conference_can_see_plan(plan_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plan_occurrences_add') then
    create policy passport_conference_plan_occurrences_add on public.passport_conference_plan_occurrences
      for insert to authenticated
      with check (passport_conference_manages_plan(plan_id)
                  and conference_id = passport_conference_plan_conference(plan_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plan_occurrences_drop') then
    create policy passport_conference_plan_occurrences_drop on public.passport_conference_plan_occurrences
      for delete to authenticated using (passport_conference_manages_plan(plan_id));
  end if;

  -- rsvps: your own answer, on a plan you can see, for one of its occurrences
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_rsvps_read') then
    create policy passport_conference_rsvps_read on public.passport_conference_rsvps
      for select to authenticated using (passport_conference_can_see_plan(plan_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_rsvps_answer') then
    create policy passport_conference_rsvps_answer on public.passport_conference_rsvps
      for insert to authenticated
      with check (user_id = auth.uid()
                  and member_id = passport_conference_member_id(conference_id)
                  and conference_id = passport_conference_plan_conference(plan_id)
                  and passport_conference_can_see_plan(plan_id)
                  and passport_conference_occurrence_in(occurrence_id, plan_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_rsvps_change') then
    create policy passport_conference_rsvps_change on public.passport_conference_rsvps
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid()
                  and member_id = passport_conference_member_id(conference_id)
                  and conference_id = passport_conference_plan_conference(plan_id)
                  and passport_conference_can_see_plan(plan_id)
                  and passport_conference_occurrence_in(occurrence_id, plan_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_rsvps_withdraw') then
    create policy passport_conference_rsvps_withdraw on public.passport_conference_rsvps
      for delete to authenticated using (user_id = auth.uid());
  end if;

  -- venue options and votes
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plan_options_read') then
    create policy passport_conference_plan_options_read on public.passport_conference_plan_options
      for select to authenticated using (passport_conference_can_see_plan(plan_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plan_options_suggest') then
    create policy passport_conference_plan_options_suggest on public.passport_conference_plan_options
      for insert to authenticated
      with check (user_id = auth.uid()
                  and member_id = passport_conference_member_id(conference_id)
                  and conference_id = passport_conference_plan_conference(plan_id)
                  and passport_conference_can_see_plan(plan_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plan_options_withdraw') then
    create policy passport_conference_plan_options_withdraw on public.passport_conference_plan_options
      for delete to authenticated
      using (user_id = auth.uid() or passport_conference_manages_plan(plan_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plan_votes_read') then
    create policy passport_conference_plan_votes_read on public.passport_conference_plan_votes
      for select to authenticated using (passport_conference_can_see_plan(plan_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plan_votes_cast') then
    create policy passport_conference_plan_votes_cast on public.passport_conference_plan_votes
      for insert to authenticated
      with check (user_id = auth.uid()
                  and member_id = passport_conference_member_id(conference_id)
                  and conference_id = passport_conference_plan_conference(plan_id)
                  and passport_conference_can_see_plan(plan_id)
                  and passport_conference_option_in(option_id, plan_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plan_votes_move') then
    create policy passport_conference_plan_votes_move on public.passport_conference_plan_votes
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid()
                  and member_id = passport_conference_member_id(conference_id)
                  and conference_id = passport_conference_plan_conference(plan_id)
                  and passport_conference_can_see_plan(plan_id)
                  and passport_conference_option_in(option_id, plan_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_plan_votes_withdraw') then
    create policy passport_conference_plan_votes_withdraw on public.passport_conference_plan_votes
      for delete to authenticated using (user_id = auth.uid());
  end if;

  -- chat
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_messages_read') then
    create policy passport_conference_messages_read on public.passport_conference_messages
      for select to authenticated
      using (passport_conference_is_member(conference_id)
             and (plan_id is null or passport_conference_can_see_plan(plan_id)));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_messages_say') then
    create policy passport_conference_messages_say on public.passport_conference_messages
      for insert to authenticated
      with check (user_id = auth.uid()
                  and member_id = passport_conference_member_id(conference_id)
                  and passport_conference_is_seen(conference_id)
                  and (plan_id is null
                       or (passport_conference_can_see_plan(plan_id)
                           and conference_id = passport_conference_plan_conference(plan_id))));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_messages_unsay') then
    -- Organisers moderate what they can see; a private plan's thread is its own.
    create policy passport_conference_messages_unsay on public.passport_conference_messages
      for delete to authenticated
      using (user_id = auth.uid()
             or (passport_conference_is_organiser(conference_id)
                 and (plan_id is null or passport_conference_can_see_plan(plan_id))));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_message_reactions_read') then
    create policy passport_conference_message_reactions_read on public.passport_conference_message_reactions
      for select to authenticated using (passport_conference_can_see_message(message_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_message_reactions_add') then
    create policy passport_conference_message_reactions_add on public.passport_conference_message_reactions
      for insert to authenticated
      with check (user_id = auth.uid()
                  and member_id = passport_conference_member_id(conference_id)
                  and passport_conference_can_see_message(message_id)
                  and exists (select 1 from passport_conference_messages m
                              where m.id = passport_conference_message_reactions.message_id
                                and m.conference_id = passport_conference_message_reactions.conference_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_message_reactions_drop') then
    create policy passport_conference_message_reactions_drop on public.passport_conference_message_reactions
      for delete to authenticated using (user_id = auth.uid());
  end if;

  -- find my people
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_locations_read') then
    create policy passport_conference_locations_read on public.passport_conference_locations
      for select to authenticated
      using (user_id = auth.uid()
             or (expires_at > now()
                 and passport_conference_is_member(conference_id)
                 and passport_conference_user_seen(conference_id, user_id)));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_locations_share') then
    create policy passport_conference_locations_share on public.passport_conference_locations
      for insert to authenticated
      with check (user_id = auth.uid()
                  and member_id = passport_conference_member_id(conference_id)
                  and passport_conference_is_seen(conference_id)
                  and expires_at > now()
                  and expires_at <= now() + interval '4 hours 1 minute');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_locations_move') then
    create policy passport_conference_locations_move on public.passport_conference_locations
      for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid()
                  and member_id = passport_conference_member_id(conference_id)
                  and passport_conference_is_seen(conference_id)
                  and expires_at > now()
                  and expires_at <= now() + interval '4 hours 1 minute');
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_locations_stop') then
    create policy passport_conference_locations_stop on public.passport_conference_locations
      for delete to authenticated using (user_id = auth.uid());
  end if;

  -- memories
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_photos_read') then
    create policy passport_conference_photos_read on public.passport_conference_photos
      for select to authenticated
      using (passport_conference_is_member(conference_id)
             and (plan_id is null or passport_conference_can_see_plan(plan_id)));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_photos_add') then
    create policy passport_conference_photos_add on public.passport_conference_photos
      for insert to authenticated
      with check (user_id = auth.uid()
                  and member_id = passport_conference_member_id(conference_id)
                  and passport_conference_is_seen(conference_id)
                  and (plan_id is null
                       or (passport_conference_can_see_plan(plan_id)
                           and conference_id = passport_conference_plan_conference(plan_id))));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_photos_remove') then
    create policy passport_conference_photos_remove on public.passport_conference_photos
      for delete to authenticated
      using (user_id = auth.uid()
             or (passport_conference_is_organiser(conference_id)
                 and (plan_id is null or passport_conference_can_see_plan(plan_id))));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_photo_reactions_read') then
    create policy passport_conference_photo_reactions_read on public.passport_conference_photo_reactions
      for select to authenticated using (passport_conference_can_see_photo(photo_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_photo_reactions_add') then
    create policy passport_conference_photo_reactions_add on public.passport_conference_photo_reactions
      for insert to authenticated
      with check (user_id = auth.uid()
                  and member_id = passport_conference_member_id(conference_id)
                  and passport_conference_can_see_photo(photo_id)
                  and exists (select 1 from passport_conference_photos p
                              where p.id = passport_conference_photo_reactions.photo_id
                                and p.conference_id = passport_conference_photo_reactions.conference_id));
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_photo_reactions_drop') then
    create policy passport_conference_photo_reactions_drop on public.passport_conference_photo_reactions
      for delete to authenticated using (user_id = auth.uid());
  end if;
end $$;

-- --------------------------------------------------------------- grants
--
-- Stated outright: production applies no default grants (the 2026-10-16
-- crash, 20261016000000_passport_conference_grants.sql). `anon` gets nothing.
-- Column-level UPDATE where a row is edited. Answers, votes and positions are
-- written by upsert, which PostgREST turns into ON CONFLICT DO UPDATE of every
-- column it sent, so those columns are granted; the policies' WITH CHECK still
-- pins them to the caller's own member id and conference. `user_id` is never
-- updatable.

REVOKE ALL ON public.passport_conference_plans, public.passport_conference_plan_invites,
  public.passport_conference_plan_occurrences, public.passport_conference_rsvps,
  public.passport_conference_plan_options, public.passport_conference_plan_votes,
  public.passport_conference_messages, public.passport_conference_message_reactions,
  public.passport_conference_locations, public.passport_conference_photos,
  public.passport_conference_photo_reactions FROM anon;

GRANT SELECT, INSERT, DELETE ON public.passport_conference_plans TO authenticated;
GRANT UPDATE (kind, title, description, meeting, venue_id, audience, updated_at)
  ON public.passport_conference_plans TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_conference_plan_invites TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_conference_plan_occurrences TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_conference_rsvps TO authenticated;
GRANT UPDATE (occurrence_id, plan_id, conference_id, member_id, answer, at)
  ON public.passport_conference_rsvps TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_conference_plan_options TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_conference_plan_votes TO authenticated;
GRANT UPDATE (plan_id, option_id, conference_id, member_id)
  ON public.passport_conference_plan_votes TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_conference_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_conference_message_reactions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_conference_locations TO authenticated;
GRANT UPDATE (conference_id, member_id, lat, lon, accuracy_m, note, started_at, updated_at, expires_at)
  ON public.passport_conference_locations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_conference_photos TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.passport_conference_photo_reactions TO authenticated;

REVOKE ALL ON FUNCTION public.passport_conference_member_id(text),
  public.passport_conference_is_seen(text),
  public.passport_conference_user_seen(text, uuid),
  public.passport_conference_plan_conference(text),
  public.passport_conference_can_see_plan(text),
  public.passport_conference_is_invited(text, text),
  public.passport_conference_manages_plan(text),
  public.passport_conference_occurrence_in(text, text),
  public.passport_conference_option_in(text, text),
  public.passport_conference_can_see_message(text),
  public.passport_conference_can_see_photo(text),
  public.passport_conference_locations_purge() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.passport_conference_member_id(text),
  public.passport_conference_is_seen(text),
  public.passport_conference_user_seen(text, uuid),
  public.passport_conference_plan_conference(text),
  public.passport_conference_can_see_plan(text),
  public.passport_conference_is_invited(text, text),
  public.passport_conference_manages_plan(text),
  public.passport_conference_occurrence_in(text, text),
  public.passport_conference_option_in(text, text),
  public.passport_conference_can_see_message(text),
  public.passport_conference_can_see_photo(text),
  public.passport_conference_locations_purge() TO authenticated;

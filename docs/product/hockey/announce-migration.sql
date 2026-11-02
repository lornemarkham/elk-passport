-- Hockey Night — host announcements and chat replies (2026-11-01).
--
-- Apply AFTER chirp-migration.sql (it widens that file's kind check and
-- re-states its insert policy). Idempotent: run it twice and the second run
-- changes nothing. Paste into the Supabase SQL editor; never `db push`.
--
-- What it adds, all on the existing conversation table, so an announcement
-- is a moment the chat already knows how to keep, react to and hide from
-- non-members — not a second system:
--
--   * kind 'announce'  — the host's "CHANGE OF PLANS!"; has a `tag` saying
--                        what kind of change, optional `href` to a location.
--   * reply_to         — a reply points at the moment it answers, in the
--                        same night (trigger-checked).
--
-- Acknowledging an announcement is a reaction ('✅') on it: the reactions
-- table, its one-row-per-person key and its policies are reused as they are.
--
-- Only the host may write an announcement (policy). Anyone may reply.

ALTER TABLE public.passport_occasion_moments
  ADD COLUMN IF NOT EXISTS reply_to uuid REFERENCES public.passport_occasion_moments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tag text,
  ADD COLUMN IF NOT EXISTS href text;

do $$ begin
  alter table public.passport_occasion_moments
    drop constraint if exists passport_occasion_moments_kind_check;
  alter table public.passport_occasion_moments
    add constraint passport_occasion_moments_kind_check
    check (kind in ('note', 'join', 'photo', 'chirp', 'announce'));

  if not exists (select 1 from pg_constraint
                 where conname = 'passport_occasion_moments_announce_check') then
    alter table public.passport_occasion_moments
      add constraint passport_occasion_moments_announce_check check (
        (kind = 'announce'
          and tag in ('update', 'venue', 'meeting', 'time')
          and text is not null and char_length(text) between 1 and 500
          and (href is null or (char_length(href) <= 300
               and (href ~ '^https://' or href ~ '^/[A-Za-z0-9]')))
          and reply_to is null)
        or (kind <> 'announce' and tag is null and href is null));
  end if;

  -- A reply answers something said on this night: a person's line, a photo,
  -- a Chirp Bot line or an announcement — never a row from another night.
  create or replace function public.passport_occasion_reply_check()
  returns trigger language plpgsql security definer set search_path = public as $f$
  declare v_kind text; v_occasion uuid;
  begin
    if new.reply_to is null then return new; end if;
    select kind, occasion_id into v_kind, v_occasion
      from passport_occasion_moments where id = new.reply_to;
    if v_occasion is null or v_occasion <> new.occasion_id then
      raise exception 'reply_to must name a moment on this night' using errcode = '23514';
    end if;
    if v_kind not in ('note', 'photo', 'chirp', 'announce') then
      raise exception 'that cannot be replied to' using errcode = '23514';
    end if;
    return new;
  end $f$;

  if not exists (select 1 from pg_trigger where tgname = 'passport_occasion_moments_reply') then
    create trigger passport_occasion_moments_reply
      before insert on public.passport_occasion_moments
      for each row execute function public.passport_occasion_reply_check();
  end if;

  -- Same rule as chirp-migration's (a member, as themselves), plus: an
  -- announcement is the host's alone.
  drop policy if exists passport_occasion_moments_say on public.passport_occasion_moments;
  create policy passport_occasion_moments_say on public.passport_occasion_moments
    for insert to authenticated with check (
      actor_id = auth.uid()
      and passport_is_occasion_member(occasion_id, auth.uid())
      and (kind in ('note', 'photo', 'chirp')
           or (kind = 'announce' and passport_occasion_role(occasion_id, auth.uid()) = 'host')));
end $$;

CREATE INDEX IF NOT EXISTS passport_occasion_moments_replies
  ON public.passport_occasion_moments (reply_to) WHERE reply_to IS NOT NULL;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- MIGRATION — passport_date_nights (Date Night: a personal invitation)
-- Written 2026-11-01 for the owner brief "Date Night — Lorne & Jess".
-- NOT applied to any real project yet; see docs/product/date-night/RELEASE.md.
-- Requires 20261021000000_passport_adventures.sql (applied in production).
--
-- WHAT THIS IS
--
-- A Date Night is an ordinary adventure of kind `date-night`, owned by the
-- person who planned it, plus one thing the adventure core does not have: a
-- public invitation that somebody can answer WITHOUT signing in. The answers
-- are the extension; membership, invitations and the plan stay the core's.
--
-- What the night offers (the ideas, the wording) is code today
-- (src/domain/date-night/nights/). This table only says which adventure a
-- slug belongs to and whether it is still taking answers.
--
-- SECURITY MODEL
--
--   * Anyone holding the link may ANSWER. The anon key is public, so the
--     tables grant anon nothing; answering goes through
--     `passport_date_night_answer`, SECURITY DEFINER, which accepts a bounded
--     JSON object for an open night and nothing else. It returns nothing that
--     was stored before.
--   * Only the adventure's OWNER may READ answers (RLS on
--     `passport_is_adventure_owner`). Nobody — the person who answered
--     included — can read them back through the API.
--   * Nights are created ONLY by `passport_date_night_setup`, which no API
--     role may execute: it is run once in the SQL editor by the operator,
--     naming the owner by their sign-in email, so no email lives in the repo.
--   * Flood limits: at most 5 answers a minute and 200 in all per night.
--
-- HOW TO APPLY
--
-- Paste into the Supabase SQL editor of the Passport project (do NOT
-- `supabase db push`; the project's migration history belongs to Atlas —
-- supabase/README.md). Every statement is guarded, so applying it twice
-- changes nothing. Production grants nothing by default, so every grant is
-- explicit. Then, once per night:
--
--   select public.passport_date_night_setup(
--     'lorne-and-jess', '<owner sign-in email>', 'Lorne ❤️ Jess',
--     '2026-11-02', 'America/Vancouver', 'Around Vernon');
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passport_date_nights (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  adventure_id text NOT NULL UNIQUE
    REFERENCES public.passport_adventures(id) ON DELETE CASCADE,
  -- The owner can stop taking answers without deleting any.
  open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.passport_date_night_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL REFERENCES public.passport_date_nights(slug) ON DELETE CASCADE,
  -- Validated by the app against the night (src/domain/date-night/answer.ts);
  -- bounded here so a caller skipping the app cannot store a novel.
  answer jsonb NOT NULL CHECK (
    jsonb_typeof(answer) = 'object' AND octet_length(answer::text) <= 16000
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS passport_date_night_answers_by_slug
  ON public.passport_date_night_answers (slug, created_at DESC);

ALTER TABLE public.passport_date_nights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passport_date_night_answers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------- policies

DROP POLICY IF EXISTS passport_date_nights_owner_read ON public.passport_date_nights;
CREATE POLICY passport_date_nights_owner_read ON public.passport_date_nights
  FOR SELECT TO authenticated
  USING (public.passport_is_adventure_owner(adventure_id));

DROP POLICY IF EXISTS passport_date_nights_owner_update ON public.passport_date_nights;
CREATE POLICY passport_date_nights_owner_update ON public.passport_date_nights
  FOR UPDATE TO authenticated
  USING (public.passport_is_adventure_owner(adventure_id))
  WITH CHECK (public.passport_is_adventure_owner(adventure_id));

DROP POLICY IF EXISTS passport_date_night_answers_owner_read ON public.passport_date_night_answers;
CREATE POLICY passport_date_night_answers_owner_read ON public.passport_date_night_answers
  FOR SELECT TO authenticated
  USING (EXISTS (
    -- Subject to passport_date_nights' own RLS: only the owner sees the row.
    SELECT 1 FROM public.passport_date_nights n
    WHERE n.slug = passport_date_night_answers.slug
      AND public.passport_is_adventure_owner(n.adventure_id)
  ));

DROP POLICY IF EXISTS passport_date_night_answers_owner_delete ON public.passport_date_night_answers;
CREATE POLICY passport_date_night_answers_owner_delete ON public.passport_date_night_answers
  FOR DELETE TO authenticated
  USING (EXISTS (
    -- Subject to passport_date_nights' own RLS: only the owner sees the row.
    SELECT 1 FROM public.passport_date_nights n
    WHERE n.slug = passport_date_night_answers.slug
      AND public.passport_is_adventure_owner(n.adventure_id)
  ));

-- ---------------------------------------------------------------- functions

/** Whether a night exists and is taking answers. Says nothing else. */
CREATE OR REPLACE FUNCTION public.passport_date_night_open(p_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce((select open from passport_date_nights where slug = p_slug), false);
$$;

/**
 * Answer a night, signed in or not. Returns the new answer's id only.
 * Errors: P0002 no such night / closed; 54000 too large; P0001 slow down /
 * full; 22023 not an object.
 */
CREATE OR REPLACE FUNCTION public.passport_date_night_answer(p_slug text, p_answer jsonb)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare
  v_id uuid;
begin
  -- One caller at a time per night, so the limits below cannot be raced.
  perform 1 from passport_date_nights where slug = p_slug and open for update;
  if not found then
    raise exception 'date night not open' using errcode = 'P0002';
  end if;
  if p_answer is null or jsonb_typeof(p_answer) <> 'object' then
    raise exception 'answer must be an object' using errcode = '22023';
  end if;
  if octet_length(p_answer::text) > 16000 then
    raise exception 'answer too large' using errcode = '54000';
  end if;
  if (select count(*) from passport_date_night_answers
      where slug = p_slug and created_at > now() - interval '1 minute') >= 5 then
    raise exception 'slow down' using errcode = 'P0001', hint = 'rate';
  end if;
  if (select count(*) from passport_date_night_answers where slug = p_slug) >= 200 then
    raise exception 'date night full' using errcode = 'P0001', hint = 'full';
  end if;

  insert into passport_date_night_answers (slug, answer)
  values (p_slug, p_answer)
  returning id into v_id;
  return v_id;
end $$;

/**
 * Create a night for an existing Passport account. Operator only (SQL
 * editor): no API role may execute it. Idempotent per slug — run twice, the
 * second returns the first adventure's id and changes nothing.
 */
CREATE OR REPLACE FUNCTION public.passport_date_night_setup(
  p_slug text,
  p_owner_email text,
  p_title text,
  p_on date,
  p_time_zone text DEFAULT NULL,
  p_destination_label text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
declare
  v_owner uuid;
  v_id text;
begin
  select adventure_id into v_id from passport_date_nights where slug = p_slug;
  if v_id is not null then
    return v_id;
  end if;

  select id into v_owner from auth.users
  where lower(email) = lower(btrim(p_owner_email));
  if v_owner is null then
    raise exception 'no Passport account for that email — sign up first'
      using errcode = 'P0002';
  end if;

  insert into passport_adventures
    (kind, title, owner_id, starts_on, time_zone, destination_label)
  values
    ('date-night', btrim(p_title), v_owner, p_on, p_time_zone,
     nullif(btrim(p_destination_label), ''))
  returning id into v_id;

  insert into passport_adventure_members (adventure_id, user_id, role)
  values (v_id, v_owner, 'owner');

  insert into passport_date_nights (slug, adventure_id) values (p_slug, v_id);
  return v_id;
end $$;

-- ------------------------------------------------------------------ grants
-- Production grants nothing by default; local stacks grant everything.
-- Revoke first so both end up the same.

REVOKE ALL ON public.passport_date_nights, public.passport_date_night_answers
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.passport_date_nights TO authenticated;
GRANT UPDATE (open) ON public.passport_date_nights TO authenticated;
GRANT SELECT, DELETE ON public.passport_date_night_answers TO authenticated;

REVOKE ALL ON FUNCTION public.passport_date_night_open(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_date_night_answer(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_date_night_setup(text, text, text, date, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.passport_date_night_open(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_date_night_answer(text, jsonb) TO anon, authenticated;

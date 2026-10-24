-- ============================================================================
-- PROPOSED MIGRATION — Hockey Night: finish the night
--   (sealed picks stay sealed until puck drop; Chirp Bot's mission and
--    challenge lines are self-keyed in the database)
--
-- Proposed for: supabase/migrations/<timestamp>_passport_occasion_night.sql
-- REQUIRES migration.sql, chirp-migration.sql and alive-migration.sql — it
-- runs LAST. Run night-preflight.sql first; paste into the SQL editor; never
-- `supabase db push`.
--
-- ## 1. Sealed picks — one function body
--
-- passport_occasion_answer_visible() used the lab's date-night rule for
-- `onLock` answers: visible once the prompt locks *or once the viewer has
-- answered it themself*. So the first person to seal their final score could
-- read, through PostgREST, every pick made after theirs — and copy it.
-- Now an `onLock` answer is visible to anyone but its author only once the
-- prompt locks. Every other rule (immediate, onCue, never, audience_only,
-- your own answer always yours) is unchanged, character for character.
--
-- The app enforces the same rule on every read (src/domain/hockey/sealed.ts),
-- so the night is sealed even before this is applied; this closes the door at
-- the database for anyone who talks to PostgREST directly.
--
-- ## 2. Chirp Bot: mission:<id>:… and done:<id>:… are self-keyed
--
-- A line saying somebody pulled off a secret mission or did a dare must be
-- written by that person's own session, like team:/arrive:/couch:/switch:
-- (alive-migration.sql). Without this a member could post
-- "mission:<somebody else>:<prompt>" first and, through the unique index,
-- stop the real line. (The page already refuses to *show* such a row.)
--
-- CREATE OR REPLACE / guarded do-block: applying it twice changes nothing. Same signature, same
-- owner, same grants (REPLACE keeps them); the grants are restated anyway.
-- Rollback: night-rollback.sql restores the previous body.
-- ============================================================================

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
    -- Sealed until it locks, for everybody. Sealing your own opens nothing.
    when 'onLock' then v_locked
    when 'onCue' then v_locked or exists (
      select 1 from passport_occasion_cues c
      where c.occasion_id = p_occasion and c.prompt_id = split_part(p_prompt, '::', 1))
    else false
  end;
end;
$$;

REVOKE ALL ON FUNCTION public.passport_occasion_answer_visible(uuid, text, uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.passport_occasion_answer_visible(uuid, text, uuid, uuid) TO authenticated;

do $$ begin
  -- Widen the self-keyed rule only if it is still alive-migration.sql's.
  if exists (select 1 from pg_constraint
             where conname = 'passport_occasion_moments_bot_self_check'
               and pg_get_constraintdef(oid) like '%couch%')
     and not exists (select 1 from pg_constraint
             where conname = 'passport_occasion_moments_bot_self_check'
               and pg_get_constraintdef(oid) like '%mission%') then
    alter table public.passport_occasion_moments
      drop constraint passport_occasion_moments_bot_self_check;
    alter table public.passport_occasion_moments
      add constraint passport_occasion_moments_bot_self_check check (
        bot_key is null
        or split_part(bot_key, ':', 1) not in ('team', 'arrive', 'couch', 'switch', 'mission', 'done')
        or split_part(bot_key, ':', 2) = actor_id::text) not valid;
    -- NOT VALID spares only rows written before (there are no mission/done
    -- rows before this migration); every new row is checked.
  end if;
end $$;

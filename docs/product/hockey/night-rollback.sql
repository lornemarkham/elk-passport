-- ============================================================================
-- ROLLBACK for night-migration.sql — restores migration.sql's body of
-- passport_occasion_answer_visible() (onLock answers visible to anyone who has
-- answered the same prompt). Only if night-migration.sql must be undone. Also narrows the
-- self-keyed Chirp Bot rule back to alive-migration.sql's (mission:/done:
-- rows already written stay; the page still checks them).
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

REVOKE ALL ON FUNCTION public.passport_occasion_answer_visible(uuid, text, uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.passport_occasion_answer_visible(uuid, text, uuid, uuid) TO authenticated;

do $$ begin
  if exists (select 1 from pg_constraint
             where conname = 'passport_occasion_moments_bot_self_check'
               and pg_get_constraintdef(oid) like '%mission%') then
    alter table public.passport_occasion_moments
      drop constraint passport_occasion_moments_bot_self_check;
    alter table public.passport_occasion_moments
      add constraint passport_occasion_moments_bot_self_check check (
        bot_key is null
        or split_part(bot_key, ':', 1) not in ('team', 'arrive', 'couch', 'switch')
        or split_part(bot_key, ':', 2) = actor_id::text) not valid;
  end if;
end $$;

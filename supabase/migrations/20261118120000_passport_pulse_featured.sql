-- People's Pulse V2: the Question of the Day.
--
-- One small table: which Pulse an administrator chose to feature on which
-- day. Same model as the rest of People's Pulse (20261118000000): the table
-- is closed to every API role and reached only through SECURITY DEFINER
-- functions that check the server's key. Additive: nothing existing changes.
-- Production grants nothing by default, so every grant is explicit.
-- Rollback: docs/product/pulse/PEOPLES-PULSE-V2.md, "Rollback".

CREATE TABLE IF NOT EXISTS public.passport_pulse_featured (
  day date PRIMARY KEY,
  pulse_id text NOT NULL REFERENCES public.passport_pulses(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.passport_pulse_featured ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.passport_pulse_featured FROM PUBLIC, anon, authenticated;

-- Feature a Pulse on a day, replacing that day's choice; a null Pulse clears the day.
CREATE OR REPLACE FUNCTION public.passport_pulse_feature(p_key text, p_day date, p_pulse text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  if p_pulse is null then
    delete from passport_pulse_featured where day = p_day;
    return true;
  end if;
  if not exists (select 1 from passport_pulses where id = p_pulse and status = 'live') then
    return false;
  end if;
  insert into passport_pulse_featured (day, pulse_id) values (p_day, p_pulse)
  on conflict (day) do update set pulse_id = excluded.pulse_id, created_at = now();
  return true;
end $$;

-- Featured days from p_from on, soonest first, with each Pulse and its counts.
CREATE OR REPLACE FUNCTION public.passport_pulse_featured(p_key text, p_from date, p_limit int)
RETURNS TABLE (day date, id text, status text, data jsonb, expires_at timestamptz,
               created_at timestamptz, total bigint, last_day bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
begin
  perform passport_pulse_check(p_key);
  return query
    select f.day, p.id, p.status, p.data, p.expires_at, p.created_at,
           (select count(*) from passport_pulse_votes v where v.pulse_id = p.id),
           (select count(*) from passport_pulse_votes v
             where v.pulse_id = p.id and v.created_at >= now() - interval '1 day')
      from passport_pulse_featured f
      join passport_pulses p on p.id = f.pulse_id
     where f.day >= p_from and p.status = 'live'
     order by f.day
     limit least(greatest(p_limit, 1), 60);
end $$;

REVOKE ALL ON FUNCTION public.passport_pulse_feature(text, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.passport_pulse_featured(text, date, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.passport_pulse_feature(text, date, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_pulse_featured(text, date, int) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

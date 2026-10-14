-- ============================================================================
-- Conference Arrivals: each member's flight, durable and shared.
--
-- Depends on 20261012000000_passport_conferences.sql. Apply it first.
--
-- One row per (conference, person). `record` is the app's ArrivalRecord (the
-- flight, whether it is shared, what ADS-B has shown). What the database
-- decides, never the app:
--
--   * Read   -> your own row; or somebody else's row only if they SHARED it,
--               they chose to be seen in the conference, and you are a
--               member. A hidden member's flight is never readable by others.
--               Organisers get no extra view.
--   * Write  -> only through passport_conference_arrivals_save(): your own
--               row in full; and, for another member's SHARED row, the
--               `tracking` part only, which any member may refresh from public
--               ADS-B data (whoever has the board open does the lookup).
--   * Erase  -> the row is deleted with the conference, and when the person
--               leaves or is removed, by a composite foreign key. No module
--               code has to remember.
--
-- Residual trust: a member of the same conference can overwrite the `tracking`
-- of a colleague's shared flight. They cannot touch the flight, the sharing
-- choice or anyone outside the conference. Guarded: applying twice is safe.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.passport_conference_arrivals (
  conference_id text NOT NULL,
  user_id       uuid NOT NULL,
  member_id     text NOT NULL,
  shared        boolean NOT NULL DEFAULT false,
  record        jsonb NOT NULL CHECK (octet_length(record::text) < 65536),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conference_id, user_id),
  UNIQUE (conference_id, member_id),
  FOREIGN KEY (conference_id, user_id)
    REFERENCES public.passport_conference_members (conference_id, user_id)
    ON DELETE CASCADE
);

ALTER TABLE public.passport_conference_arrivals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.passport_conference_arrivals FROM anon;
-- Writes go through the function below; nothing else needs them.
REVOKE INSERT, UPDATE ON public.passport_conference_arrivals FROM authenticated;

-- Is this person a member who chose to be seen? (Definer: reads the members
-- table past its own policy, answering only a yes/no.)
CREATE OR REPLACE FUNCTION public.passport_conference_arrivals_visible(p_conference text, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  select passport_conference_is_member(p_conference)
    and exists (select 1 from passport_conference_members
                where conference_id = p_conference and user_id = p_user
                  and visibility = 'members');
$$;

-- What a colleague may write onto your shared flight must at least *look* like
-- tracking: a known phase, a bounded trail of positions, a small body.
-- (It cannot be checked against ADS-B here; see "Residual trust" above.)
CREATE OR REPLACE FUNCTION public.passport_conference_arrivals_tracking_ok(t jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
  select jsonb_typeof(t) = 'object'
    and octet_length(t::text) < 16384
    and t->>'phase' in ('scheduled','searching','airborne','lost','landed','missed')
    and jsonb_typeof(t->'trail') = 'array'
    and jsonb_array_length(t->'trail') <= 240
    and not jsonb_path_exists(t->'trail', '$[*] ? (@.type() != "object" || @.lat.type() != "number" || @.lon.type() != "number")');
$$;

CREATE OR REPLACE FUNCTION public.passport_conference_arrivals_save(p_conference text, p_record jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
declare
  v_me     uuid := auth.uid();
  v_member text;
  v_row    passport_conference_arrivals%rowtype;
begin
  if v_me is null then raise exception 'not signed in'; end if;
  if jsonb_typeof(p_record) <> 'object' or p_record->>'conferenceId' is distinct from p_conference
     or p_record->>'memberId' is null then
    raise exception 'malformed record';
  end if;
  select member_id into v_member from passport_conference_members
    where conference_id = p_conference and user_id = v_me;
  if v_member is null then raise exception 'not a member'; end if;

  if p_record->>'memberId' = v_member then
    -- Your own flight, in full.
    insert into passport_conference_arrivals (conference_id, user_id, member_id, shared, record, updated_at)
    values (p_conference, v_me, v_member, coalesce((p_record->>'shared')::boolean, false), p_record, now())
    on conflict (conference_id, user_id) do update
      set shared = excluded.shared, record = excluded.record, updated_at = now();
    return;
  end if;

  -- Somebody else's shared flight: their tracking, and nothing else.
  select * into v_row from passport_conference_arrivals
    where conference_id = p_conference and member_id = p_record->>'memberId';
  if not found or not v_row.shared
     or not passport_conference_arrivals_visible(p_conference, v_row.user_id)
     or not passport_conference_arrivals_tracking_ok(p_record->'tracking')
     or v_row.record->>'updatedAt' is distinct from p_record->>'updatedAt' then
    return;  -- stale or not yours to touch: ignored, as a lost race is
  end if;
  update passport_conference_arrivals
     set record = jsonb_set(record, '{tracking}', p_record->'tracking'), updated_at = now()
   where conference_id = v_row.conference_id and user_id = v_row.user_id;
end $$;

REVOKE ALL ON FUNCTION public.passport_conference_arrivals_visible(text, uuid),
  public.passport_conference_arrivals_tracking_ok(jsonb),
  public.passport_conference_arrivals_save(text, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.passport_conference_arrivals_visible(text, uuid),
  public.passport_conference_arrivals_tracking_ok(jsonb),
  public.passport_conference_arrivals_save(text, jsonb) TO authenticated;

do $$ begin
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_arrivals_read') then
    create policy passport_conference_arrivals_read on public.passport_conference_arrivals
      for select to authenticated
      using (
        user_id = auth.uid()
        or (shared and passport_conference_arrivals_visible(conference_id, user_id))
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passport_conference_arrivals_delete') then
    create policy passport_conference_arrivals_delete on public.passport_conference_arrivals
      for delete to authenticated
      using (user_id = auth.uid() or passport_conference_is_organiser(conference_id));
  end if;
end $$;

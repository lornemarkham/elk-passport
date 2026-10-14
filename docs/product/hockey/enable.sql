-- Reverses disable.sql.
grant execute on function public.passport_create_occasion(text, text, timestamptz, jsonb, text, text, smallint, jsonb) to authenticated;
grant execute on function public.passport_redeem_occasion_invite(text, text, text, smallint) to authenticated;

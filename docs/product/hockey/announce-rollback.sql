-- Hockey Night — announcements and replies: rollback (2026-11-01).
-- Removes announcements and reply links, then the columns, and puts
-- chirp-migration's kind check and insert policy back. Reactions on removed
-- announcements go with them (cascade). Replies stay as plain lines.

delete from public.passport_occasion_moments where kind = 'announce';

drop trigger if exists passport_occasion_moments_reply on public.passport_occasion_moments;
drop function if exists public.passport_occasion_reply_check();

alter table public.passport_occasion_moments
  drop constraint if exists passport_occasion_moments_announce_check;
alter table public.passport_occasion_moments
  drop column if exists reply_to,
  drop column if exists tag,
  drop column if exists href;

do $$ begin
  alter table public.passport_occasion_moments
    drop constraint if exists passport_occasion_moments_kind_check;
  alter table public.passport_occasion_moments
    add constraint passport_occasion_moments_kind_check
    check (kind in ('note', 'join', 'photo', 'chirp'));
  drop policy if exists passport_occasion_moments_say on public.passport_occasion_moments;
  create policy passport_occasion_moments_say on public.passport_occasion_moments
    for insert to authenticated with check (
      actor_id = auth.uid() and kind in ('note', 'photo', 'chirp')
      and passport_is_occasion_member(occasion_id, auth.uid()));
end $$;

NOTIFY pgrst, 'reload schema';

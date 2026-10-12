-- ============================================================================
-- READ-ONLY AUDIT — board ownership claims and forged owners
-- Lane: boards, 2026-10-12. Pairs with boards-owner-claim-fix.sql.
--
-- Run in the SQL editor BEFORE applying the fix (what was already done) and
-- AFTER (nothing new can appear). Every statement is a SELECT; it changes
-- nothing. One result set; `finding` says what each row is.
--
-- A genuine row always names the board's real owner, who is also the owner
-- row's user. Anything else was written by somebody exploiting the holes the
-- fix closes (no app version has ever written otherwise: 3e6e370 onward).
--
-- What this can't see: an owner row that is internally consistent but sits on
-- a board its user does not own in Atlas (a pre-claim). Only Atlas knows who
-- owns a board. If `owner_rows_total` is small, check each owner row's
-- (board_id, user_id) against Atlas `boards`.
--
-- A person who joined through a forged invite holds a row that looks genuine
-- (it names the real owner). Every member of a board flagged here, and
-- especially those added after the earliest finding, is suspect.
--
-- Acting on findings is a separate, human decision: revoke the invites and
-- delete the rows named here, and treat the boards as disclosed.
-- ============================================================================

with owners as (
  select board_id, user_id as owner_id
  from public.passport_board_members
  where role = 'owner'
)

-- Shape of the data. Few or no owner rows means first shares were refused
-- (see the NOTE in the fix) and most boards have never been claimable.
select 'summary' as finding, null::text as board_id, null::uuid as user_id,
       null::uuid as board_owner_id, null::text as token,
       format('owner_rows_total=%s member_rows_total=%s invites_total=%s live_invites=%s',
         (select count(*) from public.passport_board_members where role = 'owner'),
         (select count(*) from public.passport_board_members),
         (select count(*) from public.passport_board_invites),
         (select count(*) from public.passport_board_invites
           where revoked_at is null and (expires_at is null or expires_at >= now())))
       as detail

-- Hole 1: a second owner claimed a board somebody already owned.
union all
select 'board_with_several_owners', board_id, null, null, null,
       format('%s owner rows', count(*))
from owners group by board_id having count(*) > 1

-- Hole 2: an owner row naming somebody else as the board's owner.
union all
select 'owner_row_names_someone_else', board_id, user_id, board_owner_id, null,
       'owner row whose board_owner_id is not its own user'
from public.passport_board_members
where role = 'owner' and board_owner_id <> user_id

-- Hole 2: a member row whose named owner is not the board's owner row.
union all
select 'member_row_names_non_owner', m.board_id, m.user_id, m.board_owner_id, null,
       coalesce('board owner row(s): ' || (
         select string_agg(o.owner_id::text, ',') from owners o where o.board_id = m.board_id),
         'board has NO owner row')
from public.passport_board_members m
where m.role <> 'owner'
  and not exists (
    select 1 from owners o
    where o.board_id = m.board_id and o.owner_id = m.board_owner_id)

-- Hole 2: an invite naming an owner other than its creator, or made by
-- somebody who is not the board's owner.
union all
select 'invite_names_someone_else', i.board_id, i.created_by, i.board_owner_id,
       left(i.token, 8) || '…',
       case when i.revoked_at is null and (i.expires_at is null or i.expires_at >= now())
            then 'LIVE invite' else 'dead invite' end
from public.passport_board_invites i
where i.board_owner_id <> i.created_by
   or not exists (
     select 1 from owners o
     where o.board_id = i.board_id and o.owner_id = i.created_by)

order by finding, board_id;

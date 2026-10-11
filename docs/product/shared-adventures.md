# Shared adventures — what a board does for a group

**Status:** implementation record, lane `boards`, 2026-10-11. Evidence of what
the code does and needs — **not** product authority. The doctrine is.
Group / multi-person experience is an open question there (§15.12); nothing
here answers it.

## One system, not two

A group adventure is a **board**. A conference is a board plus what an
organiser declares (`src/lib/data/boards-gatherings.ts`). Every group
capability below is the board's and works on any board; the conference page
(`/boards/conference/{slug}`) composes the same pieces and adds nothing
underneath. A future "Go have a conference" — or any other gathering — should
be a new entry in `GATHERINGS`, not a new store.

| Capability                 | Where it lives                                                       | State                                  |
| -------------------------- | -------------------------------------------------------------------- | -------------------------------------- |
| Invite someone             | `POST /api/boards/{id}/invites` → `/invite/{token}`                  | Live (owner only)                      |
| Join                       | `POST /api/invites/{token}` (`passport_redeem_board_invite`)         | Live                                   |
| Express interest           | `PUT/DELETE /api/boards/{id}/interest`                               | Code live, **table not migrated**      |
| Share a day with the group | `GET/POST/DELETE /api/boards/{id}/plans`, `SharedPlans`              | Code live, **table not migrated**      |
| "I'm in" on a shared day   | The interest mark, item id `plan:{planId}`                           | Needs both tables                      |
| Coordinate                 | Counts + opt-in names per item; `KindredPanel`; `LiveBoard` re-reads | Live where the tables exist            |
| Leave a group              | `DELETE /api/boards/{id}/members/me`, `LeaveBoard`                   | Code live, **RLS policy not migrated** |
| Remove someone             | `DELETE /api/boards/{id}/members/{userId}`                           | Live (owner only)                      |

Every "not migrated" path fails honestly: the route answers `503` and the page
says _can't … here yet_, never _nobody_ or _you've left_.

## Rules the code holds

- **Voluntary.** Joining needs a tap on a link; interest and "I'm in" need a
  tap; leaving needs two taps and nobody's permission. Nothing is inferred.
- **"I'm in" is interest, not commitment.** It is a raised hand, counted.
  Whether a group day needs a commitment state (doctrine §2.6) is open.
- **Names are opt-in, per thing.** Interest rows and shared days carry
  `shown_as` only when the person ticked the box. User ids never reach a
  browser; the leave route accepts `me` so the browser need not know its own.
- **People belong to the board's current members.** Interest from, and the
  name of, somebody who has left stops showing at once (filtered by
  membership), and leaving deletes the leaver's own interest rows.
- **A shared day is a link, not a copy.** `passport_board_plans.day_query` is
  the canonicalised `/go/print` query — stop ids and the sentence, town, date,
  hours and age it was built with. Opening it re-runs the print page against
  Atlas. Only `/go/print` links are accepted; nothing off-site.
- **Roles.** Any member reads and marks. Owner/editor share a day. The sharer
  or the owner takes a day down. Only the owner invites or removes people.

## Missing migrations (contracts lane)

None of this is in `supabase/migrations/` because schema is a shared contract.
Proposed as one migration, in this order:

```sql
-- 1. A member may leave. Owners may not (the board would be orphaned).
create policy "passport_board_members_self_leave"
  on public.passport_board_members for delete
  using (user_id = auth.uid() and role <> 'owner');

-- 2. "I'm interested" (code since 62e9900; table never migrated).
create table if not exists public.passport_board_interest (
  board_id   text        not null,
  item_id    text        not null check (char_length(item_id) <= 200),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  shown_as   text        check (shown_as is null or char_length(shown_as) <= 60),
  created_at timestamptz not null default now(),
  primary key (board_id, item_id, user_id)
);
alter table public.passport_board_interest enable row level security;
create policy "passport_board_interest_members_read"
  on public.passport_board_interest for select
  using (public.passport_is_board_member(board_id, auth.uid()));
create policy "passport_board_interest_own_insert"
  on public.passport_board_interest for insert
  with check (user_id = auth.uid() and public.passport_is_board_member(board_id, auth.uid()));
create policy "passport_board_interest_own_update"
  on public.passport_board_interest for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.passport_is_board_member(board_id, auth.uid()));
-- Taking your hand down never needs membership.
create policy "passport_board_interest_own_delete"
  on public.passport_board_interest for delete
  using (user_id = auth.uid());

-- 3. Days shared on a board.
create table if not exists public.passport_board_plans (
  id         uuid        primary key default gen_random_uuid(),
  board_id   text        not null,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  title      text        check (title is null or char_length(title) <= 80),
  day_query  text        not null check (char_length(day_query) <= 2000),
  shown_as   text        check (shown_as is null or char_length(shown_as) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists passport_board_plans_board on public.passport_board_plans (board_id);
alter table public.passport_board_plans enable row level security;
create policy "passport_board_plans_members_read"
  on public.passport_board_plans for select
  using (public.passport_is_board_member(board_id, auth.uid()));
create policy "passport_board_plans_editors_share"
  on public.passport_board_plans for insert
  with check (user_id = auth.uid()
    and public.passport_board_role(board_id, auth.uid()) in ('owner', 'editor'));
create policy "passport_board_plans_sharer_or_owner_withdraws"
  on public.passport_board_plans for delete
  using (user_id = auth.uid()
    or public.passport_board_role(board_id, auth.uid()) = 'owner');

-- 4. Marks go with what they were on, and with whoever made them — inside the
--    database, where deleting other people's rows is legitimate.
create or replace function public.passport_board_interest_cleanup()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'passport_board_members' then
    delete from passport_board_interest
      where board_id = old.board_id and user_id = old.user_id;
  elsif tg_table_name = 'passport_board_plans' then
    delete from passport_board_interest
      where board_id = old.board_id and item_id = 'plan:' || old.id::text;
  end if;
  return old;
end $$;
create trigger passport_board_members_interest_cleanup
  after delete on public.passport_board_members
  for each row execute function public.passport_board_interest_cleanup();
create trigger passport_board_plans_interest_cleanup
  after delete on public.passport_board_plans
  for each row execute function public.passport_board_interest_cleanup();
```

Atlas board deletion does not reach Passport's tables, so rows for a deleted
board are orphaned (unreadable — nobody is a member). Pre-existing for
members and invites too; a cleanup is not proposed here.

## Authentication requirements

- Every group action needs a **Supabase session** (`requireUser` /
  `currentUser`). Signed-out: `401` from the API; the conference page still
  shows the plan and names nobody.
- All reads/writes go through the **caller's own session**, so RLS is the
  boundary. No service-role key is used or needed.
- Board contents are read from Atlas **on the owner's behalf**
  (`ATLAS_API_URL` + bearer). Atlas never learns about members.
- `PASSPORT_BOARD_SYCLE_VANCOUVER_2026` must hold the staff board's Atlas id
  in each deployment for the conference page to find its board.
- Lanes run with no Supabase, so none of this can be exercised end to end on
  Metatron; unit tests mock the stores.

## Integration requirements

1. **Apply the migration above** (contracts lane), then exercise: join → mark
   → share a day → "I'm in" → leave, with two real accounts.
2. **Mount `ShareDayToBoard` on `/go`** (Go Have A Day's owner), beside _Print
   our adventure_: `<ShareDayToBoard link={`/go/print?${printQuery(…)}`} />`.
   Until then, a day is shared by pasting its print link into the form on the
   board.
3. **Events from viewers are refused** by `passport_events_member_write`
   (owner/editor only). A viewer joining, marking interest or leaving does not
   nudge other members' `LiveBoard`. Pre-existing; decide whether viewers may
   emit.

## Open — named, not resolved

- **Who may invite.** Owner only, today. For a conference, colleagues inviting
  colleagues is natural, and it is a role decision nobody has made.
- **Commitment.** "I'm in" is interest. Whether a shared day should have a
  stronger, holdable state (§2.6, §2.9 WANTED / PLANNED / DID) is open.
- **Anonymity vs. the member list.** Interest can be unnamed, but every member
  is named on _Who's on this board_. On a small board, "2 interested, 1
  unnamed" plus the member list can identify people. Whether a member can be on
  a board without being listed is a privacy decision (§15.8).
- **What travels with a shared day.** The sentence and a child's age the
  sharer used are visible to the whole board. The form says so; whether age
  should be stripped by default is undecided.

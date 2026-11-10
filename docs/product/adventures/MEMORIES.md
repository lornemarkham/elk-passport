# After you choose: your memories follow you, and stay yours (mission 694, 2026-11-10)

Owner brief _GO HAVE A DAY — AFTER YOU CHOOSE_. Built on
[ADR 012](../../architecture/decisions/012-adventures-start-full.md) and
[ADR 014](../../architecture/decisions/014-adventure-notices-and-shared-moments.md);
no second system. The journey this slice closes is **choose a day → build →
edit → share → live it → remember → share one memory**, on a phone and a
desktop.

## What already existed (and was only verified here)

Choose a day and have it built from real places; ordered stops with the way
between them; edit in words (previewed, undoable) or by hand (Keep · Replace ·
Move · Remove, add); the plan saved on the server; invite links so friends see
the same plan and every later change; START and a quiet companion; _Do it
again_. All of that is `docs/product/adventures/` and `group-adventures/`.

## What this adds

**A person's own memories — a photo, a few words, a favourite — are kept
against their account, readable by them alone, and follow them to another
device.** Before this they lived only in the phone's `localStorage`: lose the
phone, or open the recap on a laptop, and the day was gone.

| Piece                                                               | Where                                                                 |
| ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Table `passport_adventure_memories` (additive migration)            | `supabase/migrations/20261112000000_…_memories.sql`                   |
| Server reads/writes as the signed-in person                         | `src/lib/adventures/memories.ts`                                      |
| `GET/POST /api/adventures/[id]/memories`, `DELETE …/[memoryId]`     | `src/app/api/adventures/[id]/memories/`                               |
| Validation (`parseMemoryInput`) and the phone/account merge         | `src/lib/adventures/companion.ts`                                     |
| The phone keeps writing locally first, then mirrors; merges on load | `src/components/adventures/journey/useDevice.ts`                      |
| Row-level-security proof against a real Postgres                    | `src/lib/adventures/memories.stack.test.ts`                           |
| Browser acceptance, 390px and desktop                               | `docs/product/group-adventures/verification/after-you-choose.spec.ts` |

## Decisions made here (named, not buried)

- **Private means private.** The only policies are _yours_: not the
  adventure's owner, not a co-member. Sharing is unchanged — _Share with the
  group_ copies one memory into `passport_adventure_moments` (ADR 014). This
  answers the question ADR 014 / ALIVE.md left open ("cross-device private
  memories need a server table and an owner decision"); the owner brief of
  2026-11-10 asks for "memories kept privately by default". It does **not**
  name Want / Plan / Lived (§15.14).
- **The phone stays first.** A memory is written to the device, then mirrored.
  Signed out, or before the migration is applied, nothing changes and nothing
  fails (`GET` answers 409 `off`; the phone stops trying).
- **Leaving an adventure does not delete your memories**: they are yours. A
  deleted account cascades.
- **Ids are chosen by the phone**, so a retry or a re-sync is one memory.

## Known limits

- **Deleting on one device does not yet delete on another.** The union of
  phone and account wins, so a memory removed on device A is sent back up by
  device B's copy. Needs tombstones; not built.
- Photos are the 960px JPEGs the phone already makes (60–120 KB), capped at
  700,000 characters by the table, 200 memories per adventure per read.
- **Production**: the table does not exist until the owner applies the
  migration in the Supabase SQL editor (production has no default grants; the
  migration grants explicitly and ends with `NOTIFY pgrst, 'reload schema'`).
  Until then the shipped code behaves as before.

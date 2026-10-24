# 013 · A conference's programme is data, and a person's schedule stays on their phone

**Decided:** 2026-10-24, for the owner's _Conference — make Sycle Summit 2026
unforgettable_ brief ("Store structured schedule data rather than hardcoding
the agenda into UI components. Import must be idempotent." · "Do not publicly
expose internal company agenda details.") · **Status:** implemented on
`feature/sycle-summit`

## Context

The repository is **public** on GitHub. A real company's agenda — who
presents, what is announced, what is kept a surprise — is internal to that
company. A conference is invite-only; its record is readable by its
members and nobody else (RLS, and `notFound()` everywhere).

## Decisions

1. **The programme lives only in the conference's record** (`details`
   jsonb: `agenda`, `dayTitles`, `objectives`, `welcome`). It is never a
   source file, a fixture, a seed, a test expectation or a committed
   screenshot. Tests use an invented summit of the same shape
   (`src/domain/conference/testSummit.ts`, `e2e/fixtures/summit.agenda.json`);
   the real one is checked outside the repository.
2. **An organiser imports it from a file** (`passport-conference-agenda/1`,
   `agendaImport.ts`), through Organiser settings and the same endpoint and
   schema as any edit. Lines match by their own `id`, so an import is
   idempotent and a correction changes one line. The preview shows every
   change, including dates, time zone and venue, before anything is saved.
3. **Agenda lines gain `kind`, `topics` and `aside`** (all optional, additive).
   `kind` decides look and reminder defaults; it is the organiser's word, never
   inferred from a title.
4. **My Schedule and reminder choices are kept on the person's device**
   (`localStorage`), not in a table. No server record of who starred what; no
   migration two days before the event. The cost: a second phone starts
   empty. Revisit if people ask for sync.
5. **Calendar files never invent an end.** Typed ends are written as typed;
   otherwise an entry ends at the next published line that day (or after an
   hour, for the day's last), and its description says, in words, that this
   is not an official end time — the same display rule the app already used
   (EXECUTIVE.md §5).

## Consequences

- Rolling back to code older than this ADR keeps the agenda readable (old
  code ignores the new optional fields) **except** the new `bingo` module id,
  which older code rejects — switch Bingo off before any rollback.
- Import after deploying this code, not before: older code would drop the
  new fields on its next save.

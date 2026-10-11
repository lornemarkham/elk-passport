# The GO HAVE A DAY critic

> **What this is.** A repeatable measurement of whether GO HAVE A DAY is
> getting better: ten real questions, asked of the real `/go` page, over a
> real Atlas response. It checks the days and paper that come back, scores
> them, and compares each run with the one before.
>
> **What this is not.** It is not product authority:
> [`docs/PASSPORT-PRODUCT-DOCTRINE.md`](../../PASSPORT-PRODUCT-DOCTRINE.md) is.
> A score here is a shadow metric, and doctrine §1 says what happens when a
> shadow and the real measure disagree. The real measure is _"that was one
> hell of a day"_, said by a tired person by a fire, and no harness measures
> that. What this one can do is catch the days that could never have earned
> it: a closed rink, a meeting nobody was told about, the same afternoon given
> to two different questions.

Built by Lodge mission 173 on `lane/vision`, 2026-10-11. The first run is
[`BASELINE-2026-10-11.md`](BASELINE-2026-10-11.md).

---

## Run it

```sh
scripts/critic/run.sh                    # best evidence available, ~1 s
CRITIC_SCREENS=1 scripts/critic/run.sh   # plus screenshots and PDFs, ~3 min
```

| Variable                      | Meaning                                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `CRITIC_LIVE=1`               | Ask live Atlas. Needs `ATLAS_API_URL` and, unless Atlas is open, `ATLAS_SERVICE_TOKEN`. One read-only GET.       |
| `CRITIC_CORPUS=<file>`        | Use a saved `GET /discovery/candidates` body (`.json` or `.json.gz`) instead.                                    |
| `CRITIC_TODAY=YYYY-MM-DD`     | The day the questions are asked on. Default: today in Vancouver.                                                 |
| `CRITIC_HOME=<dir>`           | Where runs are kept. Default `~/.local/state/ghad-critic`.                                                       |
| `CRITIC_PREVIOUS=<run.json>`  | Compare with this run, not the latest one on the same kind of evidence.                                          |
| `CRITIC_SCREENS=1`            | Start an Atlas stand-in on 3122 and `next dev` on 3121, then screenshot `/go` (desktop and phone) and the paper. |
| `CRITIC_FAIL_ON_REGRESSION=1` | Exit 3 when a run regressed.                                                                                     |

Exit codes: `0` ran · `2` the critic itself failed · `3` regressed (opt-in) ·
`4` the browser showed something different from what the critic measured.

It writes `$CRITIC_HOME/runs/<id>/` (`run.json`, `report.md`, `delta.json`,
`pages.json`, `screens/`), appends one line per run to
`$CRITIC_HOME/history.jsonl`, and points `$CRITIC_HOME/latest` at the newest
run.

### Where the evidence comes from — always printed on line one

| Kind               | When                               | What it can tell you                                                                                                                                            |
| ------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **LIVE ATLAS**     | `CRITIC_LIVE=1` and Atlas answered | What a person would get today.                                                                                                                                  |
| **ATLAS SNAPSHOT** | `CRITIC_CORPUS` given              | What a person would have got when that body was saved.                                                                                                          |
| **FIXTURE ONLY**   | neither                            | Nothing about real Atlas. It runs the committed 2026-10-11 snapshot (`evidence/`), so a change between two fixture runs is a change in **code**, and only that. |

A run is only compared with earlier runs on the **same kind** of evidence.
Every comparison names its causes, `code`, `data` or `cohort`, from three
fingerprints: the files that decide what a day is, the Atlas body, and the
cohort with its scoring rules. Same code, same data and a moved score would
mean the critic is broken.

**There is no Atlas on Metatron lanes** (port 3000 is Lodge). The baseline
therefore ran on an **Atlas snapshot**: a body an Atlas session saved at
10:41 on 2026-10-11, fetched with `on=2026-10-11&childAge=5`. The live path
has been exercised end to end, but only against the critic's own stand-in. It
has **not** yet been run against real Atlas.

---

## How it measures

`scripts/critic/evaluate.critic.tsx` renders the real route components,
server-side: `src/app/go/page.tsx` with `?say=…&at=…`, then
`src/app/go/print/page.tsx` with the exact print link `/go` produced. Only
Atlas is replaced, by the saved body, **trimmed to answer exactly what the
page asked**. Today `/go` asks for neither `on=` nor `childAge=`, so it gets no
`onDate` and no `forAge`, as it would in production. The critic records what
the page asked on every run (`pageAsked`).

The untrimmed body is the **oracle**. It knows which places Atlas says are not
on today, and what Atlas says about a five-year-old. When the page could have
known something and didn't ask, the critic records it as a finding.

It also runs the critic's own reading of each sentence (`readBrief` and
`buildDay`) and fails the run (`harness.screen-drift`) if that disagrees with
what the page rendered. A critic that has drifted from the product says so
rather than scoring a page nobody sees.

With `CRITIC_SCREENS=1` a real browser loads the same URLs against a stand-in
Atlas serving the same body (`atlas-mock.mjs`). It saves screenshots and a
PDF of the paper, and checks that the stop counts match the run.

### Three kinds of output, never mixed

| Kind          | Means                                                                                     | Where                                |
| ------------- | ----------------------------------------------------------------------------------------- | ------------------------------------ |
| **Finding**   | Objective. A word that was said, a stated fact, or a rendered page contradicts the day.   | `checks.ts`, per run                 |
| **Signal**    | Measured. km, minutes, shares, counts. Feeds the scores; not good or bad by itself.       | `checks.ts`, per run                 |
| **Judgement** | Subjective. A named person or agent's opinion of a specific day, 1–5, with notes.         | [`judgements.json`](judgements.json) |
| **Ledger**    | Real-world check, outside Atlas: does the place exist, is it open that day. With sources. | [`ledger.json`](ledger.json)         |

**Silence is never a failure and never a pass.** Where Atlas says nothing
about the rain, the age or the date, the stop counts as _unknown_. Every
scenario reports how much was known, so a day can't look clean just because
nothing was known about it.

A finding carries its **basis**:

- `stated`: Atlas said so.
- `derived`: Atlas's own inference, for example "outdoor" because the subtype
  is _park_.
- `page`: the rendered page.
- `ledger`: a real-world check.

A judgement carries the **stops it judged**. When the day changes, the
judgement is marked **STALE** rather than silently applied to a different
afternoon.

### The checks

| Check                                           | Dimension           | Fails when                                                                                                                                         |
| ----------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reading.*`                                     | relevance           | The sentence said it and the reading doesn't hold it. `reading.unheld.*` is said, but `DayBrief` has no field for it yet                           |
| `stop.not-on-date`                              | factual             | Atlas states it is not on that day                                                                                                                 |
| `claim.open-contradicted`                       | factual             | The day says open; Atlas says not                                                                                                                  |
| `stop.event-over`                               | factual             | An event that ended before the day                                                                                                                 |
| `stop.real-world.*`                             | factual             | The ledger says closed / not found / wrong place / not open that day                                                                               |
| `stop.unplaced`                                 | practicality        | Atlas holds no coordinates, so there's no travel and no map pin                                                                                    |
| `need.sheltered`                                | relevance           | Asked for somewhere dry; Atlas reads the rain as exposed, or the place as outdoors                                                                 |
| `need.young-children`                           | relevance           | Atlas's verdict for the age is _excluded_                                                                                                          |
| `need.within`                                   | relevance           | A placed stop is farther than the scenario allows                                                                                                  |
| `need.worth-the-drive`                          | relevance           | Asked to go far; nothing in the day is far                                                                                                         |
| `day.does-not-fit`                              | practicality        | Even the fastest plausible drive, home included, leaves under 30 min a stop (the builder's own floor). Drive time is the critic's estimate (below) |
| `day.duplicate-title`, `cohort.same-day`        | variety             | One place twice in a day; two different questions given the same day                                                                               |
| `print.differs`, `print.differs-after-revision` | trust               | The paper isn't the screen, including after "Less driving"                                                                                         |
| `print.map-links`, `screen/print.broken-text`   | practicality, trust | A placed stop with no map link; `undefined`, `NaN` or `[object Object]` rendered                                                                   |
| `harness.*`                                     | —                   | The critic is out of step with the page. Fix the critic                                                                                            |

**Travel is the critic's estimate, never the product's.** It uses
straight-line legs out and back home. The floor is ×1.2 at 80 km/h, which no
real road beats. The likely figure is ×1.4 at 50 km/h. When `/travel/legs`
lands (M163, M170), the critic should use it and say so.

### The scores

Each dimension runs from 0 to 100, and the rule for it is written in
`checks.ts`. The scores exist so runs can be compared, not to grade a day in
the abstract.

- **Factual:** the share of stops with no factual finding.
- **Relevance:** half how much of the sentence was heard, half the share of
  stops that meet the scenario's needs. The second half is halved again when a
  "worth the drive" day goes nowhere.
- **Variety:** the mean of three things:
  - distinct kinds in the day;
  - the share of stops not reused by three or more of the town's five
    scenarios;
  - no duplicate days or stops.
- **Practicality:** the mean of three things:
  - the day fits;
  - the share of stops that are placed;
  - the share of stops with published hours or price.
- **Adventure, a proxy:** the mean of the shares of stops with a photo, with
  stated things to do, and with a challenge. **This measures whether a day
  has the materials of an adventure, not whether it is one.** Read the
  judgement.
- **Trust:** 100, minus 25 for each screen/paper or broken-text finding.

---

## Keep it honest

- **Add scenarios; don't edit them.** Changing a sentence changes the
  experiment, and the cohort fingerprint will flag every comparison across
  the change.
- **The ledger is evidence, so cite it.** Each entry needs at least one source
  URL, the date it was checked, and who checked it. "I'm fairly sure it's
  there" is not a ledger entry. An unverified stop shows as _unverified_, and
  it is counted.
- **Judgements are signed and dated**, and they apply only to the stops they
  name.
- **Never edit a run's output.** If a run was wrong, fix the critic and run it
  again. The history keeps both.

## For the scheduler (M171, Lodge)

This is the product critic. M171's _GO HAVE A DAY live tester_ is the browser
end-to-end loop. The two are designed to compose, not to compete:

- **The command:** `scripts/critic/run.sh`, from any checkout that contains
  it. It needs no credentials for fixture or snapshot runs.
- **The contract:** `$CRITIC_HOME/latest/run.json` (`schema: "ghad-critic/1"`,
  typed as `Run` in `scripts/critic/compare.ts`), `delta.json` (`Delta`), and
  one JSON line per run in `history.jsonl`.
- **When to alert:** `delta.regressed`, or exit code 2 or 4. Movements under 2
  points are treated as rounding noise.
- **Cost:** the critic makes no model calls, needs no key, and makes at most
  one GET to Atlas per run.
- **Not installed as a cron job.** Scheduling belongs to Lodge. `run.sh`
  reads no `.env.local`, so `ATLAS_API_URL` and `ATLAS_SERVICE_TOKEN` have to
  come from the scheduler's environment. For a nightly run against live Atlas
  from a machine that has it:

  ```sh
  15 6 * * * cd /path/to/app && CRITIC_LIVE=1 scripts/critic/run.sh >>~/.local/state/ghad-critic/cron.log 2>&1
  ```
